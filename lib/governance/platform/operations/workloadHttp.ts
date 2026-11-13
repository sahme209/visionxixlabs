import 'server-only';
import {readBoundedRequestJson} from '@/lib/api/readBoundedRequestJson';
import {operationalWorkloadCommand} from './workloadCommand';
import {readOperationalEcsResult} from './ecsExecution';
interface Runner{run(command:unknown,token:unknown,signal:AbortSignal):Promise<unknown>}
const reply=(body:unknown,status:number)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
/** Prepared unregistered workload boundary. Syntax is not authentication: the
 * supplied private runner must verify the signed exact-run identity and consume
 * its durable claim. No default profile/issuer, human session or static fallback. */
export function createOperationalWorkloadHttp(runner?:Runner){return async(request:Request)=>{
 if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
 const header=request.headers.get('authorization'),token=header?.match(/^Bearer ([-A-Za-z0-9_]+\.[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+)$/)?.[1];
 if(!token||token.length>16384||token.startsWith('axm.desk.'))return reply({ok:false,error:'operational_workload_authentication_required'},401);
 if(!runner)return reply({ok:false,error:'operational_workload_qualification_unavailable'},503);
 const controller=new AbortController(),signal=controller.signal;const abort=()=>controller.abort();request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted)abort();const timer=setTimeout(abort,35000);
 let stop:(()=>void)|undefined;
 try{
  let command;try{command=operationalWorkloadCommand.parse(await readBoundedRequestJson(request,AbortSignal.any([signal,AbortSignal.timeout(5000)]),8192))}catch{return reply({ok:false,error:'invalid_operational_workload_command'},400)}
  signal.throwIfAborted();const stopped=new Promise<never>((_resolve,reject)=>{stop=()=>reject(Error('operational_workload_stopped'));signal.addEventListener('abort',stop,{once:true})});
  const raw=await Promise.race([runner.run(command,token,signal),stopped]);signal.throwIfAborted();const result=readOperationalEcsResult(raw);if(result.actionId!==command.actionId)throw Error('mismatched');return reply({ok:true,data:result},200);
 }catch{return reply({ok:false,error:'operational_workload_result_unconfirmed',recovery:'inspect_original_action_no_automatic_retry'},409)}
 finally{clearTimeout(timer);request.signal.removeEventListener('abort',abort);if(stop)signal.removeEventListener('abort',stop);controller.abort()}
}}
