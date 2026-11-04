import 'server-only';
import {randomUUID} from 'node:crypto';
import {Prisma,type PrismaClient} from '@prisma/client';
import {codingRequestQuoteProtocol,parseStoredCodingQuoteEvidence,type CodingQuoteProtocol,type CodingQuote,type CodingReservationQuote,type PreparedCodingRequest,type CodingQuoteEvidence} from '@/lib/ai/codingRequestQuote';

declare const claimBrand:unique symbol;
export type CodingRunClaim={readonly [claimBrand]:true};
type Binding=Readonly<{organizationId:string;runId:string;stageRunId:string;actorId:string;correlationId:string;generation:string}>;
const claims=new WeakMap<object,Binding>();
export function codingBudgetUnavailable():never{throw Error('coding_run_budget_unavailable');}
/** The issuer owns the actual CAS. No caller context can manufacture this handle. */
export async function claimCodingRunStage(repo:Pick<PrismaClient,'$transaction'>,organizationId:string,runId:string,stageRunId:string):Promise<CodingRunClaim|null>{
 return repo.$transaction(async tx=>{
  const rows=await tx.$queryRawUnsafe<Array<{id:string;organizationId:string;pipelineId:string;status:string;triggeredBy:string;correlationId:string}>>('SELECT id,"organizationId","pipelineId",status,"triggeredBy","correlationId" FROM "PipelineRun" WHERE id=$1 AND "organizationId"=$2 FOR UPDATE',runId,organizationId);
  const run=rows[0];if(rows.length!==1||!run||run.status!=='running'||run.pipelineId!=='ai_coding'||run.triggeredBy.startsWith('api_key:')||run.triggeredBy.startsWith('system:'))return null;
  const generation=randomUUID();
  const changed=await tx.pipelineStageRun.updateMany({where:{id:stageRunId,runId,stageKind:'code_propose',status:'queued',aiClaimGeneration:null,startedAt:null},data:{status:'running',startedAt:new Date(),aiClaimGeneration:generation}});
  if(changed.count!==1)return null;
  const handle=Object.freeze({}) as CodingRunClaim;
  claims.set(handle,Object.freeze({organizationId,runId,stageRunId,actorId:run.triggeredBy,correlationId:run.correlationId,generation}));return handle;
 },{isolationLevel:'Serializable'});
}
export function codingClaimBinding(handle:CodingRunClaim|undefined,scope:{organizationId:string;userId:string;correlationId:string}):Binding{
 const b=handle&&claims.get(handle);
 if(!b||b.organizationId!==scope.organizationId||b.actorId!==scope.userId||b.correlationId!==scope.correlationId)codingBudgetUnavailable();return b;
}
/** Common lock order: run, stage, companion, workspace/allocation. */
export async function lockCodingRun(tx:Prisma.TransactionClient,b:Binding){
 const rows=await tx.$queryRawUnsafe<Array<{id:string;organizationId:string;pipelineId:string;status:string;triggeredBy:string;correlationId:string;metadata:Prisma.JsonValue}>>('SELECT id,"organizationId","pipelineId",status,"triggeredBy","correlationId",metadata FROM "PipelineRun" WHERE id=$1 AND "organizationId"=$2 FOR UPDATE',b.runId,b.organizationId);
 const run=rows[0];if(rows.length!==1||!run||run.status!=='running'||run.pipelineId!=='ai_coding'||run.triggeredBy!==b.actorId||run.correlationId!==b.correlationId)codingBudgetUnavailable();
 const stages=await tx.$queryRawUnsafe<Array<{id:string;status:string;stageKind:string;aiClaimGeneration:string|null}>>('SELECT id,status,"stageKind","aiClaimGeneration" FROM "PipelineStageRun" WHERE id=$1 AND "runId"=$2 FOR UPDATE',b.stageRunId,b.runId);
 const stage=stages[0];if(stages.length!==1||!stage||stage.status!=='running'||stage.stageKind!=='code_propose'||stage.aiClaimGeneration!==b.generation)codingBudgetUnavailable();return run;
}

import {reserveAICreditsInTransaction,claimLegacyAICreditDispatch} from '@/lib/billing/aiCreditReservation';
import {claimNewTestBillableDispatch} from '@/lib/billing/newTestSubscription/usageAllocationIO';
import {assertStoredBudgetConfig} from './budgetConfigStore';
import {resolveRunBudgetCap} from './resolveRunBudgetCap';
import {runBudgetExposure,assertRunAdmission} from './codingRunBudget';
import {normalizeStoredWorkspaceAIProviderPolicy,resolveWorkspaceAIProviderPolicy} from '@/lib/ai/workspaceProviderPolicy';
import {effectiveGatewayModel,gatewayModelOutputBoundVerified} from '@/lib/ai/effectiveGatewayModel';
type Scope={organizationId:string;userId:string;correlationId:string};
type Repo=Pick<PrismaClient,'$transaction'>;
type AdmissionRow={admissionContract?:unknown;quoteEvidence?:unknown;organizationId:string;actorId:string;correlationId:string;runId:string;stageRunId:string;claimGeneration:string;phase:string;idempotencyKey:string;estimatedCents:number};
function rowQuoteBinding(c:AdmissionRow){return {organizationId:c.organizationId,userId:c.actorId,correlationId:c.correlationId,runId:c.runId,stageRunId:c.stageRunId,claimGeneration:c.claimGeneration,phase:c.phase,idempotencyKey:c.idempotencyKey};}
function assertStoredCodingAdmission(c:AdmissionRow):CodingQuoteEvidence|null{
 if(!Number.isSafeInteger(c.estimatedCents)||c.estimatedCents<1)codingBudgetUnavailable();
 if(c.admissionContract==='coding_fixed_hold_v1'){if(c.quoteEvidence!==null)codingBudgetUnavailable();return null;}
 if(c.admissionContract!=='coding_request_quote_v1')codingBudgetUnavailable();
 const evidence=parseStoredCodingQuoteEvidence(c.quoteEvidence,rowQuoteBinding(c));
 if(evidence.reservedCents!==c.estimatedCents)codingBudgetUnavailable();return evidence;
}
async function codingDatabaseNow(tx:Prisma.TransactionClient):Promise<Date>{
 const rows=await tx.$queryRawUnsafe<Array<{now:Date}>>("SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now");
 if(rows.length!==1||!(rows[0]?.now instanceof Date)||!Number.isFinite(rows[0].now.getTime()))codingBudgetUnavailable();return rows[0].now;
}
type QuoteClockObservation=Readonly<{db:number;server:number}>;
/** Quote-v1 local admission accepts at most 1000ms DB/server skew. This is a
 * refusal bound, not an assertion that either clock proves provider prices. */
const CODING_QUOTE_MAX_CLOCK_SKEW_MS=1000;
function assertQuoteNow(e:CodingQuoteEvidence,now:Date,previous?:QuoteClockObservation):QuoteClockObservation{
 const server=Date.now(),db=now.getTime();
 if(!Number.isSafeInteger(server)||!Number.isSafeInteger(db)||server<e.quotedAt||server>=e.expiresAt||db<e.quotedAt||db>=e.expiresAt||Math.abs(server-db)>CODING_QUOTE_MAX_CLOCK_SKEW_MS||previous&&(db<previous.db||server<previous.server))codingBudgetUnavailable();
 return Object.freeze({db,server});
}
function assertPreparedClaim(prepared:PreparedCodingRequest,b:Binding,phase:string,key:string){
 const e=prepared.envelope;
 if(e.organizationId!==b.organizationId||e.userId!==b.actorId||e.correlationId!==b.correlationId||e.runId!==b.runId||e.stageRunId!==b.stageRunId||e.claimGeneration!==b.generation||e.phase!==phase||e.idempotencyKey!==key)codingBudgetUnavailable();
}

async function policyAndExposure(tx:Prisma.TransactionClient,b:Binding,model:string,proposed:number){
 const run=await lockCodingRun(tx,b);
 const config=await tx.organizationBudgetConfig.findUnique({where:{organizationId:b.organizationId}});
 if(config)assertStoredBudgetConfig(config);
 const cap=resolveRunBudgetCap({pipelineId:run.pipelineId,runMetadata:run.metadata as Record<string,unknown>|null,orgConfig:config?{defaultMaxCostCents:config.defaultMaxCostCents,pipelineOverrides:config.pipelineOverrides as {pipelineId:string;maxCostCents:number|null}[]}:null});
 const stored=await tx.organizationAIProviderPolicy.findUnique({where:{organizationId:b.organizationId},select:{enabled:true,allowedProviders:true,modelSelections:true,fallbackOrder:true}});
 const policy=resolveWorkspaceAIProviderPolicy({stored:stored?normalizeStoredWorkspaceAIProviderPolicy(stored):null,serviceEnabled:['vercel_gateway']});
 const selected=effectiveGatewayModel({modelSelection:policy.modelSelections.vercel_gateway,defaultModel:process.env.AI_GATEWAY_MODEL});
 if(!policy.enabled||!policy.allowedProviders.includes('vercel_gateway')||!gatewayModelOutputBoundVerified(selected)||selected!==model)codingBudgetUnavailable();
 const members=await tx.$queryRawUnsafe<Array<{acceptedAt:Date|null}>>('SELECT "acceptedAt" FROM "OrgMembership" WHERE "organizationId"=$1 AND "userId"=$2 FOR SHARE',b.organizationId,b.actorId);
 if(members.length!==1||!(members[0]?.acceptedAt instanceof Date))codingBudgetUnavailable();
 const calls=await tx.pipelineAICallReservation.findMany({where:{runId:b.runId},take:4097});
 const stages=await tx.pipelineStageRun.findMany({where:{runId:b.runId},take:4097});
 if(calls.length>4096||stages.length>4096)codingBudgetUnavailable();
 // Old performed coding stages without exact durable call ownership cannot be reconstructed.
 if(stages.some(s=>s.stageKind==='code_propose'&&s.id!==b.stageRunId&&s.status!=='queued'&&!calls.some(c=>c.stageRunId===s.id)))codingBudgetUnavailable();
 await validateCodingRows(tx,b.organizationId,b.runId,calls,stages);
 const exposure=runBudgetExposure(calls,stages.map(s=>({costCents:s.costCents,linked:calls.some(c=>c.stageRunId===s.id)})));
 assertRunAdmission(exposure,proposed,cap.maxCents);return cap;
}
export async function reserveCodingCall(repo:Repo,handle:CodingRunClaim|undefined,scope:Scope,input:{idempotencyKey:string;phase:'initial'|'refinement';model:string;estimatedCents:number},
 /** Owned fixture composition only; must derive the existing verified plan from this transaction. Production omits. */
 isolatedVerifiedPlan?:Parameters<typeof reserveAICreditsInTransaction>[3]){
 const b=codingClaimBinding(handle,scope);
 return repo.$transaction(async tx=>{
  const cap=await policyAndExposure(tx,b,input.model,input.estimatedCents);
  if(!['initial','refinement'].includes(input.phase))codingBudgetUnavailable();
  const prior=await tx.pipelineAICallReservation.findUnique({where:{organizationId_stageRunId_phase:{organizationId:b.organizationId,stageRunId:b.stageRunId,phase:input.phase}}});
  if(prior)codingBudgetUnavailable();
  if(input.phase==='refinement'&&!await tx.pipelineAICallReservation.findFirst({where:{organizationId:b.organizationId,stageRunId:b.stageRunId,phase:'initial',status:{in:['pending_settlement','settled']}}}))codingBudgetUnavailable();
  const held=await reserveAICreditsInTransaction(tx,{organizationId:b.organizationId,idempotencyKey:input.idempotencyKey,reservedCents:input.estimatedCents,correlationId:b.correlationId},new Date(),isolatedVerifiedPlan);
  if(!held.ok||held.reused)throw Error(held.ok?'request_already_reserved':held.error);
  const data={organizationId:b.organizationId,runId:b.runId,stageRunId:b.stageRunId,phase:input.phase,claimGeneration:b.generation,idempotencyKey:input.idempotencyKey,workspaceReservationId:held.reservation.id,actorId:b.actorId,correlationId:b.correlationId,estimatedCents:input.estimatedCents,admissionContract:'coding_fixed_hold_v1',quoteEvidence:Prisma.DbNull,capCents:cap.maxCents,capSource:cap.source,allocationPolicy:held.allocationPolicy??null};
  const call=await tx.pipelineAICallReservation.create({data});
  return {...held,callId:call.id};
 },{isolationLevel:'Serializable'});
}
export async function dispatchCodingCall(repo:Repo,handle:CodingRunClaim|undefined,scope:Scope,callId:string,model:string){
 const b=codingClaimBinding(handle,scope);
 return repo.$transaction(async tx=>{
  await policyAndExposure(tx,b,model,0);
  const call=await tx.pipelineAICallReservation.findUnique({where:{id:callId}});
  if(!call||call.organizationId!==b.organizationId||call.runId!==b.runId||call.stageRunId!==b.stageRunId||call.claimGeneration!==b.generation||call.actorId!==b.actorId||call.status!=='reserved'||call.usageEventId!==null)codingBudgetUnavailable();
  assertStoredCodingAdmission(call as unknown as AdmissionRow);
  if((call as unknown as AdmissionRow).admissionContract!=='coding_fixed_hold_v1')codingBudgetUnavailable();
  const ok=call.allocationPolicy==='axiom_test_anniversary_v2'?await claimNewTestBillableDispatch(tx,scope,call.workspaceReservationId):await claimLegacyAICreditDispatch(tx,scope,call.workspaceReservationId);
  if(!ok)codingBudgetUnavailable();
  const changed=await tx.pipelineAICallReservation.updateMany({where:{id:call.id,status:'reserved',usageEventId:null},data:{status:'dispatch_unknown',dispatchedAt:new Date()}});
  if(changed.count!==1)codingBudgetUnavailable();return true;
 },{isolationLevel:'Serializable'});
}
export async function releaseCodingCall(repo:Repo,handle:CodingRunClaim|undefined,scope:Scope,callId:string){
 const b=codingClaimBinding(handle,scope);
 return repo.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT id FROM "PipelineRun" WHERE id=$1 AND "organizationId"=$2 FOR UPDATE',b.runId,b.organizationId);
  const call=await tx.pipelineAICallReservation.findUnique({where:{id:callId}});
  if(!call||call.runId!==b.runId||call.stageRunId!==b.stageRunId||call.claimGeneration!==b.generation||call.actorId!==b.actorId||call.status!=='reserved'||call.dispatchedAt||call.usageEventId)codingBudgetUnavailable();
  assertStoredCodingAdmission(call as unknown as AdmissionRow);
  const h=await tx.aIUsageReservation.updateMany({where:{id:call.workspaceReservationId,organizationId:b.organizationId,idempotencyKey:call.idempotencyKey,correlationId:call.correlationId,reservedCents:call.estimatedCents,status:'reserved',usageEventId:null},data:{status:'released',releasedAt:new Date()}});
  if(h.count!==1)codingBudgetUnavailable();
  const c=await tx.pipelineAICallReservation.updateMany({where:{id:call.id,status:'reserved',usageEventId:null},data:{status:'released',releasedAt:new Date()}});
  if(c.count!==1)codingBudgetUnavailable();return true;
 },{isolationLevel:'Serializable'});
}
/** Financial linkage is valid after cancellation/completion and requires no new execution grant. */
export async function lockCodingFinancial(tx:Prisma.TransactionClient,workspaceReservationId:string){
 const call=await tx.pipelineAICallReservation.findUnique({where:{workspaceReservationId}});
 if(!call)return null;
 await tx.$queryRawUnsafe('SELECT id FROM "PipelineRun" WHERE id=$1 AND "organizationId"=$2 FOR UPDATE',call.runId,call.organizationId);
 const rows=await tx.pipelineAICallReservation.findMany({where:{id:call.id}});if(rows.length!==1)codingBudgetUnavailable();
 const current=rows[0]!;assertStoredCodingAdmission(current as unknown as AdmissionRow);
 const hold=await tx.aIUsageReservation.findUnique({where:{id:current.workspaceReservationId}});
 if(!hold||hold.organizationId!==current.organizationId||hold.idempotencyKey!==current.idempotencyKey||hold.correlationId!==current.correlationId||hold.reservedCents!==current.estimatedCents)codingBudgetUnavailable();
 return current;
}
export async function linkCodingUsage(tx:Prisma.TransactionClient,workspaceReservationId:string,usageEventId:string,externalUsageId:string){
 const call=await lockCodingFinancial(tx,workspaceReservationId);if(!call)return;
 const hold=await tx.aIUsageReservation.findUnique({where:{id:workspaceReservationId}});
 const usage=await tx.usageEvent.findUnique({where:{id:usageEventId}});
 if(!hold||!usage||call.status!=='dispatch_unknown'||call.usageEventId!==null||hold.status!=='pending_settlement'||hold.usageEventId!==usageEventId||hold.organizationId!==call.organizationId||usage.organizationId!==call.organizationId||usage.externalUsageId!==externalUsageId||usage.billingStatus!=='pending')codingBudgetUnavailable();
 const c=await tx.pipelineAICallReservation.updateMany({where:{id:call.id,status:'dispatch_unknown',usageEventId:null},data:{status:'pending_settlement',usageEventId,externalUsageId}});
 if(c.count!==1)codingBudgetUnavailable();
}
export async function settleCodingLedger(tx:Prisma.TransactionClient,workspaceReservationId:string,usageEventId:string,externalUsageId:string,providerCents:number){
 const call=await lockCodingFinancial(tx,workspaceReservationId);if(!call)return;
 const hold=await tx.aIUsageReservation.findUnique({where:{id:workspaceReservationId}});
 const event=await tx.usageEvent.findUnique({where:{id:usageEventId}});
 if(!Number.isSafeInteger(providerCents)||providerCents<0||!hold||!event||call.usageEventId!==usageEventId||call.externalUsageId!==externalUsageId||hold.usageEventId!==usageEventId||hold.organizationId!==call.organizationId||hold.status!=='settled'||event.organizationId!==call.organizationId||event.externalUsageId!==externalUsageId||event.billingStatus!=='settled'||event.costCents!==providerCents)codingBudgetUnavailable();
 if(call.status==='settled'){if(call.providerCents!==providerCents)codingBudgetUnavailable();return;}
 if(call.status!=='pending_settlement'||call.providerCents!==null)codingBudgetUnavailable();
 const changed=await tx.pipelineAICallReservation.updateMany({where:{id:call.id,status:'pending_settlement',providerCents:null,usageEventId,externalUsageId},data:{status:'settled',providerCents,settledAt:new Date(),integrityError:providerCents>call.estimatedCents?'provider_cost_exceeded_estimate':null}});
 if(changed.count!==1)codingBudgetUnavailable();
 // Projection only: preserve unknown as output metadata, never treat display0 as authority.
 const calls=await tx.pipelineAICallReservation.findMany({where:{stageRunId:call.stageRunId}});
 for(const c of calls)assertStoredCodingAdmission(c as unknown as AdmissionRow);
 if(calls.every(c=>c.status==='settled'||c.status==='released')){
  const total=calls.reduce((sum,c)=>sum+(c.status==='settled'?(c.providerCents??codingBudgetUnavailable()):0),0);
  if(!Number.isSafeInteger(total)||total<0)codingBudgetUnavailable();
  const stage=await tx.pipelineStageRun.findUnique({where:{id:call.stageRunId}});
  if(!stage||stage.runId!==call.runId)codingBudgetUnavailable();
  const detail=stage.outputDetail&&typeof stage.outputDetail==='object'&&!Array.isArray(stage.outputDetail)?stage.outputDetail:{};
  const cost=detail.cost&&typeof detail.cost==='object'&&!Array.isArray(detail.cost)?detail.cost:{};
  await tx.pipelineStageRun.updateMany({where:{id:call.stageRunId,runId:call.runId},data:{costCents:total,outputDetail:{...detail,cost:{...cost,totalCents:total,pendingSettlement:false}} as Prisma.InputJsonObject}});
 }
}
export async function readCodingRunExposure(repo:Repo,organizationId:string,runId:string,currentStageId:string):Promise<number>{
 return repo.$transaction(async tx=>{
  const run=await tx.$queryRawUnsafe<Array<{id:string}>>('SELECT id FROM "PipelineRun" WHERE id=$1 AND "organizationId"=$2 FOR UPDATE',runId,organizationId);if(run.length!==1)codingBudgetUnavailable();
  const calls=await tx.pipelineAICallReservation.findMany({where:{organizationId,runId},take:4097});
  const stages=await tx.pipelineStageRun.findMany({where:{runId},take:4097});
  if(calls.length>4096||stages.length>4096||stages.some(s=>s.stageKind==='code_propose'&&s.id!==currentStageId&&s.status!=='queued'&&!calls.some(c=>c.stageRunId===s.id)))codingBudgetUnavailable();
  await validateCodingRows(tx,organizationId,runId,calls,stages);
  return runBudgetExposure(calls,stages.map(s=>({costCents:s.costCents,linked:calls.some(c=>c.stageRunId===s.id)})));
 },{isolationLevel:'Serializable'});
}
/** Validate the COMPLETE durable state, including workspace and usage ownership.
 * Prisma string columns are not a substitute for a checked read boundary. */
async function validateCodingRows(tx:Prisma.TransactionClient,organizationId:string,runId:string,calls:Awaited<ReturnType<Prisma.TransactionClient['pipelineAICallReservation']['findMany']>>,stages:Awaited<ReturnType<Prisma.TransactionClient['pipelineStageRun']['findMany']>>){
 for(const c of calls){
  assertStoredCodingAdmission(c as unknown as AdmissionRow);
  const stage=stages.find(s=>s.id===c.stageRunId);
  const date=(v:unknown)=>v instanceof Date&&Number.isFinite(v.getTime());
  if(c.organizationId!==organizationId||c.runId!==runId||!stage||stage.runId!==runId||stage.stageKind!=='code_propose'||stage.aiClaimGeneration!==c.claimGeneration||!c.claimGeneration||!c.actorId||!c.correlationId||!c.idempotencyKey||!['initial','refinement'].includes(c.phase)||!date(c.createdAt)||!date(c.updatedAt)||c.capCents!==null&&(!Number.isSafeInteger(c.capCents)||c.capCents<1)||!['metadata_explicit_cap','org_pipeline_override','org_pipeline_override_unlimited','org_default','org_default_unlimited','platform_default'].includes(c.capSource)||![null,'axiom_public_anniversary_v1','axiom_test_anniversary_v2'].includes(c.allocationPolicy))codingBudgetUnavailable();
  const run=await tx.pipelineRun.findUnique({where:{id:runId}});
  if(!run||run.triggeredBy!==c.actorId||run.correlationId!==c.correlationId)codingBudgetUnavailable();
  const h=await tx.aIUsageReservation.findUnique({where:{id:c.workspaceReservationId}});
  if(!h||h.organizationId!==organizationId||h.idempotencyKey!==c.idempotencyKey||h.reservedCents!==c.estimatedCents||h.correlationId!==c.correlationId||h.status!==c.status||h.usageEventId!==c.usageEventId)codingBudgetUnavailable();
  if(['reserved','released'].includes(c.status)){
   if(c.dispatchedAt!==null||c.usageEventId!==null||c.externalUsageId!==null||c.providerCents!==null||c.settledAt!==null||h.settledCents!==null||h.settledAt!==null||(c.status==='released'? !date(c.releasedAt)||!date(h.releasedAt):c.releasedAt!==null||h.releasedAt!==null))codingBudgetUnavailable();
  }else{
   if(!date(c.dispatchedAt)||c.releasedAt!==null||h.releasedAt!==null)codingBudgetUnavailable();
   if(c.status==='dispatch_unknown'){
    if(c.usageEventId!==null||c.externalUsageId!==null||c.providerCents!==null||c.settledAt!==null||h.settledCents!==null||h.settledAt!==null)codingBudgetUnavailable();
   }else if(['pending_settlement','settled'].includes(c.status)){
    const u=c.usageEventId?await tx.usageEvent.findUnique({where:{id:c.usageEventId}}):null;
    if(!u||!c.externalUsageId||u.organizationId!==organizationId||u.externalUsageId!==c.externalUsageId||u.triggeredBy!==c.actorId||u.correlationId!==c.correlationId||u.eventKind!=='ai_invocation'||u.provider!=='vercel_gateway')codingBudgetUnavailable();
    if(c.status==='pending_settlement'?(u.billingStatus!=='pending'||u.costCents!==0||u.billedCents!==0||c.providerCents!==null||c.settledAt!==null||h.settledCents!==null||h.settledAt!==null):(u.billingStatus!=='settled'||c.providerCents!==u.costCents||h.settledCents!==u.billedCents||!date(c.settledAt)||!date(h.settledAt)))codingBudgetUnavailable();
   }else codingBudgetUnavailable();
  }
 }
}
/** Run lock serializes terminal display projection with late cost settlement. */
export async function persistCodingStageResult(repo:Repo,organizationId:string,runId:string,stageRunId:string,data:Prisma.PipelineStageRunUpdateInput){
 return repo.$transaction(async tx=>{
  const run=await tx.$queryRawUnsafe<Array<{id:string}>>('SELECT id FROM "PipelineRun" WHERE id=$1 AND "organizationId"=$2 FOR UPDATE',runId,organizationId);if(run.length!==1)codingBudgetUnavailable();
  const calls=await tx.pipelineAICallReservation.findMany({where:{organizationId,runId,stageRunId},take:4097});
  const stages=await tx.pipelineStageRun.findMany({where:{id:stageRunId,runId}});
  if(calls.length>4096||stages.length!==1)codingBudgetUnavailable();
  await validateCodingRows(tx,organizationId,runId,calls,stages);
  if(!calls.length)return tx.pipelineStageRun.update({where:{id:stageRunId},data});
  // Integrity flags block new work, while completed financial history still projects in full.
  runBudgetExposure(calls.map(c=>({...c,integrityError:null})),[]);
  const pending=calls.some(c=>!['settled','released'].includes(c.status));
  const actual=pending?null:calls.reduce((sum,c)=>sum+(c.providerCents??0),0);
  const detail=data.outputDetail&&typeof data.outputDetail==='object'&&!Array.isArray(data.outputDetail)?data.outputDetail as Record<string,Prisma.InputJsonValue>:{};
  const cost=detail.cost&&typeof detail.cost==='object'&&!Array.isArray(detail.cost)?detail.cost:{};
  return tx.pipelineStageRun.update({where:{id:stageRunId},data:{...data,costCents:actual??0,outputDetail:{...detail,cost:{...cost,totalCents:actual,pendingSettlement:pending}} as Prisma.InputJsonObject}});
 },{isolationLevel:'Serializable'});
}

/** The canonical instance cannot accept isolated pricing/quote capabilities. */
function quotedCoordinator(protocol:CodingQuoteProtocol){
 const reserved=new WeakMap<object,Readonly<{callId:string;evidence:CodingQuoteEvidence;prepared:PreparedCodingRequest;clock:QuoteClockObservation}>>();
 async function reserveQuotedCodingCall(repo:Repo,handle:CodingRunClaim|undefined,scope:Scope,input:{idempotencyKey:string;phase:'initial'|'refinement';prepared:PreparedCodingRequest;quote:CodingQuote},isolatedVerifiedPlan?:Parameters<typeof reserveAICreditsInTransaction>[3]){
  const b=codingClaimBinding(handle,scope);
  assertPreparedClaim(input.prepared,b,input.phase,input.idempotencyKey);
  const result=await repo.$transaction(async tx=>{
   const start=await codingDatabaseNow(tx);
   // Burn the quote even if a later transaction fails. Rollback is not retry authority.
   const quote=protocol.consumeForReservation(input.quote,input.prepared,start.getTime());
   const evidence=parseStoredCodingQuoteEvidence(quote.evidence,input.prepared);
   const startClock=assertQuoteNow(evidence,start);
   const cap=await policyAndExposure(tx,b,evidence.model,evidence.reservedCents);
   const prior=await tx.pipelineAICallReservation.findUnique({where:{organizationId_stageRunId_phase:{organizationId:b.organizationId,stageRunId:b.stageRunId,phase:input.phase}}});
   if(prior)codingBudgetUnavailable();
   if(input.phase==='refinement'&&!await tx.pipelineAICallReservation.findFirst({where:{organizationId:b.organizationId,stageRunId:b.stageRunId,phase:'initial',status:{in:['pending_settlement','settled']}}}))codingBudgetUnavailable();
   const beforeFunding=await codingDatabaseNow(tx);const fundingClock=assertQuoteNow(evidence,beforeFunding,startClock);
   const held=await reserveAICreditsInTransaction(tx,{organizationId:b.organizationId,idempotencyKey:input.idempotencyKey,reservedCents:evidence.reservedCents,correlationId:b.correlationId},beforeFunding,isolatedVerifiedPlan);
   if(!held.ok||held.reused)throw Error(held.ok?'request_already_reserved':held.error);
   // Funding may await branch-specific locks: require a fresh DB clock afterwards.
   const afterFunding=await codingDatabaseNow(tx);const finalClock=assertQuoteNow(evidence,afterFunding,fundingClock);
   const data={organizationId:b.organizationId,runId:b.runId,stageRunId:b.stageRunId,phase:input.phase,claimGeneration:b.generation,idempotencyKey:input.idempotencyKey,workspaceReservationId:held.reservation.id,actorId:b.actorId,correlationId:b.correlationId,estimatedCents:evidence.reservedCents,capCents:cap.maxCents,capSource:cap.source,allocationPolicy:held.allocationPolicy??null,admissionContract:'coding_request_quote_v1',quoteEvidence:evidence as unknown as Prisma.InputJsonObject};
   const call=await tx.pipelineAICallReservation.create({data});
   return {...held,callId:call.id,quoteReservation:quote.handle,evidence,clock:finalClock};
  },{isolationLevel:'Serializable'});
  // Only a committed reservation obtains a dispatch binding; persisted JSON cannot reconstruct it.
  reserved.set(result.quoteReservation,Object.freeze({callId:result.callId,evidence:result.evidence,prepared:input.prepared,clock:result.clock}));
  const {evidence:_evidence,clock:_clock,...publicResult}=result;return publicResult;
 }
 async function dispatchQuotedCodingCall(repo:Repo,handle:CodingRunClaim|undefined,scope:Scope,callId:string,prepared:PreparedCodingRequest,quoteReservation:CodingReservationQuote){
  const b=codingClaimBinding(handle,scope);
  const original=reserved.get(quoteReservation);reserved.delete(quoteReservation);
  if(!original||original.callId!==callId||original.prepared.digest!==prepared.digest)codingBudgetUnavailable();
  assertPreparedClaim(prepared,b,prepared.envelope.phase,prepared.envelope.idempotencyKey);
  return repo.$transaction(async tx=>{
   await policyAndExposure(tx,b,prepared.envelope.model,0);
   const call=await tx.pipelineAICallReservation.findUnique({where:{id:callId}});
   if(!call||call.organizationId!==b.organizationId||call.runId!==b.runId||call.stageRunId!==b.stageRunId||call.claimGeneration!==b.generation||call.actorId!==b.actorId||call.correlationId!==b.correlationId||call.phase!==prepared.envelope.phase||call.idempotencyKey!==prepared.envelope.idempotencyKey||call.status!=='reserved'||call.usageEventId!==null||call.dispatchedAt!==null)codingBudgetUnavailable();
   const evidence=assertStoredCodingAdmission(call as unknown as AdmissionRow);
   if(!evidence||!(Object.keys(original.evidence) as (keyof CodingQuoteEvidence)[]).every(key=>evidence[key]===original.evidence[key]))codingBudgetUnavailable();
   parseStoredCodingQuoteEvidence(evidence,prepared);
   const beforeClaim=await codingDatabaseNow(tx);const claimClock=assertQuoteNow(evidence,beforeClaim,original.clock);
   const ok=call.allocationPolicy==='axiom_test_anniversary_v2'?await claimNewTestBillableDispatch(tx,scope,call.workspaceReservationId):await claimLegacyAICreditDispatch(tx,scope,call.workspaceReservationId);
   if(!ok)codingBudgetUnavailable();
   const afterClaim=await codingDatabaseNow(tx);assertQuoteNow(evidence,afterClaim,claimClock);
   const managerQuote=protocol.consumeForDispatch(quoteReservation,prepared,afterClaim.getTime());
   const changed=await tx.pipelineAICallReservation.updateMany({where:{id:call.id,status:'reserved',usageEventId:null},data:{status:'dispatch_unknown',dispatchedAt:afterClaim}});
   if(changed.count!==1)codingBudgetUnavailable();
   return Object.freeze({managerQuote});
  },{isolationLevel:'Serializable'});
 }
 return Object.freeze({reserveQuotedCodingCall,dispatchQuotedCodingCall});
}
const canonicalQuotedCoordinator=quotedCoordinator(codingRequestQuoteProtocol);
export const reserveQuotedCodingCall=canonicalQuotedCoordinator.reserveQuotedCodingCall;
export const dispatchQuotedCodingCall=canonicalQuotedCoordinator.dispatchQuotedCodingCall;
/** Explicit owned-fixture composition. Never mounted or selected by request fields. */
export const createIsolatedQuotedCodingCoordinator=(protocol:CodingQuoteProtocol)=>{if(process.env.NODE_ENV!=='test')codingBudgetUnavailable();return quotedCoordinator(protocol);};
