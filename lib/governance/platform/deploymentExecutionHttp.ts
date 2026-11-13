import 'server-only';
import {readBoundedRequestJson} from '@/lib/api/readBoundedRequestJson';
import {deploySite} from '@/lib/deploy/provider';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {createDefaultPlatformRequestService} from './requestService';
import {platformExecutionCommandSchema,platformInspectionSchema,type PlatformInspection} from './viewContract';
import {deploymentHistoryView} from './deploymentHistoryContract';
type Service=Pick<Awaited<ReturnType<typeof createDefaultPlatformRequestService>>,'createDeploymentExecutionBinding'|'actorUserId'|'inspect'|'readDeploymentExecutionSource'|'inspectDeployment'|'claim'|'claimNextEffect'|'beforeEffectSend'|'observeEffect'|'beforeEffectResult'>;
export interface PlatformDeploymentQualification {
 /** Protected current native/runtime/credential/target qualification. A stored
  * plan, digest or requester JSON can never supply this private authority. */
 assertCurrent(action:PlatformInspection,signal:AbortSignal):Promise<void>;
}
const unavailable:PlatformDeploymentQualification={async assertCurrent(){throw Error('platform_deployment_native_qualification_unavailable')}};
const unknown={ok:false,error:'platform_deployment_execution_unconfirmed',recovery:'inspect_same_action_no_automatic_retry'};
function reply(body:unknown,status=200){let text=JSON.stringify(body);if(new TextEncoder().encode(text).length>128*1024){text=JSON.stringify(unknown);status=409}return new Response(text,{status,headers:{'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'}})}
/** Prepared/unregistered generated-site requester execution. Default native
 * qualification REFUSES. Neither this factory nor tests enable a real route. */
export function createPlatformDeploymentExecutionHttp(factory:(request:Request)=>Promise<Service>=createDefaultPlatformRequestService,qualification:PlatformDeploymentQualification=unavailable){return async(request:Request)=>{
 if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);let service:Service;
 try{service=await factory(request)}catch{return reply({ok:false,error:'platform_requester_unavailable'},401)}
 let selected;try{selected=platformExecutionCommandSchema.parse(await readBoundedRequestJson(request,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]),4096))}catch{return reply({ok:false,error:'invalid_platform_deployment_execution'},400)}
 try{
  request.signal.throwIfAborted();const action=platformInspectionSchema.parse(await service.inspect(selected.actionId));
  if(action.actionId!==selected.actionId||action.plan.digest!==selected.planDigest||action.version!==selected.expectedVersion||action.status!=='approved'||action.expired||action.requesterUserId!==service.actorUserId||action.plan.effects.length!==1)throw Error('exact_action_unavailable');
  const effect=action.plan.effects[0];if(effect.kind!=='deployment.vercel'||!effect.target.leadId||!effect.target.leadRevision)throw Error('unsupported_deployment_profile');
  await qualification.assertCurrent(action,request.signal);request.signal.throwIfAborted();
  const source=await service.readDeploymentExecutionSource(action.actionId,action.plan.digest);
  if(source.planDigest!==action.plan.digest||source.sourceDigest!==action.plan.sourceDigest||sha256ContentHash(source.effect)!==sha256ContentHash(effect))throw Error('source_mismatch');
  request.signal.throwIfAborted();
  // Constructing this private binding is resource-free and refuses a missing
  // runtime before consuming the original independently approved parent.
  const binding=service.createDeploymentExecutionBinding(action.actionId,{
   beforeCredential:async()=>{request.signal.throwIfAborted();await qualification.assertCurrent(action,request.signal);request.signal.throwIfAborted()},
   beforeSend:async()=>{request.signal.throwIfAborted();await qualification.assertCurrent(action,request.signal);request.signal.throwIfAborted()},
   beforeResult:async()=>{request.signal.throwIfAborted();await qualification.assertCurrent(action,request.signal);request.signal.throwIfAborted()},
  });
  await service.claim(action.actionId,selected.expectedVersion);
  const submitted=await deploySite('vercel',source.package,{projectName:effect.target.projectName,...(effect.target.environment==='production'?{target:'production'}:{}),effectId:effect.id,source:{leadId:effect.target.leadId,leadRevision:effect.target.leadRevision},platformExecution:binding});
  const history=deploymentHistoryView.parse(await service.inspectDeployment(action.actionId));
  if(history.action.actionId!==action.actionId||history.action.plan.digest!==action.plan.digest||history.action.status!=='confirmed'||history.requests.length!==1||history.requests[0].effectIndex!==0||history.requests[0].outcome!=='accepted'||history.requests[0].providerDeploymentId!==submitted.deploymentId||history.requests[0].providerState!==submitted.state)throw Error('outcome_unconfirmed');
  await qualification.assertCurrent(action,request.signal);request.signal.throwIfAborted();return reply({ok:true,data:history});
 }catch{return reply(unknown,409)}
}}
