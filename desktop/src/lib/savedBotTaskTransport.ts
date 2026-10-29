import type {SavedBotTaskResult} from "../../../lib/axiom/bot/savedTaskContract";
interface Context {getConfig:()=>{apiBase:string;sessionToken?:string};getRevision:()=>number;subscribe:(fn:()=>void)=>()=>void}
const messages:Record<string,string>={
 saved_task_conflict_reload_before_saving:"This task has a newer saved version. Review it before saving your changes.",
 desktop_session_required:"A current browser-paired workspace session is required. Your unsent text is retained.",
 saved_task_not_found:"This saved task is unavailable in the current workspace.",
 saved_task_input_invalid:"Review the task title, instructions and size limits before saving.",
 saved_task_rate_limited:"Too many saved-task requests. Wait briefly, then retry.",
};
/** Dedicated paired transport: no cookie fallback, complete-body deadline or stale-context success. */
export async function savedBotTaskRequest<T>(context:Context,method:"GET"|"POST"|"PUT",path:string,body:unknown,validate:(value:unknown)=>value is T,signal?:AbortSignal):Promise<SavedBotTaskResult<T>> {
 const config=context.getConfig(),revision=context.getRevision(),base=config.apiBase,token=config.sessionToken;
 const failure=(errorCode:string,outcomeUnconfirmed=false):SavedBotTaskResult<T>=>({ok:false,errorCode,outcomeUnconfirmed,error:messages[errorCode]??(outcomeUnconfirmed?"The save outcome is unconfirmed. Your text is retained; check saved history or retry the same save.":"Saved tasks are unavailable. Your unsent text is retained; retry when the service is available.")});
 if(!token?.startsWith("axm.desk."))return failure("desktop_session_required");
 if(!/^\/api\/desktop\/bot\/tasks(?:\/bot_[a-f0-9]{64}(?:\/history)?)?(?:\?(?:cursor=bot_[a-f0-9]{64}|beforeVersion=\d{1,10}))?$/.test(path))return failure("saved_task_input_invalid");
 if(signal?.aborted)return failure("saved_task_context_changed");
 const controller=new AbortController();let reason:string|undefined;let dispatched=false;let status:number|undefined;let response:Response|undefined;let activeReader:ReadableStreamDefaultReader<Uint8Array>|undefined;let timer:ReturnType<typeof setTimeout>|undefined;let rejectStop!:(error:Error)=>void;
 const stopped=new Promise<never>((_,reject)=>{rejectStop=reject});
 const cancelResponse=(res:Response)=>{try{void res.body?.cancel().catch(()=>{})}catch{/* Locked or already consumed. */}};
 const cancelReader=()=>{try{void activeReader?.cancel().catch(()=>{})}catch{/* Reader already released. */}};
 const stop=(code:string)=>{if(reason)return;reason=code;rejectStop(new Error(code));controller.abort();cancelReader();if(response&&!activeReader)cancelResponse(response)};
 const unwatch=context.subscribe(()=>stop("saved_task_context_changed"));const abort=()=>stop("saved_task_context_changed");signal?.addEventListener("abort",abort,{once:true});
 const owns=()=>context.getConfig()===config&&context.getConfig().apiBase===base&&context.getConfig().sessionToken===token&&context.getRevision()===revision&&!signal?.aborted;
 timer=setTimeout(()=>stop("saved_task_timeout"),25000);
 try{
  const operation=(async()=>{
   dispatched=true;const res=await fetch(`${base}${path}`,{method,credentials:"omit",headers:{Authorization:`Bearer ${token}`,...(method!=="GET"?{"Content-Type":"application/json"}:{})},...(method!=="GET"?{body:JSON.stringify(body)}:{}),signal:controller.signal});response=res;status=res.status;
   if(controller.signal.aborted||!owns()){cancelResponse(res);throw new Error("stale_saved_task_response")}
   const declared=res.headers.get("content-length");if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>262144))throw new Error("saved_task_response_too_large");
   if(!res.body)throw new Error("saved_task_response_invalid");const reader=res.body.getReader();activeReader=reader;const chunks:Uint8Array[]=[];let size=0;
   try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>262144)throw new Error("saved_task_response_too_large");chunks.push(part.value)}}finally{void reader.cancel().catch(()=>{});reader.releaseLock();if(activeReader===reader)activeReader=undefined}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
   const payload:unknown=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
   if(controller.signal.aborted||!owns())return failure("saved_task_context_changed",method!=="GET");
   if(!payload||typeof payload!=="object"||Array.isArray(payload))throw new Error("saved_task_response_invalid");
   const envelope=payload as {ok?:unknown;data?:unknown;error?:unknown};
   if(res.ok&&envelope.ok===true&&validate(envelope.data))return {ok:true as const,data:envelope.data};
   const errorCode=typeof envelope.error==="string"&&Object.prototype.hasOwnProperty.call(messages,envelope.error)?envelope.error:"saved_task_service_unavailable";
   if(res.ok)throw new Error("saved_task_response_invalid");return failure(errorCode,method!=="GET"&&res.status>=500);
  })();
  return await Promise.race([operation,stopped]);
 }catch{return failure(reason??"saved_task_service_unavailable",method!=="GET"&&dispatched&&(status===undefined||status>=500||status<400))}
 finally{clearTimeout(timer);unwatch();signal?.removeEventListener("abort",abort);controller.abort();cancelReader();if(response&&!activeReader)cancelResponse(response)}
}
