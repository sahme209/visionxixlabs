import 'server-only';
import {readBoundedRequestJson} from '@/lib/api/readBoundedRequestJson';
import {createDefaultPlatformRequestService} from './requestService';
import {platformDeploymentCommand,platformDeploymentPreview} from './deploymentContract';
import {platformPreparationReceiptSchema,platformPreparationLookupSchema} from './preparationContract';
import {deploymentHistoryView} from './deploymentHistoryContract';
type Service=Pick<Awaited<ReturnType<typeof createDefaultPlatformRequestService>>,'prepareDeployment'|'lookupDeploymentPreparation'|'previewDeployment'>&Partial<Pick<Awaited<ReturnType<typeof createDefaultPlatformRequestService>>,'inspectDeployment'>>;
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
/** Prepared only, not route-registered. No decision, claim or execution command. */
export function createPlatformDeploymentHttp(factory:(request:Request)=>Promise<Service>=createDefaultPlatformRequestService){
 return async(request:Request)=>{
  if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
  let service:Service;try{service=await factory(request)}catch{return reply({ok:false,error:'platform_requester_unavailable'},401)}
  let command;try{command=platformDeploymentCommand.parse(await readBoundedRequestJson(request,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]),4096))}catch{return reply({ok:false,error:'invalid_platform_deployment_request'},400)}
  try{
   request.signal.throwIfAborted();
   if(command.operation==='inspect_deployment'){
    if(!service.inspectDeployment)throw Error('unavailable');const history=deploymentHistoryView.parse(await service.inspectDeployment(command.actionId));if(history.action.actionId!==command.actionId)throw Error('mismatch');request.signal.throwIfAborted();return reply({ok:true,data:history});
   }
   if(command.operation==='preview_deployment'){
    const preview=platformDeploymentPreview.parse(await service.previewDeployment(command.actionId));if(preview.actionId!==command.actionId)throw Error('mismatch');request.signal.throwIfAborted();return reply({ok:true,data:preview});
   }
   if(command.operation==='lookup_deployment'){
    const found=platformPreparationLookupSchema.parse({...await service.lookupDeploymentPreparation(command.requestId),requestId:command.requestId});request.signal.throwIfAborted();return reply({ok:true,data:found});
   }
   const saved=await service.prepareDeployment(command.selection,command.requestId);return reply({ok:true,data:platformPreparationReceiptSchema.parse({...saved,requestId:command.requestId})});
  }catch{return command.operation==='prepare_deployment'?reply({ok:false,error:'platform_deployment_preparation_unconfirmed',recovery:'lookup_original_reference_no_automatic_resubmit'},409):reply({ok:false,error:'platform_deployment_source_unavailable'},409)}
 };
}
