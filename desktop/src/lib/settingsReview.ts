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

import {settingsReviewCommand,settingsPreparationReceipt,settingsPreparationLookup,type SettingsPreparationReceipt,type SettingsPreparationLookup} from '../../../lib/governance/platform/operations/settingsReviewContract';
/** Caller retains original UUID before save. No automatic save/renew/retry. */
export function createSettingsPreparationClient(context:Context){return {
 async prepare(selection:unknown,requestId:string,signal?:AbortSignal):Promise<ReleasePlanResult<SettingsPreparationReceipt>>{
  const parsed=settingsReviewCommand.safeParse({operation:'prepare',selection,requestId});
  if(!parsed.success||parsed.data.operation!=='prepare'||Date.parse(parsed.data.selection.expiresAt)<=Date.now())return {ok:false,error:'Select exact create-only metadata and retain the original request reference.',outcomeUnconfirmed:false};
  const command=parsed.data;
  return releaseOperationPlanRequest(context,'POST',path,command,(raw):raw is SettingsPreparationReceipt=>{const p=settingsPreparationReceipt.safeParse(raw);return p.success&&p.data.requestId===command.requestId},signal);
 },
 async lookup(requestId:string,signal?:AbortSignal):Promise<ReleasePlanResult<SettingsPreparationLookup>>{
  const parsed=settingsReviewCommand.safeParse({operation:'lookup',requestId});if(!parsed.success||parsed.data.operation!=='lookup')return {ok:false,error:'Keep the original settings request reference.',outcomeUnconfirmed:false};const command=parsed.data;
  return releaseOperationPlanRequest(context,'POST',path,command,(raw):raw is SettingsPreparationLookup=>{const p=settingsPreparationLookup.safeParse(raw);return p.success&&p.data.requestId===command.requestId},signal);
 },
}}
export type SettingsPreparationClient=ReturnType<typeof createSettingsPreparationClient>;

import {settingsArtifactSaveCommand,settingsArtifactReceipt,type SettingsArtifactReceipt} from '../../../lib/governance/platform/operations/settingsArtifactClientContract';
/** Separate one-attempt intake. No persistence, logging, review or send control.
 * JavaScript strings cannot promise physical memory zeroization. */
export function createSettingsArtifactClient(context:Context){return {
 async save(raw:unknown,effectIndex:number,value:string,signal?:AbortSignal):Promise<ReleasePlanResult<SettingsArtifactReceipt>>{
  const parsed=settingsReviewPreview.safeParse(raw),config=context.getConfig();let secure=false;try{const u=new URL(config.apiBase);secure=u.protocol==='https:'&&!u.username&&!u.password&&u.origin===config.apiBase}catch{/* unavailable */}
  const setting=parsed.success?parsed.data.settings[effectIndex]:undefined;
  if(!secure||!parsed.success||!setting||setting.artifactStatus!=='missing'||Date.parse(parsed.data.expiresAt)<=Date.now())return {ok:false,error:'Load the exact missing artifact on the secure paired service first.',outcomeUnconfirmed:false};
  const saved=parsed.data,command=settingsArtifactSaveCommand.safeParse({operation:'save',actionId:saved.actionId,expectedVersion:0,planDigest:saved.planDigest,effectIndex,value});
  if(!command.success)return {ok:false,error:'The protected value is invalid or exceeds its bounded size.',outcomeUnconfirmed:false};
  return releaseOperationPlanRequest(context,'POST','/api/desktop/platform-governance/settings-artifacts',command.data,(raw):raw is SettingsArtifactReceipt=>{const p=settingsArtifactReceipt.safeParse(raw);return p.success&&p.data.actionId===saved.actionId&&p.data.effectIndex===effectIndex&&p.data.artifactId===setting.artifactId&&p.data.profileId===saved.profileId&&p.data.expiresAt===saved.expiresAt&&p.data.target.projectId===saved.target.projectId&&p.data.target.teamId===saved.target.teamId&&p.data.target.name===setting.name&&p.data.target.environment===setting.environment&&p.data.target.type===setting.type&&p.data.target.sensitivity===setting.sensitivity},signal);
 },
}}
export type SettingsArtifactClient=ReturnType<typeof createSettingsArtifactClient>;
