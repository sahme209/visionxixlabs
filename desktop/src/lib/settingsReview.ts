import {settingsReviewPreview,settingsReviewDecision,type SettingsReviewPreview,type SettingsReviewDecision} from '../../../lib/governance/platform/operations/settingsReviewContract';
import {platformActionId} from '../../../lib/governance/platform/viewContract';
import {releaseOperationPlanRequest,type ReleasePlanResult} from './releaseOperationPlanTransport';
type Context=Parameters<typeof releaseOperationPlanRequest>[0];
const path='/api/desktop/platform-governance/settings';
/** Prepared metadata/decision only. No value intake, claim or provider send. */
export function createSettingsReviewClient(context:Context){return {
 async preview(actionId:string,signal?:AbortSignal):Promise<ReleasePlanResult<SettingsReviewPreview>>{
  if(!platformActionId.safeParse(actionId).success)return {ok:false,error:'Load the original settings action reference.',outcomeUnconfirmed:false};
  return releaseOperationPlanRequest(context,'POST',path,{operation:'preview',actionId},(raw):raw is SettingsReviewPreview=>{const parsed=settingsReviewPreview.safeParse(raw);return parsed.success&&parsed.data.actionId===actionId},signal);
 },
 async review(raw:unknown,signal?:AbortSignal):Promise<ReleasePlanResult<SettingsReviewDecision>>{
  const parsed=settingsReviewPreview.safeParse(raw);
  if(!parsed.success||!parsed.data.reviewReady||Date.parse(parsed.data.expiresAt)<=Date.now())return {ok:false,error:'Load the exact current settings metadata with every artifact saved before reviewing.',outcomeUnconfirmed:false};
  const saved=parsed.data;
  return releaseOperationPlanRequest(context,'POST',path,{operation:'review',actionId:saved.actionId,expectedVersion:saved.version,planDigest:saved.planDigest},(raw):raw is SettingsReviewDecision=>{const p=settingsReviewDecision.safeParse(raw);return p.success&&p.data.actionId===saved.actionId&&p.data.planDigest===saved.planDigest},signal);
 },
}}
export type SettingsReviewClient=ReturnType<typeof createSettingsReviewClient>;
