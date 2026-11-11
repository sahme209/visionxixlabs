import { createDatabaseClient } from "@/lib/database/createDatabaseClient";
import {beforeAll,afterAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
import {PrismaClient,type Prisma} from '@/lib/prismaClient';
import {execFileSync} from 'node:child_process';
const f=vi.hoisted(()=>({db:undefined as unknown as PrismaClient,generate:vi.fn()}));
vi.mock('@/lib/db',()=>({get prisma(){return f.db;}}));
vi.mock('@/lib/audit/secureAudit',()=>({record:vi.fn()}));
vi.mock('@/lib/webhooks/dispatchWebhookEvent',()=>({dispatchWebhookEvent:vi.fn()}));
vi.mock('@/lib/ai/AIProviderManager',()=>({getAIProviderManager:()=>({isServiceProviderAvailable:()=>true,status:()=>[{provider:'vercel_gateway',configured:true}],generateTextWithAdmission:f.generate})}));
import {admitAIText,consumeGovernedTextAdmission} from '@/lib/billing/governedExtractAdmission';
import {reserveCodingCall,dispatchCodingCall,releaseCodingCall,readCodingRunExposure,claimCodingRunStage} from '../codingRunReservation';
import {settleGatewayGenerationInTransaction} from '@/lib/billing/reconcileGatewayUsage';
import {enrollNewPublicWorkspace} from '@/lib/billing/publicFreeEnrollment';
import {fixtureAllocationDDL,enrollFixtureAllowanceV2,readFixtureEnrollment} from '@/lib/billing/newTestSubscription/fixtureAllocation';
import {fixtureCoverageDDL} from '@/lib/billing/newTestSubscription/fixtureCoverage';
import {newTestAllocationPricingPlan} from '@/lib/billing/newTestSubscription/allocationPlan';
import {recordAttributedUsageV2} from '@/lib/billing/newTestSubscription/usageAllocationIO';
import {readPublicCreditAllowance} from '@/lib/billing/publicCreditAuthority';
import {codeProposeRealExecutor} from '../codeProposeRealExecutor';
const socket=process.env.AXIOM_BUDGET_PG_SOCKET!;
describe.skipIf(!socket)('owned socket-only coding run ledger',()=>{
beforeAll(async()=>{
 const root=process.env.AXIOM_BUDGET_PG_ROOT!;
 if(!/^\/private\/tmp\/axiom-budget-pg-[^/]+$/.test(root)||socket!==root+'/socket'||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0)throw Error('owned_fixture_required');
 f.db=createDatabaseClient(process.env.DATABASE_URL);const rows=await f.db.$queryRawUnsafe<Array<{db:string;role:string;listen:string;data:string}>>(`SELECT current_database() AS db,current_user AS role,current_setting('listen_addresses') AS listen,current_setting('data_directory') AS data`);
 expect(rows).toEqual([{db:'axiom_budget_fixture',role:'budget_fixture',listen:'',data:root+'/data'}]);
 execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql',['-X','-w','-v','ON_ERROR_STOP=1','-f','ops/recovery/20261022_public_billing_v1.sql'],{env:{NODE_ENV:'test',PGHOST:socket,PGPORT:'55439',PGUSER:'budget_fixture',PGDATABASE:'axiom_budget_fixture'},stdio:'pipe'});
 for(const statement of [
  'CREATE TABLE "IsolatedTestRuntime" (id text PRIMARY KEY,account text NOT NULL)',
  'CREATE TABLE "RecurringSubscriptionIntent" (id text PRIMARY KEY,org text NOT NULL,body jsonb NOT NULL,UNIQUE(id,org))',
  'CREATE TABLE "OrganizationTestSubscriptionContract" (org text PRIMARY KEY,intent text UNIQUE NOT NULL,customer text UNIQUE NOT NULL,subscription text UNIQUE NOT NULL,body jsonb NOT NULL,FOREIGN KEY(intent,org) REFERENCES "RecurringSubscriptionIntent"(id,org))',
  ...fixtureCoverageDDL,...fixtureAllocationDDL])await f.db.$executeRawUnsafe(statement);

});
afterAll(async()=>{await f.db?.$disconnect();vi.unstubAllEnvs();});
beforeEach(()=>{f.generate.mockReset();vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','');vi.stubEnv('AXIOM_AI_MAX_REQUEST_CREDITS_CENTS','');});
async function fixture(cap?:number,claimStage=true){
 const org=randomUUID(),user=randomUUID();
 await f.db.orgMembership.create({data:{organizationId:org,userId:user,role:'owner',acceptedAt:new Date()}});
 await f.db.tenantBillingPlan.create({data:{organizationId:org,tier:'starter',status:'active'}});
 await f.db.organizationAIProviderPolicy.create({data:{organizationId:org,enabled:true,allowedProviders:['vercel_gateway'],modelSelections:{vercel_gateway:'anthropic/claude-sonnet-5'},fallbackOrder:['vercel_gateway'],updatedBy:user}});
 const run=await f.db.pipelineRun.create({data:{organizationId:org,pipelineId:'ai_coding',status:'running',triggeredBy:user,correlationId:randomUUID(),metadata:{instruction:'Prepare a patch',repoRef:'synthetic/repo'},stages:{create:{stageId:'propose',stageKind:'code_propose',ordering:1}}},include:{stages:true}});
 if(cap!==undefined)await f.db.organizationBudgetConfig.create({data:{organizationId:org,defaultMaxCostCents:cap,pipelineOverrides:[],updatedBy:user}});
 const ctx={organizationId:org,triggeredBy:user,runId:run.id,stageRunId:run.stages[0].id,pipelineId:'ai_coding',stageId:'propose',stageKind:'code_propose' as const,correlationId:run.correlationId,runMetadata:run.metadata as Record<string,unknown>};
 // New implementation will claim through the real durable CAS; baseline has no issuer.
 const path='../codingRunReservation';const m=await import(/* @vite-ignore */ path).catch(()=>null);
 const codingRunClaim=m&&claimStage?await m.claimCodingRunStage(f.db,org,run.id,ctx.stageRunId):undefined;
 return {...ctx,codingRunClaim};
}
it('actual code_propose refuses default1000 reservation against authoritative500 run cap before manager dispatch',async()=>{
 const ctx=await fixture();f.generate.mockRejectedValue(Error('synthetic manager reached'));
 await codeProposeRealExecutor(ctx);
 expect(f.generate).not.toHaveBeenCalled();
 expect(await f.db.aIUsageReservation.count({where:{organizationId:ctx.organizationId}})).toBe(0);
});
it('caller strings alone cannot admit a paid coding call even with sufficient saved budget',async()=>{
 const ctx=await fixture(5000);delete ctx.codingRunClaim;f.generate.mockRejectedValue(Error('synthetic manager reached'));
 await codeProposeRealExecutor(ctx);expect(f.generate).not.toHaveBeenCalled();
});
const model='anthropic/claude-sonnet-5';
const textPolicy={provider:'vercel_gateway' as const,model};
type Ctx={organizationId:string;triggeredBy:string;runId:string;stageRunId:string;correlationId:string;codingRunClaim?:import('../codingRunReservation').CodingRunClaim};
const scope=(ctx:Ctx)=>({organizationId:ctx.organizationId,userId:ctx.triggeredBy,correlationId:ctx.correlationId});
const key=()=>`budget_${randomUUID().replaceAll('-','')}`;
async function reserve(ctx:Ctx,amount:number,phase:'initial'|'refinement'='initial',resolver?:Parameters<typeof reserveCodingCall>[4]){
 return reserveCodingCall(f.db,ctx.codingRunClaim,scope(ctx),{idempotencyKey:key(),phase,model,estimatedCents:amount},resolver);
}
async function admitted(ctx:Ctx,phase:'initial'|'refinement'='initial'){
 const result=await admitAIText({...scope(ctx),source:'coding_proposal',idempotencyKey:key(),codingRunClaim:ctx.codingRunClaim,codingPhase:phase,codingModel:model,textPolicy},{prompt:'synthetic bounded prompt',system:'synthetic system'});
 if(!result.ok)throw Error('fixture admission refused');
 const generation=`synthetic_${randomUUID()}`;
 await consumeGovernedTextAdmission(result.admission,{...scope(ctx),model}).record({provider:'vercel_gateway',model,gatewayGenerationId:generation,usage:{promptTokens:5,completionTokens:2,totalTokens:7}});
 const usage=await f.db.usageEvent.findUniqueOrThrow({where:{externalUsageId:generation}});return {usage,generation};
}
const receipt=(generation:string,cents:number)=>({id:generation,totalCost:cents/100,model,providerName:'synthetic',promptTokens:5,completionTokens:2,cachedTokens:0});
async function settle(event:{usage:{id:string;externalUsageId:string|null;metadata:Prisma.JsonValue};generation:string},cents:number){
 await f.db.$transaction(tx=>settleGatewayGenerationInTransaction(tx,event.usage,receipt(event.generation,cents)),{isolationLevel:'Serializable'});
}
it('actual CAS issues once; duplicate queued claim cannot manufacture another handle',async()=>{
 const ctx=await fixture(5000);expect(ctx.codingRunClaim).toEqual({});expect(await claimCodingRunStage(f.db,ctx.organizationId,ctx.runId,ctx.stageRunId)).toBeNull();
});
it('admits exact hold boundary and keeps pending first estimate when refusing refinement',async()=>{
 const ctx=await fixture(1000);await admitted(ctx);
 expect(await readCodingRunExposure(f.db,ctx.organizationId,ctx.runId,ctx.stageRunId)).toBe(1000);
 await expect(admitted(ctx,'refinement')).rejects.toThrow('coding_run_budget_exceeded');
 expect(await f.db.pipelineAICallReservation.count({where:{runId:ctx.runId}})).toBe(1);
});
it('independent concurrent phase admissions cannot consume the same run allowance',async()=>{
 const ctx=await fixture(1000);const attempts=await Promise.allSettled([reserve(ctx,1000),reserve(ctx,1000)]);
 expect(attempts.filter(a=>a.status==='fulfilled')).toHaveLength(1);
 expect(await f.db.aIUsageReservation.count({where:{organizationId:ctx.organizationId}})).toBe(1);
 expect(await readCodingRunExposure(f.db,ctx.organizationId,ctx.runId,ctx.stageRunId)).toBe(1000);
});
it('separate initial and refinement each admit once and use distinct holds',async()=>{
 const ctx=await fixture(2000);await admitted(ctx);await admitted(ctx,'refinement');
 await expect(admitted(ctx)).rejects.toThrow();await expect(admitted(ctx,'refinement')).rejects.toThrow();
 expect(await f.db.aIUsageReservation.count({where:{organizationId:ctx.organizationId}})).toBe(2);
 expect(await readCodingRunExposure(f.db,ctx.organizationId,ctx.runId,ctx.stageRunId)).toBe(2000);
});
it.each(['cancel','tighten','member','model'] as const)('rechecks %s before dispatch and retains both reserved ledgers',async kind=>{
 const ctx=await fixture(2000),held=await reserve(ctx,1000);
 if(kind==='cancel')await f.db.pipelineRun.update({where:{id:ctx.runId},data:{status:'cancelled'}});
 if(kind==='tighten')await f.db.organizationBudgetConfig.update({where:{organizationId:ctx.organizationId},data:{defaultMaxCostCents:500}});
 if(kind==='member')await f.db.orgMembership.update({where:{userId_organizationId:{organizationId:ctx.organizationId,userId:ctx.triggeredBy}},data:{acceptedAt:null}});
 if(kind==='model')await f.db.organizationAIProviderPolicy.update({where:{organizationId:ctx.organizationId},data:{enabled:false}});
 await expect(dispatchCodingCall(f.db,ctx.codingRunClaim,scope(ctx),held.callId,model,textPolicy)).rejects.toThrow();
 expect(await f.db.pipelineAICallReservation.findUnique({where:{id:held.callId}})).toMatchObject({status:'reserved'});
 expect(await f.db.aIUsageReservation.findUnique({where:{id:held.reservation.id}})).toMatchObject({status:'reserved'});
});
it('unknown dispatch cannot release, expire, or replay and retains full allowance',async()=>{
 const ctx=await fixture(2000),held=await reserve(ctx,1000);await dispatchCodingCall(f.db,ctx.codingRunClaim,scope(ctx),held.callId,model,textPolicy);
 await f.db.aIUsageReservation.update({where:{id:held.reservation.id},data:{expiresAt:new Date(0)}});
 await expect(releaseCodingCall(f.db,ctx.codingRunClaim,scope(ctx),held.callId)).rejects.toThrow();
 await expect(dispatchCodingCall(f.db,ctx.codingRunClaim,scope(ctx),held.callId,model,textPolicy)).rejects.toThrow();
 expect(await readCodingRunExposure(f.db,ctx.organizationId,ctx.runId,ctx.stageRunId)).toBe(1000);
});
it('settles exact provider cost separately from billed margin once without stage display double-counting',async()=>{
 const ctx=await fixture(2000),event=await admitted(ctx);await settle(event,10);await settle(event,10);
 const call=await f.db.pipelineAICallReservation.findFirstOrThrow({where:{runId:ctx.runId}});
 expect(call).toMatchObject({status:'settled',providerCents:10});
 expect(await f.db.aIUsageReservation.findUnique({where:{id:call.workspaceReservationId}})).toMatchObject({settledCents:15});
 expect(await f.db.pipelineStageRun.findUnique({where:{id:ctx.stageRunId}})).toMatchObject({costCents:10});
 expect(await readCodingRunExposure(f.db,ctx.organizationId,ctx.runId,ctx.stageRunId)).toBe(10);
 await expect(settle(event,8)).rejects.toThrow();
});
it('mismatched generation leaves both linked ledgers pending',async()=>{
 const ctx=await fixture(2000),event=await admitted(ctx);
 await expect(f.db.$transaction(tx=>settleGatewayGenerationInTransaction(tx,event.usage,receipt('foreign',7)),{isolationLevel:'Serializable'})).rejects.toThrow('gateway_generation_identity_mismatch');
 expect(await f.db.pipelineAICallReservation.findFirst({where:{runId:ctx.runId}})).toMatchObject({status:'pending_settlement',providerCents:null});
});
it('records full provider over-estimate, clips customer debit, and blocks later paid calls',async()=>{
 const ctx=await fixture(5000),event=await admitted(ctx);await settle(event,1501);
 expect(await f.db.pipelineAICallReservation.findFirst({where:{runId:ctx.runId}})).toMatchObject({providerCents:1501,integrityError:'provider_cost_exceeded_estimate'});
 expect(await f.db.usageEvent.findUnique({where:{id:event.usage.id}})).toMatchObject({costCents:1501,billedCents:1000});
 await expect(admitted(ctx,'refinement')).rejects.toThrow('coding_run_budget_unavailable');
});
type Mode='legacy'|'public'|'v2';
async function modeFixture(mode:Mode){
 const ctx=await fixture(10000);let resolver:Parameters<typeof reserveCodingCall>[4];
 if(mode==='public'){
  await f.db.tenantBillingPlan.delete({where:{organizationId:ctx.organizationId}});
  vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','axiom_public_anniversary_v1');vi.stubEnv('AXIOM_STRIPE_ACCOUNT_ID','acct_budget_fixture');vi.stubEnv('AXIOM_STRIPE_MODE','test');
  expect(await f.db.$transaction(tx=>enrollNewPublicWorkspace(tx,ctx.organizationId,{accountId:'acct_budget_fixture',livemode:false}))).toBe(true);
 }
 if(mode==='v2'){
  await f.db.tenantBillingPlan.update({where:{organizationId:ctx.organizationId},data:{status:'no_plan'}});
  const binding={runtimeId:randomUUID(),accountId:'acct_budget_fixture',organizationId:ctx.organizationId};
  await f.db.$executeRawUnsafe('INSERT INTO "IsolatedTestRuntime" (id,account) VALUES ($1,$2)',binding.runtimeId,binding.accountId);
  await f.db.$transaction(tx=>enrollFixtureAllowanceV2(tx,binding));
  resolver=async(tx,org)=>{if(org!==binding.organizationId)throw Error('fixture_scope');const state=await readFixtureEnrollment(tx,binding);if(!state)throw Error('fixture_enrollment');return newTestAllocationPricingPlan(tx,binding,null,state);};
 }
 return {ctx,resolver};
}
it.each(['legacy','public','v2'] as const)('%s safe predispatch void releases both ledgers and phase remains terminal',async mode=>{
 const {ctx,resolver}=await modeFixture(mode),held=await reserve(ctx,100,'initial',resolver);
 expect(held.allocationPolicy??'legacy').toBe(mode==='public'?'axiom_public_anniversary_v1':mode==='v2'?'axiom_test_anniversary_v2':'legacy');
 await releaseCodingCall(f.db,ctx.codingRunClaim,scope(ctx),held.callId);
 expect(await f.db.pipelineAICallReservation.findUnique({where:{id:held.callId}})).toMatchObject({status:'released',providerCents:null});
 expect(await f.db.aIUsageReservation.findUnique({where:{id:held.reservation.id}})).toMatchObject({status:'released'});
 expect(await readCodingRunExposure(f.db,ctx.organizationId,ctx.runId,ctx.stageRunId)).toBe(0);
 await expect(reserve(ctx,100,'initial',resolver)).rejects.toThrow();
 if(mode==='public')expect(await f.db.$transaction(tx=>readPublicCreditAllowance(tx,ctx.organizationId,{accountId:'acct_budget_fixture',livemode:false},new Date()))).toMatchObject({includedRemainingCents:200});
});
it.each(['legacy','public','v2'] as const)('%s workspace refusal and outer transaction abort leave no partial run or workspace allocation',async mode=>{
 const {ctx,resolver}=await modeFixture(mode);
 await expect(reserve(ctx,mode==='legacy'?2501:201,'initial',resolver)).rejects.toThrow();
 expect(await f.db.aIUsageReservation.count({where:{organizationId:ctx.organizationId}})).toBe(0);
 const repo={$transaction:async(fn:(tx:Prisma.TransactionClient)=>Promise<unknown>,options:unknown)=>f.db.$transaction(async tx=>{await fn(tx);throw Error('synthetic_atomic_abort');},options as {isolationLevel:"Serializable"})} as unknown as Pick<PrismaClient,'$transaction'>;
 await expect(reserveCodingCall(repo,ctx.codingRunClaim,scope(ctx),{idempotencyKey:key(),phase:'initial',model,estimatedCents:100},resolver)).rejects.toThrow('synthetic_atomic_abort');
 expect(await f.db.aIUsageReservation.count({where:{organizationId:ctx.organizationId}})).toBe(0);
 expect(await f.db.pipelineAICallReservation.count({where:{runId:ctx.runId}})).toBe(0);
 if(mode==='public')expect(await f.db.$queryRawUnsafe<Array<{n:bigint}>>('SELECT count(*) AS n FROM "PublicCreditAttribution" WHERE "organizationId"=$1',ctx.organizationId)).toEqual([{n:BigInt(0)}]);
 if(mode==='v2')expect(await f.db.$queryRawUnsafe<Array<{n:bigint}>>('SELECT count(*) AS n FROM "NewTestReservationAttribution" WHERE org=$1',ctx.organizationId)).toEqual([{n:BigInt(0)}]);
});
it('legacy reserved coding capacity survives expiry sweep by another workspace admission',async()=>{
 const {reserveAICredits}=await import('@/lib/billing/aiCreditReservation');
 const ctx=await fixture(5000),held=await reserve(ctx,2000);
 await f.db.aIUsageReservation.update({where:{id:held.reservation.id},data:{expiresAt:new Date(0)}});
 expect(await reserveAICredits(f.db,{organizationId:ctx.organizationId,idempotencyKey:key(),reservedCents:501})).toMatchObject({ok:false,error:'ai_credit_pool_exhausted'});
 expect(await f.db.aIUsageReservation.findUnique({where:{id:held.reservation.id}})).toMatchObject({status:'reserved'});
});
it('corrupt released ownership/dispatch/usage never vanishes from authoritative exposure',async()=>{
 const ctx=await fixture(5000),held=await reserve(ctx,100);await releaseCodingCall(f.db,ctx.codingRunClaim,scope(ctx),held.callId);
 await f.db.pipelineAICallReservation.update({where:{id:held.callId},data:{dispatchedAt:new Date()}});
 await expect(readCodingRunExposure(f.db,ctx.organizationId,ctx.runId,ctx.stageRunId)).rejects.toThrow('coding_run_budget_unavailable');
});
it('default refusal is the authoritative run cap, while the same manager seam is reachable with larger saved budget',async()=>{
 const blocked=await fixture();await expect(reserve(blocked,1000)).rejects.toThrow('coding_run_budget_exceeded');
 const allowed=await fixture(2000);f.generate.mockRejectedValue(Error('synthetic unknown outcome'));
 await codeProposeRealExecutor(allowed);expect(f.generate).toHaveBeenCalledTimes(1);
 const call=await f.db.pipelineAICallReservation.findFirstOrThrow({where:{runId:allowed.runId}});expect(call.status).toBe('dispatch_unknown');
 await codeProposeRealExecutor(allowed);expect(f.generate).toHaveBeenCalledTimes(1);
 await expect(releaseCodingCall(f.db,allowed.codingRunClaim,scope(allowed),call.id)).rejects.toThrow();
});
it('dispatch transaction abort cannot claim only one ledger',async()=>{
 const ctx=await fixture(5000),held=await reserve(ctx,100);
 const repo={$transaction:async(fn:(tx:Prisma.TransactionClient)=>Promise<unknown>,options:unknown)=>f.db.$transaction(async tx=>{await fn(tx);throw Error('synthetic_dispatch_abort');},options as {isolationLevel:'Serializable'})} as unknown as Pick<PrismaClient,'$transaction'>;
 await expect(dispatchCodingCall(repo,ctx.codingRunClaim,scope(ctx),held.callId,model,textPolicy)).rejects.toThrow('synthetic_dispatch_abort');
 expect(await f.db.aIUsageReservation.findUnique({where:{id:held.reservation.id}})).toMatchObject({status:'reserved'});
 expect(await f.db.pipelineAICallReservation.findUnique({where:{id:held.callId}})).toMatchObject({status:'reserved',dispatchedAt:null});
});
it.each(['legacy','public','v2'] as const)('%s settlement commits companion/workspace/usage together and provider cost remains separate',async mode=>{
 const {ctx,resolver}=await modeFixture(mode),held=await reserve(ctx,100,'initial',resolver);
 await dispatchCodingCall(f.db,ctx.codingRunClaim,scope(ctx),held.callId,model,textPolicy);
 const generation=`synthetic_${randomUUID()}`;
 const input={organizationId:ctx.organizationId,triggeredBy:ctx.triggeredBy,correlationId:ctx.correlationId,provider:'vercel_gateway',model,externalUsageId:generation,inputTokens:5,outputTokens:2};
 const {lockCodingFinancial,linkCodingUsage}=await import('../codingRunReservation');
 const {recordAIUsageEvent}=await import('@/lib/billing/recordAIUsageEvent');
 const usageId=await f.db.$transaction(async tx=>{
  await lockCodingFinancial(tx,held.reservation.id);
  const saved=mode==='v2'?await recordAttributedUsageV2(tx,held.reservation.id,input,null):await recordAIUsageEvent(input,{usageEvent:{upsert:(args:Prisma.UsageEventUpsertArgs)=>tx.usageEvent.create({data:args.create})}} as unknown as Pick<Prisma.TransactionClient,'usageEvent'>);
  if(!saved.recorded||!saved.usageEventId)throw Error('fixture_usage_failed');
  if(mode!=='v2')await tx.aIUsageReservation.update({where:{id:held.reservation.id},data:{status:'pending_settlement',usageEventId:saved.usageEventId}});
  await linkCodingUsage(tx,held.reservation.id,saved.usageEventId,generation);return saved.usageEventId;
 },{isolationLevel:'Serializable'});
 const usage=await f.db.usageEvent.findUniqueOrThrow({where:{id:usageId}}),event={usage,generation};
 await expect(f.db.$transaction(async tx=>{await settleGatewayGenerationInTransaction(tx,usage,receipt(generation,10));throw Error('synthetic_settle_abort');},{isolationLevel:'Serializable'})).rejects.toThrow('synthetic_settle_abort');
 expect(await f.db.pipelineAICallReservation.findUnique({where:{id:held.callId}})).toMatchObject({status:'pending_settlement',providerCents:null});
 expect(await f.db.aIUsageReservation.findUnique({where:{id:held.reservation.id}})).toMatchObject({status:'pending_settlement',settledCents:null});
 expect(await f.db.usageEvent.findUnique({where:{id:usageId}})).toMatchObject({billingStatus:'pending',costCents:0});
 await settle(event,10);await settle(event,10);
 expect(await f.db.pipelineAICallReservation.findUnique({where:{id:held.callId}})).toMatchObject({status:'settled',providerCents:10});
 expect(await f.db.aIUsageReservation.findUnique({where:{id:held.reservation.id}})).toMatchObject({status:'settled',settledCents:15});
 expect(await readCodingRunExposure(f.db,ctx.organizationId,ctx.runId,ctx.stageRunId)).toBe(10);
});
it('competing distinct stage refinements serialize against the same run cap',async()=>{
 const ctx=await fixture(300);const first=await reserve(ctx,100);await dispatchCodingCall(f.db,ctx.codingRunClaim,scope(ctx),first.callId,model,textPolicy);
 const {linkCodingUsage}=await import('../codingRunReservation');
 async function pending(c:Ctx,h:typeof first){const generation=`synthetic_${randomUUID()}`;await f.db.$transaction(async tx=>{const u=await tx.usageEvent.create({data:{organizationId:c.organizationId,eventKind:'ai_invocation',provider:'vercel_gateway',model,externalUsageId:generation,billingStatus:'pending',triggeredBy:c.triggeredBy,correlationId:c.correlationId}});await tx.aIUsageReservation.update({where:{id:h.reservation.id},data:{status:'pending_settlement',usageEventId:u.id}});await linkCodingUsage(tx,h.reservation.id,u.id,generation);},{isolationLevel:'Serializable'});}
 await pending(ctx,first);
 const stage=await f.db.pipelineStageRun.create({data:{runId:ctx.runId,stageId:'synthetic_second_proposal',stageKind:'code_propose',ordering:2}});
 const secondClaim=await claimCodingRunStage(f.db,ctx.organizationId,ctx.runId,stage.id);if(!secondClaim)throw Error('fixture_claim');
 const secondCtx={...ctx,stageRunId:stage.id,codingRunClaim:secondClaim};
 const second=await reserve(secondCtx,100);await dispatchCodingCall(f.db,secondCtx.codingRunClaim,scope(secondCtx),second.callId,model,textPolicy);await pending(secondCtx,second);
 const outcomes=await Promise.allSettled([reserve(ctx,100,'refinement'),reserve(secondCtx,100,'refinement')]);
 expect(outcomes.filter(o=>o.status==='fulfilled')).toHaveLength(1);
 expect(await readCodingRunExposure(f.db,ctx.organizationId,ctx.runId,ctx.stageRunId)).toBe(300);
});
it('safe void transaction abort cannot release only workspace capacity',async()=>{
 const ctx=await fixture(5000),held=await reserve(ctx,100);
 const repo={$transaction:async(fn:(tx:Prisma.TransactionClient)=>Promise<unknown>,options:unknown)=>f.db.$transaction(async tx=>{await fn(tx);throw Error('synthetic_void_abort');},options as {isolationLevel:'Serializable'})} as unknown as Pick<PrismaClient,'$transaction'>;
 await expect(releaseCodingCall(repo,ctx.codingRunClaim,scope(ctx),held.callId)).rejects.toThrow('synthetic_void_abort');
 expect(await f.db.aIUsageReservation.findUnique({where:{id:held.reservation.id}})).toMatchObject({status:'reserved'});
 expect(await f.db.pipelineAICallReservation.findUnique({where:{id:held.callId}})).toMatchObject({status:'reserved'});
});
it('actual runner completion cannot overwrite a cost settled before the executor returns with pending display zero',async()=>{
 const ctx=await fixture(2000,false);
 const {registerStageExecutor}=await import('../stageExecutorRegistry');
 const {advancePipelineRun}=await import('../pipelineRunner');
 registerStageExecutor('code_propose',async execution=>{
  const event=await admitted({...execution,codingRunClaim:execution.codingRunClaim});await settle(event,10);
  return {ok:true,summary:'Synthetic completed stage',detail:{cost:{totalCents:null,pendingSettlement:true}}};
 });
 await advancePipelineRun(ctx.runId);
 expect(await f.db.pipelineStageRun.findUnique({where:{id:ctx.stageRunId}})).toMatchObject({status:'succeeded',costCents:10});
});

it('public enrollment cannot expire the workspace half of an aged reserved coding hold',async()=>{
 const ctx=await fixture(5000),held=await reserve(ctx,1000);
 await f.db.aIUsageReservation.update({where:{id:held.reservation.id},data:{expiresAt:new Date(0)}});
 const {ensurePublicEnrollment}=await import('@/lib/billing/publicBillingStore');
 const error=await f.db.$transaction(tx=>ensurePublicEnrollment(tx,{organizationId:ctx.organizationId,enrollmentId:`synthetic_${randomUUID()}`,accountId:'acct_budget_fixture',livemode:false}),{isolationLevel:'Serializable'}).then(()=>null,e=>e instanceof Error?e.message:'unknown');
 const workspace=await f.db.aIUsageReservation.findUniqueOrThrow({where:{id:held.reservation.id}});
 const companion=await f.db.pipelineAICallReservation.findUniqueOrThrow({where:{id:held.callId}});
 expect({error,workspace:workspace.status,companion:companion.status}).toEqual({error:'legacy_ai_reconciliation_required',workspace:'reserved',companion:'reserved'});
});
it('late settlement replaces already-terminal pending cost detail and preserves unrelated detail',async()=>{
 const ctx=await fixture(2000),event=await admitted(ctx);
 const {persistCodingStageResult}=await import('../codingRunReservation');
 await persistCodingStageResult(f.db,ctx.organizationId,ctx.runId,ctx.stageRunId,{status:'succeeded',completedAt:new Date(),outputDetail:{retained:'synthetic detail',cost:{totalCents:null,pendingSettlement:true,recorded:true}}});
 await settle(event,10);
 const stage=await f.db.pipelineStageRun.findUniqueOrThrow({where:{id:ctx.stageRunId}});
 expect(stage).toMatchObject({status:'succeeded',costCents:10,outputDetail:{retained:'synthetic detail',cost:{totalCents:10,pendingSettlement:false,recorded:true}}});
});
});
