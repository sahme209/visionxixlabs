import 'server-only';
import {readBoundedRequestJson} from '@/lib/api/readBoundedRequestJson';
import {createDefaultPlatformRequestService} from './requestService';
import {platformPreparationCommandSchema,platformPreparationReceiptSchema,platformPreparationLookupSchema} from './preparationContract';
type Service=Pick<Awaited<ReturnType<typeof createDefaultPlatformRequestService>>,'prepareGrowth'|'lookupGrowthPreparation'>;
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
/** Prepared default composition, NOT route-registered. Mandatory correlation
 * cannot create authority; lookup never saves, refreshes or executes anything. */
export function createPlatformPreparationHttp(createService:(request:Request)=>Promise<Service>=createDefaultPlatformRequestService){
 return async(request:Request)=>{
  if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
  let service:Service;
  try{service=await createService(request)}catch{return reply({ok:false,error:'platform_requester_unavailable'},401)}
  let command;
  try{command=platformPreparationCommandSchema.parse(await readBoundedRequestJson(request,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]),4096))}catch{return reply({ok:false,error:'invalid_platform_preparation_request'},400)}
  if(command.operation==='lookup_preparation'){
   try{const found=await service.lookupGrowthPreparation(command.requestId);return reply({ok:true,data:platformPreparationLookupSchema.parse({...found,requestId:command.requestId})})}catch{return reply({ok:false,error:'platform_preparation_lookup_unavailable'},409)}
  }
  try{
   request.signal.throwIfAborted();const saved=await service.prepareGrowth(command.selection,command.requestId);
   // This receipt deliberately omits source content and any execution signal.
   return reply({ok:true,data:platformPreparationReceiptSchema.parse({requestId:command.requestId,actionId:saved.actionId,historical:saved.historical,authority:saved.authority})});
  }catch{return reply({ok:false,error:'platform_preparation_outcome_unconfirmed',recovery:'lookup_same_request_no_automatic_resubmit'},409)}
 };
}
