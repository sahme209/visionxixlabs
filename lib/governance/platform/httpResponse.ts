import 'server-only';
/** Decode only bounded successful JSON. No provider error/body enters errors. */
export async function readBoundedPlatformJson(response:Response,signal:AbortSignal,maxBytes=64*1024):Promise<unknown>{
 if(!response.ok||!response.body)throw Error('platform_provider_response_unconfirmed');
 const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0;
 try{
  while(true){
   signal.throwIfAborted();
   const part=await new Promise<ReadableStreamReadResult<Uint8Array>>((resolve,reject)=>{
    const abort=()=>reject(Error('platform_provider_response_unconfirmed'));signal.addEventListener('abort',abort,{once:true});
    if(signal.aborted){signal.removeEventListener('abort',abort);abort();return}
    reader.read().then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
   });
   signal.throwIfAborted();if(part.done)break;
   if((size+=part.value.byteLength)>maxBytes)throw Error('platform_provider_response_unconfirmed');parts.push(part.value);
  }
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));
 }finally{void reader.cancel().catch(()=>{});try{reader.releaseLock()}catch{/* aborted pending reader; never retry */}}
}
