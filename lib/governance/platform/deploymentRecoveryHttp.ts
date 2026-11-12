import 'server-only';
import {readBoundedRequestJson} from '@/lib/api/readBoundedRequestJson';
import {deploymentRecoveryCommand} from './deploymentRecoveryCommand';
import {createDefaultDeploymentRecoveryRequestService} from './deploymentRecoveryRequestService';
type Service=Awaited<ReturnType<typeof createDefaultDeploymentRecoveryRequestService>>;
const unconfirmed={ok:false,error:'platform_deployment_recovery_unconfirmed',recovery:'inspect_same_action_or_lookup_original_reference_no_automatic_retry'};
function reply(body:unknown,status=200){let text=JSON.stringify(body);if(new TextEncoder().encode(text).length>65536){text=JSON.stringify(unconfirmed);status=409}return new Response(text,{status,headers:{'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'}})}
/** Prepared handler only, no public route registration or provider write. */
export function createDeploymentRecoveryHttp(createService:(request:Request)=>Promise<Service>=createDefaultDeploymentRecoveryRequestService){return async(request:Request)=>{
 if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);let service:Service;try{service=await createService(request)}catch{return reply({ok:false,error:'platform_deployment_recovery_request_unavailable'},401)}
 let command;try{command=deploymentRecoveryCommand.parse(await readBoundedRequestJson(request,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]),16384))}catch{return reply({ok:false,error:'invalid_deployment_recovery_request'},400)}
 try{request.signal.throwIfAborted();let data;switch(command.operation){
  case 'prepare':data={...await service.prepare(command.selection,command.requestId),requestId:command.requestId.toLowerCase()};break;
  case 'lookup':data={...await service.lookup(command.requestId),requestId:command.requestId.toLowerCase()};break;
  case 'inspect':data=await service.inspect(command.actionId);break;
  case 'preview':data=await service.preview(command.actionId);break;
  case 'review':data=await service.review(command.actionId,command.expectedVersion,command.planDigest);break;
  case 'observe':data=await service.observe(command.actionId,command.expectedVersion,command.planDigest);break;
 }request.signal.throwIfAborted();return reply({ok:true,data})}catch{return reply(unconfirmed,409)}
}}
