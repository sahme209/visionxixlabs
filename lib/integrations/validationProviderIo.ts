import 'server-only';
export const VALIDATION_PROVIDER_TIMEOUT_MS=15000;
export const VALIDATION_PROVIDER_MAX_BYTES=32768;
export function createValidationProviderIo(parent:AbortSignal,fetchImpl:typeof fetch=fetch){
 const controller=new AbortController(),abort=()=>controller.abort();
 parent.addEventListener('abort',abort,{once:true});if(parent.aborted)abort();
 const timer=setTimeout(abort,VALIDATION_PROVIDER_TIMEOUT_MS);
 const signal=controller.signal;
 const bounded=<T>(operation:()=>Promise<T>):Promise<T>=>new Promise((resolve,reject)=>{
  const canceled=()=>reject(new Error('validation_provider_outcome_unconfirmed'));
  if(signal.aborted){canceled();return}signal.addEventListener('abort',canceled,{once:true});
  Promise.resolve().then(()=>{signal.throwIfAborted();return operation()}).then(resolve,reject).finally(()=>signal.removeEventListener('abort',canceled));
 });
 return{signal,dispose(){clearTimeout(timer);parent.removeEventListener('abort',abort)},async read(url:string,init:RequestInit={}){
  const response=await bounded(async()=>{const response=await fetchImpl(url,{...init,signal,redirect:'error',credentials:'omit',cache:'no-store'});if(signal.aborted){void response.body?.cancel().catch(()=>undefined);throw new Error('validation_provider_outcome_unconfirmed')}return response});
  const reader=response.body?.getReader();if(!reader)throw new Error('validation_provider_invalid_body');
  const chunks:Uint8Array[]=[];let bytes=0;
  try{for(;;){const part=await bounded(()=>reader.read());if(part.done)break;bytes+=part.value.byteLength;if(bytes>VALIDATION_PROVIDER_MAX_BYTES)throw new Error('validation_provider_body_too_large');chunks.push(part.value)}
   const body=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength}
   return{ok:response.ok,status:response.status,json:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body)) as unknown};
  }finally{void reader.cancel().catch(()=>undefined)}
 }};
}
export type ValidationProviderIo=ReturnType<typeof createValidationProviderIo>;
