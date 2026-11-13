import 'server-only';
import {createHash} from 'node:crypto';
import {IMAGE_ARTIFACT_MAX_BYTES} from './imageCustodyContract';

/** Candidate algorithm only. No native import, process launch, source
 * qualification or default registration. A protected, separately qualified
 * parent must bound native memory/CPU, module load, queue and cleanup. */
export interface ImageDecoderCandidateBackend {
 open(bytes:Uint8Array,options:{failOn:'warning';unlimited:false;limitInputPixels:4194304;limitInputChannels:4;sequentialRead:true;pages:1}):Promise<{
  metadata():Promise<Record<string,unknown>>;
  rgba():Promise<{data:Uint8Array;width:number;height:number;channels:number;depth:string}>;
  dispose():void;
 }>;
}
const fail=():never=>{throw Error('platform_image_decode_unavailable')};
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function dimensions(width:number,height:number){if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4096||height>4096||width*height>4194304)return fail();return {width,height}}
function crc(bytes:Uint8Array){let value=0xffffffff;for(const byte of bytes){value^=byte;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0)}return (value^0xffffffff)>>>0}
function pngEnvelope(bytes:Buffer){
 if(bytes.length<45||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return fail();
 let offset=8,count=0,header=false,data=false,closedData=false,result:{width:number;height:number;channels:number}|undefined;
 while(offset<bytes.length){
  if(++count>4096||offset+12>bytes.length)return fail();
  const size=bytes.readUInt32BE(offset),end=offset+12+size;if(end>bytes.length)return fail();
  const type=bytes.toString('ascii',offset+4,offset+8),payload=bytes.subarray(offset+8,end-4);
  if(!/^[A-Za-z]{4}$/.test(type)||crc(bytes.subarray(offset+4,end-4))!==bytes.readUInt32BE(end-4))return fail();
  if(!header&&type!=='IHDR')return fail();
  if(type==='IHDR'){
   if(header||size!==13||payload[8]!==8||![0,2,4,6].includes(payload[9])||payload[10]!==0||payload[11]!==0||payload[12]>1)return fail();
   const channels=({0:1,2:3,4:2,6:4} as Record<number,number>)[payload[9]];
   result={...dimensions(payload.readUInt32BE(0),payload.readUInt32BE(4)),channels};header=true;
  }else if(type==='IDAT'){if(closedData||size===0)return fail();data=true}
  else if(type==='IEND'){if(size!==0||!data||end!==bytes.length||!result)return fail();return result}
  else{
   if(data)closedData=true;
   // Do not interpret arbitrary ancillary/container/profile formats. Animation
   // chunks and compressed ICC profiles cannot be silently ignored.
   if(!['sRGB','gAMA','cHRM','pHYs','sBIT','bKGD','tIME','tEXt','iTXt','zTXt'].includes(type))return fail();
  }
  offset=end;
 }
 return fail();
}
function jpegEnvelope(bytes:Buffer){
 if(bytes.length<12||bytes[0]!==255||bytes[1]!==216)return fail();
 let offset=2,count=0,scan=false,sawScan=false,quantization=false,huffman=false,result:{width:number;height:number;channels:number}|undefined;
 while(offset<bytes.length){
  if(++count>16384)return fail();
  if(scan){
   // Skip entropy, including escaped FF bytes and restart markers. The codec
   // still must decode every pixel: this grammar cannot validate entropy.
   while(offset<bytes.length&&bytes[offset]!==255)offset++;
   if(offset>=bytes.length)return fail();
   let next=offset+1;while(next<bytes.length&&bytes[next]===255)next++;
   if(next>=bytes.length)return fail();
   if(bytes[next]===0||bytes[next]>=208&&bytes[next]<=215){offset=next+1;continue}
   scan=false;
  }
  if(bytes[offset++]!==255)return fail();
  while(offset<bytes.length&&bytes[offset]===255)offset++;
  const marker=bytes[offset++];if(marker===217){if(!sawScan||offset!==bytes.length||!result)return fail();return result}
  if(![192,194,196,219,221,218,254,224,225,237,238].includes(marker)||offset+2>bytes.length)return fail();
  const length=bytes.readUInt16BE(offset),end=offset+length;if(length<2||end>bytes.length)return fail();
  const payload=bytes.subarray(offset+2,end);
  if(marker===192||marker===194){
   if(result||payload.length<6||payload[0]!==8||![1,3].includes(payload[5])||payload.length!==6+3*payload[5])return fail();
   result={...dimensions(payload.readUInt16BE(3),payload.readUInt16BE(1)),channels:payload[5]};
  }else if(marker===219){if(payload.length===0)return fail();quantization=true}
  else if(marker===196){if(payload.length===0)return fail();huffman=true}
  else if(marker===221){if(payload.length!==2)return fail()}
  else if(marker===218){
   if(!result||!quantization||!huffman||payload.length<4||payload[0]<1||payload[0]>result.channels||payload.length!==4+2*payload[0])return fail();
   scan=true;sawScan=true;
  }else if(marker===224){if(payload.length<5||!payload.subarray(0,5).equals(Buffer.from('JFIF\0')))return fail()}
  else if(marker===225){if(payload.length<6||!payload.subarray(0,6).equals(Buffer.from('Exif\0\0')))return fail()}
  offset=end;
 }
 return fail();
}

/** Full decode is required even after valid framing. All engine observations
 * remain private/unqualified until actual package/worker qualification. */
export async function inspectImageDecoderCandidate(input:unknown,mimeType:'image/png'|'image/jpeg',profileDigest:string,backend:ImageDecoderCandidateBackend,signal:AbortSignal){
 let copy:Buffer|undefined,raster:Uint8Array|undefined,image:Awaited<ReturnType<ImageDecoderCandidateBackend['open']>>|undefined;
 try{
  signal.throwIfAborted();
  if(!(input instanceof Uint8Array)||input.byteLength<1||input.byteLength>IMAGE_ARTIFACT_MAX_BYTES||!/^([a-f0-9]{64})$/.test(profileDigest))return fail();
  copy=Buffer.from(input);const original=sha(copy);
  const frame=mimeType==='image/png'?pngEnvelope(copy):mimeType==='image/jpeg'?jpegEnvelope(copy):fail();
  image=await backend.open(copy,{failOn:'warning',unlimited:false,limitInputPixels:4194304,limitInputChannels:4,sequentialRead:true,pages:1});
  signal.throwIfAborted();const metadata=await image.metadata();signal.throwIfAborted();
  if(metadata.format!==(mimeType==='image/png'?'png':'jpeg')||metadata.width!==frame.width||metadata.height!==frame.height||metadata.channels!==frame.channels||metadata.depth!=='uchar'||metadata.pages!==undefined&&metadata.pages!==1||metadata.pageHeight!==undefined||metadata.loop!==undefined||metadata.delay!==undefined||metadata.orientation!==undefined&&metadata.orientation!==1||metadata.icc!==undefined||!['srgb','b-w'].includes(String(metadata.space)))return fail();
  const full=await image.rgba();raster=full?.data;signal.throwIfAborted();
  if(!(raster instanceof Uint8Array)||raster.byteLength!==frame.width*frame.height*4||full.width!==frame.width||full.height!==frame.height||full.channels!==4||full.depth!=='uchar'||sha(copy)!==original)return fail();
  return {mimeType,width:frame.width,height:frame.height,formatProfileDigest:profileDigest};
 }catch{return fail()}finally{
  try{image?.dispose()}catch{copy?.fill(0);raster?.fill(0);return fail()}
  copy?.fill(0);raster?.fill(0);
 }
}
