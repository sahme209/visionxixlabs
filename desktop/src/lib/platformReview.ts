import {platformActionId,platformInspectionSchema,type PlatformInspection} from '../../../lib/governance/platform/viewContract';
import {releaseOperationPlanRequest,type ReleasePlanResult} from './releaseOperationPlanTransport';
type Context=Parameters<typeof releaseOperationPlanRequest>[0];
const path='/api/desktop/platform-governance/review';
const fail=():Promise<ReleasePlanResult<PlatformInspection>>=>Promise.resolve({ok:false,error:'Load this exact saved platform action before reviewing.',outcomeUnconfirmed:false});
/** Prepared client only: its server route and customer entry point remain
 * unregistered until the full managed-workflow coverage gate passes. */
export function createPlatformReviewClient(context:Context){
 return {
  inspect(actionId:string,signal?:AbortSignal){
   if(!platformActionId.safeParse(actionId).success)return fail();
   return releaseOperationPlanRequest(context,'POST',path,{operation:'inspect',actionId},(raw):raw is PlatformInspection=>{const parsed=platformInspectionSchema.safeParse(raw);return parsed.success&&parsed.data.actionId===actionId},signal);
  },
  approve(raw:unknown,signal?:AbortSignal){
   const parsed=platformInspectionSchema.safeParse(raw);if(!parsed.success||parsed.data.status!=='proposed'||parsed.data.expired)return fail();
   const saved=parsed.data;
   return releaseOperationPlanRequest(context,'POST',path,{operation:'approve',actionId:saved.actionId,expectedVersion:saved.version,planDigest:saved.plan.digest},(raw):raw is PlatformInspection=>{const next=platformInspectionSchema.safeParse(raw);return next.success&&next.data.actionId===saved.actionId&&next.data.plan.digest===saved.plan.digest&&JSON.stringify(next.data.plan)===JSON.stringify(saved.plan)&&next.data.status==='approved'&&next.data.version===saved.version+1&&next.data.requesterUserId===saved.requesterUserId},signal);
  },
 };
}
export type PlatformReviewClient=ReturnType<typeof createPlatformReviewClient>;
