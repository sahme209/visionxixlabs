import {assertDesktopNotAborted} from './abortSignal';
export interface AgentActionTransportContext{getConfig:()=>{apiBase:string;sessionToken?:string};getRevision:()=>number;subscribe:(listener:()=>void)=>()=>void}
export async function agentActionRequest<T>(context:AgentActionTransportContext,method:'GET'|'POST',path:string,input:unknown,parse:(raw:unknown)=>T,parent?:AbortSignal):Promise<{ok:true;data:T}|{ok:false;sent:boolean}>{
 const config=context.getConfig(),revision=context.getRevision(),token=config.sessionToken;
 if(!token?.startsWith('axm.desk.')||parent?.aborted)return{ok:false,sent:false};
 const base=config.apiBase,abort=new AbortController();let sent=false,response:Response|undefined,reader:ReadableStreamDefaultReader<Uint8Array>|undefined,rejectStop!:(error:Error)=>void;
 const stopped=new Promise<never>((_,reject)=>{rejectStop=reject});
 const cancelResponse=(res:Response)=>{try{void res.body?.cancel().catch(()=>{})}catch{/* Already locked or consumed. */}};
 const cancelReader=()=>{try{void reader?.cancel().catch(()=>{})}catch{/* Already released. */}};
 const cancel=()=>{if(abort.signal.aborted)return;rejectStop(Error('request_stopped'));abort.abort();cancelReader();if(response&&!reader)cancelResponse(response)};
 const unsubscribe=context.subscribe(cancel),timer=setTimeout(cancel,15000);
 parent?.addEventListener('abort',cancel,{once:true});
 const owned=()=>{assertDesktopNotAborted(abort.signal);if(context.getConfig()!==config||context.getRevision()!==revision||config.apiBase!==base||config.sessionToken!==token)throw Error('request_context_changed')};
 try{
  const operation=(async()=>{
   owned();sent=true;const res=await fetch(`${base}${path}`,{method,credentials:'omit',redirect:'error',cache:'no-store',headers:{Accept:'application/json',Authorization:`Bearer ${token}`,...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:JSON.stringify(input)}:{}),signal:abort.signal});response=res;
   try{owned()}catch(error){cancelResponse(res);throw error}
   if(!res.ok||!res.body)throw Error('response_unavailable');
   const declared=res.headers.get('content-length');if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>16384))throw Error('response_too_large');
   reader=res.body.getReader();const activeReader=reader,chunks:Uint8Array[]=[];let size=0;
   try{for(;;){const next=await activeReader.read();owned();if(next.done)break;size+=next.value.byteLength;if(size>16384)throw Error('response_too_large');chunks.push(next.value)}}finally{void activeReader.cancel().catch(()=>{});activeReader.releaseLock();if(reader===activeReader)reader=undefined}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
   const result=parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));owned();return{ok:true as const,data:result};
  })();
  return await Promise.race([operation,stopped]);
 }catch{return{ok:false,sent}}finally{clearTimeout(timer);parent?.removeEventListener('abort',cancel);unsubscribe();abort.abort();cancelReader();if(response&&!reader)cancelResponse(response)}
}
