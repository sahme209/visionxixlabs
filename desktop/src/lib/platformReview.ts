import {platformActionId,platformInspectionSchema,platformGrowthPreviewSchema,type PlatformInspection,type PlatformGrowthPreview} from '../../../lib/governance/platform/viewContract';
import {releaseOperationPlanRequest,type ReleasePlanResult} from './releaseOperationPlanTransport';
type Context=Parameters<typeof releaseOperationPlanRequest>[0];
const path='/api/desktop/platform-governance/review';
const fail=():Promise<ReleasePlanResult<PlatformInspection>>=>Promise.resolve({ok:false,error:'Load this exact saved platform action before reviewing.',outcomeUnconfirmed:false});
/** Prepared client only: its server route and customer entry point remain
 * unregistered until the full managed-workflow coverage gate passes. */
export function createPlatformReviewClient(context:Context){
 return {
  preview(raw:unknown,signal?:AbortSignal){
   const selected=platformInspectionSchema.safeParse(raw);
   if(!selected.success||!['proposed','approved'].includes(selected.data.status)||selected.data.expired||selected.data.plan.effects.length!==1||!['growth.post.publish','growth.schedule.change','growth.post.delete'].includes(selected.data.plan.effects[0].kind))return Promise.resolve({ok:false as const,error:'Load a supported exact current action for source preview.',outcomeUnconfirmed:false});
   const saved=selected.data,effect=saved.plan.effects[0];if(effect.kind!=='growth.post.publish'&&effect.kind!=='growth.schedule.change'&&effect.kind!=='growth.post.delete')return Promise.resolve({ok:false as const,error:'Select a supported source preview.',outcomeUnconfirmed:false});
   return releaseOperationPlanRequest(context,'POST',path,{operation:'preview',actionId:saved.actionId},(raw):raw is PlatformGrowthPreview=>{const next=platformGrowthPreviewSchema.safeParse(raw);return next.success&&next.data.actionId===saved.actionId&&next.data.planDigest===saved.plan.digest&&next.data.sourceDigest===saved.plan.sourceDigest&&next.data.effectId===effect.id&&(effect.kind==='growth.post.delete'?next.data.renderedPost===undefined:next.data.renderedPost!==undefined&&JSON.parse(next.data.renderedPost).author===effect.target.author)},signal);
  },
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
/** Separate requester surface: inspection is read-only; execution is one
 * exact saved reference. There is no approval or retry operation here. */
export function createPlatformExecutionClient(context:Context){
 const reader=createPlatformReviewClient(context);
 return {inspect:reader.inspect,preview:reader.preview,
  execute(raw:unknown,signal?:AbortSignal){
   const parsed=platformInspectionSchema.safeParse(raw);
   if(!parsed.success||parsed.data.status!=='approved'||parsed.data.version!==1||parsed.data.expired||Date.parse(parsed.data.plan.expiresAt)<=Date.now()||parsed.data.plan.effects.length!==1||!['growth.post.publish','growth.schedule.change','growth.post.delete'].includes(parsed.data.plan.effects[0].kind))return Promise.resolve({ok:false as const,error:'Inspect this exact supported approved action before execution.',outcomeUnconfirmed:false});
   const saved=parsed.data;
   return releaseOperationPlanRequest(context,'POST','/api/desktop/platform-governance/execute',{operation:'execute',actionId:saved.actionId,expectedVersion:1,planDigest:saved.plan.digest},(raw):raw is PlatformInspection=>{const result=platformInspectionSchema.safeParse(raw);return result.success&&result.data.actionId===saved.actionId&&result.data.status==='confirmed'&&result.data.attemptCount===1&&JSON.stringify(result.data.plan)===JSON.stringify(saved.plan)&&result.data.requesterUserId===saved.requesterUserId},signal);
  },
 };
}
export type PlatformExecutionClient=ReturnType<typeof createPlatformExecutionClient>;
