import 'server-only';
import {readBoundedRequestJson} from '@/lib/api/readBoundedRequestJson';
import {createDefaultPlatformRequestService} from './requestService';
import {platformTemplatePreparationCommand} from './templateContract';
import {platformPreparationReceiptSchema,platformPreparationLookupSchema} from './preparationContract';
type Service=Pick<Awaited<ReturnType<typeof createDefaultPlatformRequestService>>,'prepareTemplate'|'lookupTemplatePreparation'>;
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
/** Prepared/unregistered proposal/reference endpoint. No approve/claim/send. */
export function createPlatformTemplatePreparationHttp(factory:(request:Request)=>Promise<Service>=createDefaultPlatformRequestService){
 return async(request:Request)=>{
  if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
  let service:Service;try{service=await factory(request)}catch{return reply({ok:false,error:'platform_requester_unavailable'},401)}
  let command;try{command=platformTemplatePreparationCommand.parse(await readBoundedRequestJson(request,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]),4096))}catch{return reply({ok:false,error:'invalid_platform_template_request'},400)}
  try{
   request.signal.throwIfAborted();
   if(command.operation==='lookup_template'){
    const found=platformPreparationLookupSchema.parse({...await service.lookupTemplatePreparation(command.requestId),requestId:command.requestId});request.signal.throwIfAborted();return reply({ok:true,data:found});
   }
   const saved=await service.prepareTemplate(command.selection,command.requestId);return reply({ok:true,data:platformPreparationReceiptSchema.parse({...saved,requestId:command.requestId})});
  }catch{return command.operation==='prepare_template'?reply({ok:false,error:'platform_template_preparation_unconfirmed',recovery:'lookup_original_reference_no_automatic_resubmit'},409):reply({ok:false,error:'platform_template_reference_unavailable'},409)}
 };
}
