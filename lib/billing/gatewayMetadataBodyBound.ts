import 'server-only';

/** Existing metadata cap. This bounds retained bytes, not transport allocations. */
export const GATEWAY_METADATA_MAX_BYTES=128*1024;
export async function readGatewayMetadataText(response:Response,signal:AbortSignal):Promise<string>{
 if(!response.body)throw Error('gateway_metadata_missing_body');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];
 let size=0,complete=false,cancelled=false,rejectPending:(()=>void)|undefined;
 const cancel=()=>{if(cancelled)return;cancelled=true;void reader.cancel().catch(()=>{});};
 const onAbort=()=>{rejectPending?.();cancel();};
 const read=():Promise<ReadableStreamReadResult<Uint8Array>>=>new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(settle:()=>void)=>{if(settled)return;settled=true;rejectPending=undefined;settle();};
  rejectPending=()=>finish(()=>reject(Error('gateway_metadata_aborted')));
  if(signal.aborted){onAbort();return;}
  // The rejection handler also observes late body errors after an abort race.
  reader.read().then(part=>finish(()=>resolve(part)),error=>finish(()=>reject(error)));
 });
 signal.addEventListener('abort',onAbort,{once:true});
 try{
  for(;;){
   if(signal.aborted)throw Error('gateway_metadata_aborted');
   const part=await read();
   if(signal.aborted)throw Error('gateway_metadata_aborted');
   if(part.done){complete=true;break;}
   if(!(part.value instanceof Uint8Array))throw Error('gateway_metadata_invalid_chunk');
   if(part.value.byteLength>GATEWAY_METADATA_MAX_BYTES-size)throw Error('gateway_metadata_too_large');
   if(part.value.byteLength===0)continue;
   // Own only validated-size chunks; a transport may already have allocated a
   // larger rejected chunk, which this helper cannot retroactively prevent.
   const copy=new Uint8Array(part.value.byteLength);copy.set(part.value);chunks.push(copy);size+=copy.byteLength;
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  // Preserve standard Response.text leading-BOM stripping, but refuse malformed
  // UTF8 rather than turn replacement characters into pricing metadata.
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 }finally{
  signal.removeEventListener('abort',onAbort);rejectPending=undefined;
  if(!complete)cancel();
  try{reader.releaseLock();}catch{}
 }
}
