import {operationalEcsPlanInput} from '../../../lib/governance/platform/operations/ecsPlanInput';
import {ecsReviewPreview,ecsReviewDecision,ecsDelegationReceipt,type EcsDelegationReceipt,type EcsReviewPreview,type EcsReviewDecision} from '../../../lib/governance/platform/operations/ecsReviewContract';
import {platformActionId} from '../../../lib/governance/platform/viewContract';
import {releaseOperationPlanRequest,type ReleasePlanResult} from './releaseOperationPlanTransport';
type Context=Parameters<typeof releaseOperationPlanRequest>[0];
const path='/api/desktop/platform-governance/operations';
function normalize(value:unknown):unknown{if(Array.isArray(value))return value.map(normalize);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,child])=>[key,normalize(child)]));return value}
async function hash(value:unknown){
 const bytes=new TextEncoder().encode(JSON.stringify(normalize(value)));
 const result=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(result),b=>b.toString(16).padStart(2,'0')).join('');
}
async function exact(preview:EcsReviewPreview){try{const {digest,authority:ignoredAuthority,executionAuthorized:ignoredExecution,...manifest}=preview.manifest;return await hash({kind:'operational_manifest_v1',manifest})===digest&&await hash({kind:'platform_governance_plan_v1',...operationalEcsPlanInput(preview.manifest)})===preview.planDigest}catch{return false}}
function owner(context:Context,signal?:AbortSignal){const config=context.getConfig(),revision=context.getRevision(),apiBase=config.apiBase,token=config.sessionToken;return ()=>!signal?.aborted&&context.getConfig()===config&&context.getRevision()===revision&&config.apiBase===apiBase&&config.sessionToken===token}
/** Prepared exact review only, not mounted. No workload claim, credential,
 * execution, delegation, automatic decision or replay operation. */
export function createOperationalReviewClient(context:Context){return {
 async preview(actionId:string,signal?:AbortSignal):Promise<ReleasePlanResult<EcsReviewPreview>>{
  const owns=owner(context,signal);
  if(!platformActionId.safeParse(actionId).success)return Promise.resolve({ok:false,error:'Load the original operational action reference.',outcomeUnconfirmed:false});
  const response=await releaseOperationPlanRequest(context,'POST',path,{operation:'preview',actionId},(raw):raw is EcsReviewPreview=>{const result=ecsReviewPreview.safeParse(raw);return result.success&&result.data.actionId===actionId},signal);
  return response.ok&&(!await exact(response.data)||!owns())?{ok:false,error:'The returned source does not match its saved digests.',outcomeUnconfirmed:false}:response;
 },
 async review(raw:unknown,signal?:AbortSignal):Promise<ReleasePlanResult<EcsReviewDecision>>{
  const owns=owner(context,signal);
  const parsed=ecsReviewPreview.safeParse(raw);if(!parsed.success||!await exact(parsed.data)||!owns()||parsed.data.status!=='proposed'||Date.parse(parsed.data.manifest.expiresAt)<=Date.now())return Promise.resolve({ok:false,error:'Load and review the exact current ECS proposal first.',outcomeUnconfirmed:false});
  const saved=parsed.data;
  return releaseOperationPlanRequest(context,'POST',path,{operation:'review',actionId:saved.actionId,expectedVersion:saved.version,planDigest:saved.planDigest},(raw):raw is EcsReviewDecision=>{const next=ecsReviewDecision.safeParse(raw);return next.success&&next.data.actionId===saved.actionId&&next.data.planDigest===saved.planDigest},signal);
 },
}}
export type OperationalReviewClient=ReturnType<typeof createOperationalReviewClient>;

/** Separate original-requester confirmation. It delegates only to the already
 * approved exact run; it never dispatches a workflow or issues credentials. */
export function createOperationalDelegationClient(context:Context){const reader=createOperationalReviewClient(context);return {
 preview:reader.preview,
 async delegate(raw:unknown,signal?:AbortSignal):Promise<ReleasePlanResult<EcsDelegationReceipt>>{
  const owns=owner(context,signal),parsed=ecsReviewPreview.safeParse(raw);
  if(!parsed.success||!await exact(parsed.data)||!owns()||parsed.data.status!=='approved'||parsed.data.delegationState!=='not_delegated'||Date.parse(parsed.data.manifest.expiresAt)<=Date.now())return {ok:false,error:'Load the exact approved run before confirming delegation.',outcomeUnconfirmed:false};
  const saved=parsed.data;
  return releaseOperationPlanRequest(context,'POST',path,{operation:'delegate',actionId:saved.actionId,expectedVersion:saved.version,planDigest:saved.planDigest},(raw):raw is EcsDelegationReceipt=>{
   const result=ecsDelegationReceipt.safeParse(raw);return result.success&&result.data.actionId===saved.actionId&&result.data.requesterUserId===saved.requesterUserId&&result.data.reviewerUserId===saved.reviewerUserId&&JSON.stringify(normalize(result.data.manifest))===JSON.stringify(normalize(saved.manifest));
  },signal);
 },
}}
export type OperationalDelegationClient=ReturnType<typeof createOperationalDelegationClient>;

import {ecsHistory,type EcsHistory} from '../../../lib/governance/platform/operations/ecsHistoryContract';
/** Original history only; expired source never becomes renewed authority. */
export function createOperationalHistoryClient(context:Context){return {
 async inspect(actionId:string,signal?:AbortSignal):Promise<ReleasePlanResult<EcsHistory>>{
  const owns=owner(context,signal);
  if(!platformActionId.safeParse(actionId).success)return {ok:false,error:'Load the original operational action reference.',outcomeUnconfirmed:false};
  const response=await releaseOperationPlanRequest(context,'POST',path,{operation:'inspect',actionId},(raw):raw is EcsHistory=>{const p=ecsHistory.safeParse(raw);return p.success&&p.data.actionId===actionId},signal);
  if(!response.ok)return response;
  const {digest,authority:ignoredAuthority,executionAuthorized:ignoredExecution,...manifest}=response.data.manifest;
  const result=response.data.result;let resultMatches=true;
  if(result){const {receiptDigest,...fields}=result;resultMatches=await hash(fields)===receiptDigest}
  if(!resultMatches||await hash({kind:'operational_manifest_v1',manifest})!==digest||!owns())return {ok:false,error:'The returned history does not match its original record.',outcomeUnconfirmed:false};
  return response;
 },
}}
export type OperationalHistoryClient=ReturnType<typeof createOperationalHistoryClient>;

import {operationalCommand} from '../../../lib/governance/platform/operations/operationalCommand';
import {ecsPreparationReceipt,ecsPreparationLookup} from '../../../lib/governance/platform/operations/ecsPreparationClientContract';
const preparationUnavailable=()=>({ok:false as const,error:'Keep the exact original run and request reference. No proposal was submitted.',outcomeUnconfirmed:false});
/** Proposal recording and original-reference recovery only. No decision,
 * delegation, credential, workflow dispatch or automatic retry. */
export function createOperationalPreparationClient(context:Context){return {
 async prepare(selection:unknown,requestId:string,signal?:AbortSignal){
  const owns=owner(context,signal),command=operationalCommand.safeParse({operation:'prepare',selection,requestId});if(!command.success||command.data.operation!=='prepare'||Date.parse(command.data.selection.expiresAt)<=Date.now())return preparationUnavailable();
  const reference=command.data.requestId.toLowerCase();try{const manifest=command.data.selection,digest=await hash({kind:'operational_manifest_v1',manifest}),metadata={...manifest,digest,authority:'metadata_only' as const,executionAuthorized:false as const},planDigest=await hash({kind:'platform_governance_plan_v1',...operationalEcsPlanInput(metadata)});if(!owns())return preparationUnavailable();return releaseOperationPlanRequest(context,'POST',path,command.data,(raw):raw is import('zod').infer<typeof ecsPreparationReceipt>=>{const p=ecsPreparationReceipt.safeParse(raw);return p.success&&p.data.requestId===reference&&p.data.planDigest===planDigest},signal)}catch{return preparationUnavailable()}
 },
 async lookup(requestId:string,signal?:AbortSignal){const command=operationalCommand.safeParse({operation:'lookup',requestId});if(!command.success||command.data.operation!=='lookup')return preparationUnavailable();const reference=command.data.requestId.toLowerCase();return releaseOperationPlanRequest(context,'POST',path,command.data,(raw):raw is import('zod').infer<typeof ecsPreparationLookup>=>{const p=ecsPreparationLookup.safeParse(raw);return p.success&&p.data.requestId===reference},signal)},
}}
export type OperationalPreparationClient=ReturnType<typeof createOperationalPreparationClient>;
