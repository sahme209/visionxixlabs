import 'server-only';
import {z} from 'zod';
import {readBoundedRequestJson} from '@/lib/api/readBoundedRequestJson';
import {platformPreparationRequestId} from '../preparationContract';
import {manualReleaseSelection} from './manualReleaseStore';
import {createDefaultManualReleaseRequestService} from './manualReleaseRequestService';
const recordId=z.string().regex(/^platform_manual_release_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
const command=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('prepare'),selection:manualReleaseSelection,requestId:platformPreparationRequestId}).strict(),
 z.object({operation:z.literal('lookup'),requestId:platformPreparationRequestId}).strict(),
 z.object({operation:z.literal('inspect'),recordId}).strict(),
 z.object({operation:z.literal('review'),recordId,expectedVersion:z.literal(0),planDigest:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
 z.object({operation:z.literal('recordNotice'),recordId,expectedVersion:z.literal(1)}).strict(),
 z.object({operation:z.literal('inspectResult'),recordId,deploymentId:z.string().regex(/^dpl_[A-Za-z0-9_]{1,128}$/)}).strict(),
]);
type Service=Awaited<ReturnType<typeof createDefaultManualReleaseRequestService>>;
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
/** Prepared paired-human boundary only, not registered. A notice is not owner
 * authorization or deployment. No deploy, credential, retry or rollback port. */
export function createManualReleaseHttp(createService:(request:Request)=>Promise<Service>=createDefaultManualReleaseRequestService){return async(request:Request)=>{
 if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
 let service:Service;
 try{service=await createService(request)}catch{return reply({ok:false,error:'manual_release_request_unavailable'},401)}
 let selected;
 try{selected=command.parse(await readBoundedRequestJson(request,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]),16384))}catch{return reply({ok:false,error:'invalid_manual_release_request'},400)}
 try{
  request.signal.throwIfAborted();let data;
  switch(selected.operation){
   case 'prepare':data=await service.prepare(selected.selection,selected.requestId);break;
   case 'lookup':data=await service.lookup(selected.requestId);break;
   case 'inspect':data=await service.inspect(selected.recordId);break;
   case 'review':await service.review(selected.recordId,selected.expectedVersion,selected.planDigest);data={reviewRecorded:true,providerExecution:false,executionAuthorized:false};break;
   case 'recordNotice':data=await service.recordNotice(selected.recordId,selected.expectedVersion);break;
   case 'inspectResult':data=await service.inspectResult(selected.recordId,selected.deploymentId);break;
  }
  request.signal.throwIfAborted();return reply({ok:true,data});
 }catch{return reply({ok:false,error:'manual_release_result_unconfirmed',recovery:'inspect_same_record_no_automatic_retry'},409)}
}}
