import 'server-only';
import {readBoundedRequestJson} from '@/lib/api/readBoundedRequestJson';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {operationalWorkloadCommand} from './workloadCommand';
import {handoffPreflightMetadata} from './handoffPreflightContract';
interface PreflightRunner {preflight(command:unknown,token:unknown,signal:AbortSignal):Promise<unknown>}
const reply=(body:unknown,status:number)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
/** Prepared unregistered read-only workload boundary. Only the private runner
 * verifies real signed identity/current human delegation/source qualification.
 * No execution method is reachable here; metadata is never a claim or proof. */
export function createOperationalHandoffPreflightHttp(runner?:PreflightRunner){return async(request:Request)=>{
 if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
 const token=request.headers.get('authorization')?.match(/^Bearer ([-A-Za-z0-9_]+\.[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+)$/)?.[1];
 if(!token||token.length>16384||token.startsWith('axm.desk.'))return reply({ok:false,error:'operational_workload_authentication_required'},401);
 if(!runner)return reply({ok:false,error:'operational_workload_qualification_unavailable'},503);
 const controller=new AbortController(),signal=AbortSignal.any([request.signal,controller.signal]),timer=setTimeout(()=>controller.abort(),10000);
 try{
  let command;try{command=operationalWorkloadCommand.parse(await readBoundedRequestJson(request,AbortSignal.any([signal,AbortSignal.timeout(5000)]),8192))}catch{return reply({ok:false,error:'invalid_operational_workload_command'},400)}
  signal.throwIfAborted();const metadata=handoffPreflightMetadata.parse(await withGithubAbort(runner.preflight(command,token,signal),signal));signal.throwIfAborted();
  if(metadata.actionId!==command.actionId)throw Error('mismatched');return reply({ok:true,data:metadata},200);
 }catch{return reply({ok:false,error:'operational_handoff_preflight_unavailable'},409)}finally{clearTimeout(timer);controller.abort()}
}}
