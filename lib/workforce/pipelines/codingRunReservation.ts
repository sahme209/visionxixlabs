import 'server-only';
import {randomUUID} from 'node:crypto';
import type {Prisma,PrismaClient} from '@prisma/client';

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
  const call=await tx.pipelineAICallReservation.create({data:{organizationId:b.organizationId,runId:b.runId,stageRunId:b.stageRunId,phase:input.phase,claimGeneration:b.generation,idempotencyKey:input.idempotencyKey,workspaceReservationId:held.reservation.id,actorId:b.actorId,correlationId:b.correlationId,estimatedCents:input.estimatedCents,capCents:cap.maxCents,capSource:cap.source,allocationPolicy:held.allocationPolicy??null}});
  return {...held,callId:call.id};
 },{isolationLevel:'Serializable'});
}
export async function dispatchCodingCall(repo:Repo,handle:CodingRunClaim|undefined,scope:Scope,callId:string,model:string){
 const b=codingClaimBinding(handle,scope);
 return repo.$transaction(async tx=>{
  await policyAndExposure(tx,b,model,0);
  const call=await tx.pipelineAICallReservation.findUnique({where:{id:callId}});
  if(!call||call.organizationId!==b.organizationId||call.runId!==b.runId||call.stageRunId!==b.stageRunId||call.claimGeneration!==b.generation||call.actorId!==b.actorId||call.status!=='reserved'||call.usageEventId!==null)codingBudgetUnavailable();
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
  const h=await tx.aIUsageReservation.updateMany({where:{id:call.workspaceReservationId,organizationId:b.organizationId,status:'reserved',usageEventId:null},data:{status:'released',releasedAt:new Date()}});
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
 const rows=await tx.pipelineAICallReservation.findMany({where:{id:call.id}});if(rows.length!==1)codingBudgetUnavailable();return rows[0]!;
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
 if(calls.every(c=>c.status==='settled'||c.status==='released')){
  const total=calls.reduce((sum,c)=>sum+(c.status==='settled'?(c.providerCents??codingBudgetUnavailable()):0),0);
  if(!Number.isSafeInteger(total)||total<0)codingBudgetUnavailable();
  await tx.pipelineStageRun.updateMany({where:{id:call.stageRunId,runId:call.runId},data:{costCents:total}});
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
