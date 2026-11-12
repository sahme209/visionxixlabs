import 'server-only';
import {readBoundedRequestJson} from '@/lib/api/readBoundedRequestJson';
import {custodianCommand} from './custodianCommand';
import {createDefaultCustodianRequestService} from './custodianRequestService';
type Service=Awaited<ReturnType<typeof createDefaultCustodianRequestService>>;
const unconfirmed={ok:false,error:'custodian_result_unconfirmed',recovery:'inspect_same_action_or_lookup_original_reference_no_automatic_retry'};
function reply(body:unknown,status=200){let text=JSON.stringify(body);if(new TextEncoder().encode(text).length>65536){text=JSON.stringify(unconfirmed);status=409}return new Response(text,{status,headers:{'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'}})}
/** Human control/observation boundary, NOT registered; no credentials, role
 * exchange, provider send, native runtime activation or permission grant. */
export function createCustodianHttp(createService:(request:Request)=>Promise<Service>=createDefaultCustodianRequestService){return async(request:Request)=>{
 if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);let service:Service;
 try{service=await createService(request)}catch{return reply({ok:false,error:'custodian_request_unavailable'},401)}
 let selected;try{selected=custodianCommand.parse(await readBoundedRequestJson(request,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]),16384))}catch{return reply({ok:false,error:'invalid_custodian_request'},400)}
 try{request.signal.throwIfAborted();let data;
  switch(selected.operation){
   case 'prepare':data={...await service.prepare(selected.selection,selected.requestId),requestId:selected.requestId.toLowerCase()};break;
   case 'lookup':data={...await service.lookup(selected.requestId),requestId:selected.requestId.toLowerCase()};break;
   case 'inspect':data=await service.inspect(selected.actionId,selected.afterSequence);break;
   case 'preview':data=await service.preview(selected.actionId);break;
   case 'review':await service.review(selected.actionId,selected.expectedVersion,selected.planDigest);data={actionId:selected.actionId,planDigest:selected.planDigest,version:1,reviewRecorded:true,executionAuthorized:false,providerExecution:false};break;
   case 'executeControl':data=await service.executeControl(selected.actionId,selected.expectedVersion);break;
   case 'observeClosure':data=await service.observeClosure(selected.actionId,false);break;
   case 'refreshClosure':data=await service.observeClosure(selected.actionId,true);break;
  }
  request.signal.throwIfAborted();return reply({ok:true,data});
 }catch{return reply(unconfirmed,409)}
}}
