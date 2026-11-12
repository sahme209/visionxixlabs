import {settingsArtifactSaveCommand} from './settingsArtifactClientContract';
import {settingsReviewCommand} from './settingsReviewContract';
import 'server-only';
import {z} from 'zod';
import {readBoundedRequestJson} from '@/lib/api/readBoundedRequestJson';
import {digest} from '../contracts';
import {operationalWorkloadBinding} from './workloadIdentity';
import {createDefaultSettingsRequestService} from './settingsRequestService';
const actionId=operationalWorkloadBinding.shape.actionId,version=z.number().int().nonnegative(),index=z.number().int().min(0).max(31);
const command=z.discriminatedUnion('operation',[
 ...settingsReviewCommand.options,
 z.object({operation:z.literal('claim'),actionId,expectedVersion:version,planDigest:digest}).strict(),
 z.object({operation:z.literal('execute'),actionId,expectedVersion:version,planDigest:digest,effectIndex:index}).strict(),
]);
type Service=Awaited<ReturnType<typeof createDefaultSettingsRequestService>>;
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
/** Prepared boundary only. No registered route, automatic claim/next child,
 * caller identity/outcome, secret response, implicit retry or deployment. */
export function createSettingsHttp(createService:(request:Request)=>Promise<Service>=createDefaultSettingsRequestService){return boundary(createService,false)}
/** Separate prepared secret intake; no other settings command is accepted. */
export function createSettingsArtifactHttp(createService:(request:Request)=>Promise<Service>=createDefaultSettingsRequestService){return boundary(createService,true)}
function boundary(createService:(request:Request)=>Promise<Service>,artifactOnly:boolean){return async(request:Request)=>{
 if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
 let service:Service;try{service=await createService(request)}catch{return reply({ok:false,error:'settings_request_unavailable'},401)}
 let selected;try{selected=(artifactOnly?settingsArtifactSaveCommand:command).parse(await readBoundedRequestJson(request,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]),131072))}catch{return reply({ok:false,error:'invalid_settings_request'},400)}
 try{
  request.signal.throwIfAborted();let data;
  switch(selected.operation){
   case 'prepare':data=await service.prepare(selected.selection,selected.requestId);break;
   case 'lookup':data=await service.lookup(selected.requestId);break;
   case 'preview':data=await service.preview(selected.actionId);break;
   case 'inspect':data=await service.inspect(selected.actionId);break;
   case 'save':{const preview=await service.preview(selected.actionId);if(preview.actionId!==selected.actionId||preview.version!==selected.expectedVersion||preview.planDigest!==selected.planDigest)throw Error('unavailable');request.signal.throwIfAborted();data=await service.save(selected.actionId,selected.effectIndex,selected.value);break;}
   case 'review':data=await service.review(selected.actionId,selected.expectedVersion,selected.planDigest);break;
   case 'claim':data=await service.claim(selected.actionId,selected.expectedVersion,selected.planDigest);break;
   case 'execute':{
    const original=await service.inspect(selected.actionId);if(original.status!=='claimed'||original.expired||original.version!==selected.expectedVersion||original.planDigest!==selected.planDigest)throw Error('unavailable');request.signal.throwIfAborted();data=await service.executeNext(selected.actionId,selected.effectIndex);break;
   }
  }
  return reply({ok:true,data});
 }catch{return reply({ok:false,error:'settings_result_unconfirmed',recovery:'inspect_same_action_no_automatic_retry'},409)}
}}
