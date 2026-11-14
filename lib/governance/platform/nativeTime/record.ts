/** V1 is historical inspection only; live source/publisher/interval require V2.
 * Pure wire codec, NOT source provenance, synchronized-time or execution authority. */
interface TimePublicationFields {
 readonly sourceGeneration:string;
 readonly publication:bigint;
 readonly asOfNs:bigint;
 readonly voidAfterNs:bigint;
 readonly boundNs:bigint;
 readonly driftPpb:bigint;
 readonly status:'synchronized'|'unknown'|'disrupted'|'free-running';
 readonly disruptionMarker:bigint;
 readonly disruptionSupported:boolean;
}
export type TimePublication=Readonly<TimePublicationFields & (
 {readonly version:1;readonly layout:'clockbound-v2'}|
 {readonly version:2;readonly layout:'clockbound-precise-origin-v1'}
)>;
export type PreciseTimePublication=Extract<TimePublication,{version:2}>;

const I63=(BigInt("1")<<BigInt("63"))-BigInt("1"),U64=(BigInt("1")<<BigInt("64"))-BigInt("1");
const fields=['version','layout','sourceGeneration','publication','asOfNs','voidAfterNs','boundNs','driftPpb','status','disruptionMarker','disruptionSupported'];
const statuses=new Set(['synchronized','unknown','disrupted','free-running']);
const fail=():never=>{throw Error('time_publication_unavailable')};
const integer=(value:unknown,maximum:bigint,minimum=BigInt("0")):value is bigint=>typeof value==='bigint'&&value>=minimum&&value<=maximum;
function capture(raw:TimePublication):Readonly<TimePublication>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length!==fields.length||Object.keys(raw).some(key=>!fields.includes(key)))return fail();
 const value={version:raw.version,layout:raw.layout,sourceGeneration:raw.sourceGeneration,publication:raw.publication,asOfNs:raw.asOfNs,voidAfterNs:raw.voidAfterNs,boundNs:raw.boundNs,driftPpb:raw.driftPpb,status:raw.status,disruptionMarker:raw.disruptionMarker,disruptionSupported:raw.disruptionSupported};
 if(!(value.version===1&&value.layout==='clockbound-v2'||value.version===2&&value.layout==='clockbound-precise-origin-v1')||typeof value.sourceGeneration!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value.sourceGeneration)||!integer(value.publication,U64,BigInt("1"))||!integer(value.asOfNs,I63)||!integer(value.voidAfterNs,I63)||value.voidAfterNs<=value.asOfNs||!integer(value.boundNs,I63)||!integer(value.driftPpb,BigInt("999999999"))||!statuses.has(value.status)||!integer(value.disruptionMarker,U64)||typeof value.disruptionSupported!=='boolean')return fail();
 return Object.freeze(value.version===1?{...value,version:1,layout:'clockbound-v2'}:{...value,version:2,layout:'clockbound-precise-origin-v1'});
}
export function encodeTimePublication(raw:TimePublication):Uint8Array{
 try{const v=capture(raw);if(v.version!==2)return fail();const text=['AXIOM_TIME_V2',v.layout,v.sourceGeneration,String(v.publication),String(v.asOfNs),String(v.voidAfterNs),String(v.boundNs),String(v.driftPpb),v.status,String(v.disruptionMarker),v.disruptionSupported?'1':'0','END',''].join('\n');const bytes=new TextEncoder().encode(text);if(bytes.length>4096)return fail();return bytes}catch{return fail()}
}
export function decodeTimePublication(raw:Uint8Array):Readonly<TimePublication>{
 try{
  if(!(raw instanceof Uint8Array)||raw.byteLength===0||raw.byteLength>4096)return fail();
  const bytes=Uint8Array.from(raw);if(bytes.some(byte=>byte>127))return fail();
  const lines=new TextDecoder('utf-8',{fatal:true}).decode(bytes).split('\n');
  if(lines.length!==13||lines[12]!==''||!(lines[0]==='AXIOM_TIME_V1'&&lines[1]==='clockbound-v2'||lines[0]==='AXIOM_TIME_V2'&&lines[1]==='clockbound-precise-origin-v1')||lines[11]!=='END'||!['0','1'].includes(lines[10]))return fail();
  const number=(text:string)=>{if(!/^(0|[1-9][0-9]{0,19})$/.test(text))return fail();return BigInt(text)};
  const value={sourceGeneration:lines[2],publication:number(lines[3]),asOfNs:number(lines[4]),voidAfterNs:number(lines[5]),boundNs:number(lines[6]),driftPpb:number(lines[7]),status:lines[8] as TimePublication['status'],disruptionMarker:number(lines[9]),disruptionSupported:lines[10]==='1'};
  return capture(lines[0]==='AXIOM_TIME_V2'?{...value,version:2,layout:'clockbound-precise-origin-v1'}:{...value,version:1,layout:'clockbound-v2'});
 }catch{return fail()}
}
