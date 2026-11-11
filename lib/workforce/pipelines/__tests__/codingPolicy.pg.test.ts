import { createDatabaseClient } from "@/lib/database/createDatabaseClient";
import {beforeAll,afterAll,beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import {realpathSync,statSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import type {PrismaClient} from '@/lib/prismaClient';
const f=vi.hoisted(()=>({db:null as unknown as PrismaClient}));
vi.mock('@/lib/db',()=>({get prisma(){return f.db;}}));
import {admitAIText} from '@/lib/billing/governedExtractAdmission';
import {claimCodingRunStage,reserveCodingCall,dispatchCodingCall,readCodingRunExposure} from '../codingRunReservation';
import {planForStripeTier} from '@/lib/billing/planRegistry';
const root=process.env.AXIOM_GENERIC_AI_PG_ROOT,model='anthropic/claude-sonnet-5';
const textPolicy={provider:'vercel_gateway' as const,model};
describe.skipIf(!root)('fresh owned coding text-policy compatibility',()=>{
 beforeAll(async()=>{
  if(!/^\/private\/tmp\/axiom-generic-ai-policy-pg-[^/]+$/.test(root!))throw Error('owned_root_required');
  const socket=process.env.AXIOM_GENERIC_AI_PG_SOCKET!,client=process.env.AXIOM_GENERIC_AI_PG_CLIENT!;
  if(socket!==root+'/socket'||client!==root+'/generated/index.js'||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||realpathSync(client)!==client)throw Error('owned_private_client_required');
  const {PrismaClient}=createRequire(import.meta.url)(client);
  f.db=createDatabaseClient('postgresql://generic_ai_policy_fixture@localhost:55494/axiom_generic_ai_policy_fixture?host='+encodeURIComponent(socket));
  expect(await f.db.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('listen_addresses') AS listen,current_setting('data_directory') AS data")).toEqual([{db:'axiom_generic_ai_policy_fixture',role:'generic_ai_policy_fixture',listen:'',data:root+'/data'}]);
 });
 afterAll(async()=>{await f.db?.$disconnect();vi.unstubAllGlobals();});
 beforeEach(()=>{vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','');vi.stubEnv('AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME','false');vi.stubEnv('AXIOM_AI_MAX_REQUEST_CREDITS_CENTS','');});
 afterEach(()=>vi.unstubAllEnvs());
 async function fixture(){
  const organizationId=randomUUID(),userId=randomUUID(),correlationId=randomUUID();
  expect(planForStripeTier('starter').entitlements.includedAICreditsCents).toBe(2500);
  await f.db.orgMembership.create({data:{organizationId,userId,role:'owner',acceptedAt:new Date()}});
  await f.db.tenantBillingPlan.create({data:{organizationId,tier:'starter',status:'active'}});
  await f.db.organizationAIProviderPolicy.create({data:{organizationId,enabled:true,allowedProviders:['vercel_gateway'],modelSelections:{vercel_gateway:model},fallbackOrder:['vercel_gateway'],updatedBy:userId}});
  await f.db.organizationBudgetConfig.create({data:{organizationId,defaultMaxCostCents:2000,pipelineOverrides:[],updatedBy:userId}});
  const run=await f.db.pipelineRun.create({data:{organizationId,pipelineId:'ai_coding',status:'running',triggeredBy:userId,correlationId,metadata:{instruction:'Synthetic coding policy fixture'},stages:{create:{stageId:'propose',stageKind:'code_propose',ordering:1}}},include:{stages:true}});
  const claim=await claimCodingRunStage(f.db,organizationId,run.id,run.stages[0].id);if(!claim)throw Error('actual_coding_claim_required');
  return {scope:{organizationId,userId,correlationId},runId:run.id,stageRunId:run.stages[0].id,claim,key:'coding_policy_'+randomUUID()};
 }
 async function heldFixture(){const x=await fixture();const held=await reserveCodingCall(f.db,x.claim,x.scope,{idempotencyKey:x.key,phase:'initial',model,estimatedCents:1000});return {...x,held};}
 async function snapshot(x:Awaited<ReturnType<typeof heldFixture>>){return {workspace:await f.db.aIUsageReservation.findUniqueOrThrow({where:{id:x.held.reservation.id}}),companion:await f.db.pipelineAICallReservation.findUniqueOrThrow({where:{id:x.held.callId}})};}
 it('current fixed coding admission claims both ledgers under an enabled exact policy',async()=>{
  const x=await fixture();
  const admitted=await admitAIText({...x.scope,source:'coding_proposal',idempotencyKey:x.key,codingRunClaim:x.claim,codingPhase:'initial',codingModel:model,textPolicy},{prompt:'Synthetic bounded prompt',system:'Synthetic system'});
  expect(admitted.ok).toBe(true);if(!admitted.ok)throw Error('actual_admission_required');
  const workspace=await f.db.aIUsageReservation.findMany({where:{organizationId:x.scope.organizationId}});expect(workspace).toHaveLength(1);
  const companion=await f.db.pipelineAICallReservation.findMany({where:{organizationId:x.scope.organizationId}});expect(companion).toHaveLength(1);
  expect(workspace[0]).toMatchObject({status:'dispatch_unknown',reservedCents:1000,usageEventId:null});
  expect(companion[0]).toMatchObject({status:'dispatch_unknown',estimatedCents:1000,workspaceReservationId:workspace[0].id,usageEventId:null});expect(companion[0].dispatchedAt).toBeInstanceOf(Date);
  expect(await readCodingRunExposure(f.db,x.scope.organizationId,x.runId,x.stageRunId)).toBe(1000);
  expect(await f.db.usageEvent.count({where:{organizationId:x.scope.organizationId}})).toBe(0);
 });
 it('disabled policy after reservation leaves both ledger rows exactly unchanged',async()=>{
  const x=await heldFixture(),before=await snapshot(x);
  await f.db.organizationAIProviderPolicy.update({where:{organizationId:x.scope.organizationId},data:{enabled:false}});
  await expect(dispatchCodingCall(f.db,x.claim,x.scope,x.held.callId,model,textPolicy)).rejects.toThrow();
  expect(await snapshot(x)).toEqual(before);expect(before.workspace.status).toBe('reserved');expect(before.companion).toMatchObject({status:'reserved',dispatchedAt:null});
  expect(await f.db.usageEvent.count({where:{organizationId:x.scope.organizationId}})).toBe(0);
 });
 it('missing explicit text policy cannot claim either reserved ledger',async()=>{
  const x=await heldFixture(),before=await snapshot(x);
  await expect(dispatchCodingCall(f.db,x.claim,x.scope,x.held.callId,model)).rejects.toThrow('ai_text_policy_unavailable');
  expect(await snapshot(x)).toEqual(before);expect(before.workspace.status).toBe('reserved');expect(before.companion).toMatchObject({status:'reserved',dispatchedAt:null});
  expect(await f.db.usageEvent.count({where:{organizationId:x.scope.organizationId}})).toBe(0);
 });
});
