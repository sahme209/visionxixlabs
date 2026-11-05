import 'server-only';
import {NextRequest} from 'next/server';
import {z} from 'zod';
type Handler=(request:NextRequest,requestId:string,planId:string)=>Promise<Response>;
const mutation=z.object({action:z.enum(['prepare','execute','cancel']),expectedVersion:z.number().int().min(0).max(2),clientRequestId:z.string().uuid()}).strict();
const recovery=z.object({action:z.literal('recover'),expectedVersion:z.number().int().min(0).max(2)}).strict();
const envelope=z.object({protocol:z.literal('axiom.issuer-request/1'),operation:z.enum(['read_execution','prepare_execution','execute_execution','cancel_execution','read_operation','recover_operation']),requestId:z.string().regex(/^[A-Za-z0-9_-]{1,160}$/),planId:z.string().regex(/^release_plan_[a-f0-9]{64}$/),authorization:z.string().regex(/^axm\.desk\.[^\x00-\x1f\x7f]+\.[a-fA-F0-9]{64}$/),body:z.unknown().optional()}).strict();
/** JSON.parse alone silently accepts duplicate keys. Scan the already valid JSON
 * recursively, comparing decoded keys (including escaped spellings). */
function uniqueKeys(text:string):unknown{
 const value:unknown=JSON.parse(text);let i=0;
 const ws=()=>{while(/\s/.test(text[i]??'')&&i<text.length)i++;};
 const string=()=>{const start=i++;while(i<text.length){if(text[i++]==='"')break;if(text[i-1]==='\\')i++;}return JSON.parse(text.slice(start,i)) as string;};
 function visit(depth:number){if(depth>16)throw Error();ws();if(text[i]==='{'){i++;ws();const keys=new Set<string>();if(text[i]==='}'){i++;return;}for(;;){ws();const key=string();if(keys.has(key))throw Error();keys.add(key);ws();i++;visit(depth+1);ws();if(text[i++]==='}')return;}}
  else if(text[i]==='['){i++;ws();if(text[i]===']'){i++;return;}for(;;){visit(depth+1);ws();if(text[i++]===']')return;}}
  else if(text[i]==='"')string();else while(i<text.length&&!/[\s,}\]]/.test(text[i]))i++;
 }visit(0);return value;
}
async function boundedResponse(response:Response,signal:AbortSignal){
 const reader=response.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
 try{signal.throwIfAborted();if(reader)for(;;){let onAbort:()=>void=()=>{};const aborted=new Promise<never>((_,reject)=>{onAbort=()=>reject(Error());signal.addEventListener('abort',onAbort,{once:true});});let result:ReadableStreamReadResult<Uint8Array>;try{signal.throwIfAborted();result=await Promise.race([reader.read(),aborted]);}finally{signal.removeEventListener('abort',onAbort);}signal.throwIfAborted();if(result.done)break;size+=result.value.byteLength;if(size>262144)throw Error();chunks.push(result.value.slice());}signal.throwIfAborted();const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}return Object.freeze({status:response.status,body});}
 catch{if(reader)void reader.cancel().catch(()=>{});throw Error();}finally{reader?.releaseLock();}
}
/** Trusted construction only; not a listener, runtime export or authority issuer.
 * No caller-provided URL, headers, scope, adapter or executable values enter. */
export function createPrivateReleaseMergeDataDispatcher(handlers:Readonly<{execution:Handler;operation:Handler}>){
 return async(serialized:Uint8Array,signal:AbortSignal):Promise<Readonly<{status:number;body:Uint8Array}>>=>{
  try{signal.throwIfAborted();if(!(serialized instanceof Uint8Array)||serialized.byteLength>4096)throw Error();const text=new TextDecoder('utf-8',{fatal:true}).decode(serialized);const data=envelope.parse(uniqueKeys(text));const history=data.operation==='read_operation'||data.operation==='recover_operation';const read=data.operation.startsWith('read_');signal=AbortSignal.any([signal,AbortSignal.timeout(history?10000:25000)]);signal.throwIfAborted();let body:string|undefined;
   if(read){if(Object.hasOwn(data,'body'))throw Error();}else{const parsed=history?recovery.parse(data.body):mutation.parse(data.body);if(parsed.action!==data.operation.split('_')[0])throw Error();body=JSON.stringify(parsed);if(new TextEncoder().encode(body).byteLength>(history?256:1024))throw Error();}
   const headers:Record<string,string>={Authorization:'Bearer '+data.authorization};if(body!==undefined)headers['Content-Type']='application/json';const request=new NextRequest(`https://axiom.invalid/api/desktop/deployments/${data.requestId}/operation-plans/${data.planId}/provider-${history?'operation':'execution'}`,{method:read?'GET':'POST',headers,body,signal});signal.throwIfAborted();let removeAbort=()=>{};const aborted=new Promise<never>((_,reject)=>{const listener=()=>reject(Error());signal.addEventListener('abort',listener,{once:true});removeAbort=()=>signal.removeEventListener('abort',listener);});let response:Response;try{signal.throwIfAborted();response=await Promise.race([(history?handlers.operation:handlers.execution)(request,data.requestId,data.planId).then(value=>{if(signal.aborted){void value.body?.cancel().catch(()=>{});throw Error();}return value;}),aborted]);}finally{removeAbort();}return await boundedResponse(response,signal);
  }catch{throw Error('private_request_data_unavailable');}
 };
}
