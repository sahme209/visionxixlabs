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

import {settingsHistory,type SettingsHistory} from '../../../lib/governance/platform/operations/settingsReviewContract';
function normalize(value:unknown):unknown{if(Array.isArray(value))return value.map(normalize);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,child])=>[key,normalize(child)]));return value}
async function hash(value:unknown){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(normalize(value))));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}
/** Original result metadata; never decrypts, renews, claims or resends. */
export function createSettingsHistoryClient(context:Context){return {
 async inspect(actionId:string,signal?:AbortSignal):Promise<ReleasePlanResult<SettingsHistory>>{
  const config=context.getConfig(),revision=context.getRevision();
  if(!platformActionId.safeParse(actionId).success)return {ok:false,error:'Load the original settings action reference.',outcomeUnconfirmed:false};
  const response=await releaseOperationPlanRequest(context,'POST',path,{operation:'inspect',actionId},(raw):raw is SettingsHistory=>{const p=settingsHistory.safeParse(raw);return p.success&&p.data.actionId===actionId},signal);
  if(!response.ok)return response;
  try{for(const result of response.data.results){const {receiptDigest,...fields}=result;if(await hash(fields)!==receiptDigest)throw Error('mismatched')}if(signal?.aborted||context.getConfig()!==config||context.getRevision()!==revision)throw Error('changed');return response}
  catch{return {ok:false,error:'Original settings history could not be verified. No action was submitted.',outcomeUnconfirmed:false}}
 },
}}
export type SettingsHistoryClient=ReturnType<typeof createSettingsHistoryClient>;
