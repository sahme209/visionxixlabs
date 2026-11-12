import {operationalEcsManifest} from './contracts';
import {platformPreparationRequestId} from '../preparationReference';
import 'server-only';
import {z} from 'zod';
import {readBoundedRequestJson} from '@/lib/api/readBoundedRequestJson';
import {digest} from '../contracts';
import {operationalWorkloadBinding} from './workloadIdentity';
import {createDefaultOperationalRequestService} from './operationalRequestService';

const actionId=operationalWorkloadBinding.shape.actionId;
const command=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('preview'),actionId}).strict(),
 z.object({operation:z.literal('review'),actionId,expectedVersion:z.number().int().nonnegative(),planDigest:digest}).strict(),
 z.object({operation:z.literal('prepare'),selection:operationalEcsManifest,requestId:platformPreparationRequestId}).strict(),
 z.object({operation:z.literal('lookup'),requestId:platformPreparationRequestId}).strict(),
 z.object({operation:z.literal('inspect'),actionId}).strict(),
 z.object({operation:z.literal('observe'),actionId}).strict(),
 z.object({operation:z.literal('delegate'),actionId,expectedVersion:z.number().int().nonnegative(),planDigest:digest}).strict(),
]);
type Service=Awaited<ReturnType<typeof createDefaultOperationalRequestService>>;
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
/** Prepared human boundary, not registered. Workload claim/issuance/execution
 * stay private; observation never finalizes the parent or authorizes rollback. */
export function createOperationalHttp(createService:(request:Request)=>Promise<Service>=createDefaultOperationalRequestService){return async(request:Request)=>{
 if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
 let service:Service;
 try{service=await createService(request)}catch{return reply({ok:false,error:'operational_request_unavailable'},401)}
 let selected;
 try{selected=command.parse(await readBoundedRequestJson(request,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]),16384))}catch{return reply({ok:false,error:'invalid_operational_request'},400)}
 try{
  request.signal.throwIfAborted();let data;
  switch(selected.operation){
   case 'preview':data=await service.preview(selected.actionId);break;
   case 'review':data=await service.review(selected.actionId,selected.expectedVersion,selected.planDigest);break;
   case 'prepare':data=await service.prepare(selected.selection,selected.requestId);break;
   case 'lookup':data=await service.lookup(selected.requestId);break;
   case 'inspect':data=await service.inspect(selected.actionId);break;
   case 'observe':data=await service.observeTarget(selected.actionId);break;
   case 'delegate':data=await service.delegate(selected.actionId,selected.expectedVersion,selected.planDigest);break;
  }
  request.signal.throwIfAborted();
  return reply({ok:true,data});
 }catch{return reply({ok:false,error:'operational_result_unconfirmed',recovery:'inspect_same_action_no_automatic_retry'},409)}
}}
