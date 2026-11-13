import 'server-only';
import {readBoundedRequestJson} from '@/lib/api/readBoundedRequestJson';
import {publishDraft} from '@/lib/growth/linkedin/posting';
import {schedulePlatformLinkedInDraft} from '@/lib/growth/linkedin/platformSchedule';
import {deletePlatformLinkedInPost} from '@/lib/growth/linkedin/platformDeletion';
import {createDefaultPlatformRequestService} from './requestService';
import {bindPlatformExecution} from './effectExecution';
import {platformExecutionCommandSchema,platformInspectionSchema,type PlatformInspection} from './viewContract';
type Service=Parameters<typeof bindPlatformExecution>[0]&{actorUserId:string;inspect(id:string):Promise<PlatformInspection>;claim(id:string,version:number):Promise<void>};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
/** Prepared default requester-only composition, NOT a registered route.
 * This dispatches the supported single growth effects only. Other families,
 * source/runtime qualification and whole-workflow coverage remain incomplete. */
export function createPlatformExecutionHttp(createService:(request:Request)=>Promise<Service>=createDefaultPlatformRequestService){
 return async(request:Request)=>{
  if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
  let service:Service;
  try{service=await createService(request)}catch{return reply({ok:false,error:'platform_requester_unavailable'},401)}
  let selected;
  try{selected=platformExecutionCommandSchema.parse(await readBoundedRequestJson(request,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]),4096))}catch{return reply({ok:false,error:'invalid_platform_execution_request'},400)}
  try{
   const action=platformInspectionSchema.parse(await service.inspect(selected.actionId));
   if(action.actionId!==selected.actionId||action.version!==selected.expectedVersion||action.plan.digest!==selected.planDigest||action.status!=='approved'||action.expired||action.requesterUserId!==service.actorUserId||action.plan.effects.length!==1)throw Error('exact_action_unavailable');
   const effect=action.plan.effects[0];if(effect.kind!=='growth.post.publish'&&effect.kind!=='growth.schedule.change'&&effect.kind!=='growth.post.delete')throw Error('unsupported_execution_profile');
   request.signal.throwIfAborted();await service.claim(selected.actionId,selected.expectedVersion);
   const binding=bindPlatformExecution({actorUserId:service.actorUserId,claimNextEffect:id=>service.claimNextEffect(id),beforeEffectSend:async(proof,exact)=>{request.signal.throwIfAborted();await service.beforeEffectSend(proof,exact);request.signal.throwIfAborted()},observeEffect:(proof,outcome)=>service.observeEffect(proof,outcome)},selected.actionId);
   const common={...(effect.kind!=='growth.post.delete'&&effect.target.imageUploadActionId?{imageUploadActionId:effect.target.imageUploadActionId}:{}),draftId:effect.target.draftId,connectionId:effect.target.connectionId,effectId:effect.id,platformExecution:binding};
   if(effect.kind==='growth.post.publish')await publishDraft({...common,triggeredBy:'platform-governance'});
   else if(effect.kind==='growth.schedule.change')await schedulePlatformLinkedInDraft({...common,scheduledFor:new Date(effect.target.scheduledFor)});
   else await deletePlatformLinkedInPost(common);
   const observed=platformInspectionSchema.parse(await service.inspect(selected.actionId));
   if(observed.actionId!==action.actionId||observed.plan.digest!==action.plan.digest||observed.status!=='confirmed')throw Error('outcome_unconfirmed');
   return reply({ok:true,data:observed});
  }catch{
   // No retry, replacement plan or caller-supplied outcome. Even a lost claim
   // may have committed: recover only by inspecting this same durable record.
   return reply({ok:false,error:'platform_execution_outcome_unconfirmed',recovery:'inspect_same_action_no_automatic_retry'},409);
  }
 };
}
