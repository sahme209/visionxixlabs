import 'server-only';
import {readBoundedRequestJson} from '@/lib/api/readBoundedRequestJson';
import {manualReleaseCommand} from './manualReleaseClientContract';
import {createDefaultManualReleaseRequestService} from './manualReleaseRequestService';
type Service=Awaited<ReturnType<typeof createDefaultManualReleaseRequestService>>;
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
/** Prepared paired-human boundary only, not registered. A notice is not owner
 * authorization or deployment. No deploy, credential, retry or rollback port. */
export function createManualReleaseHttp(createService:(request:Request)=>Promise<Service>=createDefaultManualReleaseRequestService){return async(request:Request)=>{
 if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
 let service:Service;
 try{service=await createService(request)}catch{return reply({ok:false,error:'manual_release_request_unavailable'},401)}
 let selected;
 try{selected=manualReleaseCommand.parse(await readBoundedRequestJson(request,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]),16384))}catch{return reply({ok:false,error:'invalid_manual_release_request'},400)}
 try{
  request.signal.throwIfAborted();let data;
  switch(selected.operation){
   case 'prepare':data={...await service.prepare(selected.selection,selected.requestId),requestId:selected.requestId.toLowerCase()};break;
   case 'lookup':data={...await service.lookup(selected.requestId),requestId:selected.requestId.toLowerCase()};break;
   case 'inspect':data=await service.inspect(selected.recordId);break;
   case 'review':await service.review(selected.recordId,selected.expectedVersion,selected.planDigest);data={reviewRecorded:true,providerExecution:false,executionAuthorized:false};break;
   case 'recordNotice':data=await service.recordNotice(selected.recordId,selected.expectedVersion);break;
   case 'inspectResult':data=await service.inspectResult(selected.recordId,selected.deploymentId);break;
  }
  request.signal.throwIfAborted();return reply({ok:true,data});
 }catch{return reply({ok:false,error:'manual_release_result_unconfirmed',recovery:'inspect_same_record_no_automatic_retry'},409)}
}}
