import 'server-only';
import {z} from 'zod';
import {platformReviewCommandSchema} from './viewContract';
import {readBoundedRequestJson} from '@/lib/api/readBoundedRequestJson';
import {createDefaultPlatformRequestService} from './requestService';
const command=platformReviewCommandSchema;
type Service=Pick<Awaited<ReturnType<typeof createDefaultPlatformRequestService>>,'inspect'|'previewGrowth'|'review'>;
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
/** Prepared default HTTP composition, intentionally NOT registered as a route.
 * No proposal/claim/observation/provider operation is accepted here. Enabling
 * any public workflow remains gated on complete managed-family coverage. */
export function createPlatformReviewHttp(createService:(request:Request)=>Promise<Service>=createDefaultPlatformRequestService){
 return async(request:Request)=>{
  if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
  let service:Service;
  try{service=await createService(request)}catch{return reply({ok:false,error:'platform_reader_unavailable'},401)}
  let body:z.infer<typeof command>;
  try{const signal=AbortSignal.any([request.signal,AbortSignal.timeout(5000)]);body=command.parse(await readBoundedRequestJson(request,signal,4096))}catch{return reply({ok:false,error:'invalid_platform_review_request'},400)}
  if(body.operation==='preview'){
   try{return reply({ok:true,data:await service.previewGrowth(body.actionId)})}catch{return reply({ok:false,error:'platform_source_preview_unavailable'},409)}
  }
  if(body.operation==='inspect'){
   try{return reply({ok:true,data:await service.inspect(body.actionId)})}catch{return reply({ok:false,error:'platform_history_unavailable'},409)}
  }
  try{
   await service.review(body.actionId,body.expectedVersion,body.planDigest);
   return reply({ok:true,data:await service.inspect(body.actionId)});
  }catch{
   // A lost commit/response is not proof no decision was recorded. The client
   // must read the same record, never automatically resubmit the decision.
   return reply({ok:false,error:'platform_decision_outcome_unconfirmed',recovery:'inspect_same_action_no_automatic_retry'},409);
  }
 };
}
