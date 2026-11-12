import {platformSourceCommand,platformSourcePage,type PlatformSourceKind,type PlatformSourcePage} from '../../../lib/governance/platform/sourceCatalog';
import {platformHistoryCommand,platformHistoryPage,historyEntryBefore,type PlatformHistoryCursor,type PlatformHistoryPage} from '../../../lib/governance/platform/historyContract';
import {platformPreparationCommandSchema,platformPreparationReceiptSchema,platformPreparationLookupSchema,type PlatformPreparationReceipt,type PlatformPreparationLookup} from '../../../lib/governance/platform/preparationContract';
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
/** Proposal-only client. Callers must retain a request UUID BEFORE sending;
 * uncertainty is recovered with lookup, never an automatic save retry. */
export function createPlatformPreparationClient(context:Context){
 return {
  prepare(raw:unknown,requestId:string,signal?:AbortSignal):Promise<ReleasePlanResult<PlatformPreparationReceipt>>{
   const command=platformPreparationCommandSchema.safeParse({operation:'prepare_growth',requestId,selection:raw});
   if(!command.success)return Promise.resolve({ok:false,error:'Select exact source fields and keep the original request reference.',outcomeUnconfirmed:false});
   const selected=command.data;
   return releaseOperationPlanRequest(context,'POST','/api/desktop/platform-governance/prepare',selected,(raw):raw is PlatformPreparationReceipt=>{const parsed=platformPreparationReceiptSchema.safeParse(raw);return parsed.success&&parsed.data.requestId===selected.requestId},signal);
  },
  lookup(requestId:string,signal?:AbortSignal):Promise<ReleasePlanResult<PlatformPreparationLookup>>{
   const command=platformPreparationCommandSchema.safeParse({operation:'lookup_preparation',requestId});
   if(!command.success)return Promise.resolve({ok:false,error:'Keep the original request reference for read-only lookup.',outcomeUnconfirmed:false});
   const selected=command.data;
   return releaseOperationPlanRequest(context,'POST','/api/desktop/platform-governance/prepare',selected,(raw):raw is PlatformPreparationLookup=>{const parsed=platformPreparationLookupSchema.safeParse(raw);return parsed.success&&parsed.data.requestId===selected.requestId},signal);
  },
 };
}
export type PlatformPreparationClient=ReturnType<typeof createPlatformPreparationClient>;

/** Historical discovery only, with fixed page size and no write operation. */
export function createPlatformHistoryClient(context:Context){
 return {list(cursor:PlatformHistoryCursor|null,signal?:AbortSignal):Promise<ReleasePlanResult<PlatformHistoryPage>>{
  const selected=platformHistoryCommand.safeParse({operation:'list_history',cursor});
  if(!selected.success)return Promise.resolve({ok:false,error:'Select a valid saved history page.',outcomeUnconfirmed:false});
  return releaseOperationPlanRequest(context,'POST','/api/desktop/platform-governance/history',selected.data,(raw):raw is PlatformHistoryPage=>{const page=platformHistoryPage.safeParse(raw);return page.success&&(!selected.data.cursor||page.data.entries.every(e=>historyEntryBefore(e,selected.data.cursor!)))},signal);
 }};
}

/** Read-only discovery; a catalog label never grants execution eligibility. */
export function createPlatformSourceClient(context:Context){
 return {list(kind:PlatformSourceKind,cursor:string|null,signal?:AbortSignal):Promise<ReleasePlanResult<PlatformSourcePage>>{
  const selected=platformSourceCommand.safeParse({operation:'list_sources',kind,cursor});
  if(!selected.success)return Promise.resolve({ok:false,error:'Select a valid source page.',outcomeUnconfirmed:false});
  return releaseOperationPlanRequest(context,'POST','/api/desktop/platform-governance/sources',selected.data,(raw):raw is PlatformSourcePage=>{const page=platformSourcePage.safeParse(raw);return page.success&&page.data.kind===selected.data.kind&&(!selected.data.cursor||page.data.entries.every(e=>e.id<selected.data.cursor!))},signal);
 }};
}
export type PlatformSourceClient=ReturnType<typeof createPlatformSourceClient>;
