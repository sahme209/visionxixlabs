import {beforeAll,afterAll,beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import {realpathSync,statSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import type {PrismaClient} from '@prisma/client';
const f=vi.hoisted(()=>{
 const fetcher=vi.fn(async(_input:RequestInfo|URL,_init:RequestInit):Promise<Response>=>{throw Error('synthetic_offline_default');});
 vi.stubGlobal('fetch',fetcher);vi.stubGlobal('AI_SDK_DEFAULT_PROVIDER',undefined);
 return {db:null as unknown as PrismaClient,fetcher,generation:''};
});
vi.mock('@/lib/db',()=>({get prisma(){return f.db;}}));
import {getAIProviderManager,_resetAIProviderManagerForTests} from '@/lib/ai/AIProviderManager';
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
  f.db=new PrismaClient({datasources:{db:{url:'postgresql://generic_ai_policy_fixture@localhost:55494/axiom_generic_ai_policy_fixture?host='+encodeURIComponent(socket)}}});
  expect(await f.db.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('listen_addresses') AS listen,current_setting('data_directory') AS data")).toEqual([{db:'axiom_generic_ai_policy_fixture',role:'generic_ai_policy_fixture',listen:'',data:root+'/data'}]);
 });
 afterAll(async()=>{await f.db?.$disconnect();vi.unstubAllGlobals();});
 beforeEach(()=>{f.fetcher.mockReset();f.generation='synthetic_coding_'+randomUUID();vi.stubEnv('AI_GATEWAY_API_KEY','synthetic-not-a-provider-credential');vi.stubEnv('VERCEL_OIDC_TOKEN','');vi.stubEnv('AI_GATEWAY_MODEL',model);_resetAIProviderManagerForTests();f.fetcher.mockImplementation(async input=>{if(String(input)!=='https://ai-gateway.vercel.sh/v3/ai/language-model')throw Error('unexpected_synthetic_destination');return new Response(JSON.stringify({content:[{type:'text',text:'Synthetic coding response'}],finishReason:{unified:'stop',raw:'stop'},usage:{inputTokens:{total:5,noCache:5},outputTokens:{total:2,text:2}},providerMetadata:{gateway:{generationId:f.generation}},warnings:[]}),{headers:{'content-type':'application/json'}});});vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','');vi.stubEnv('AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME','false');vi.stubEnv('AXIOM_AI_MAX_REQUEST_CREDITS_CENTS','');});
 afterEach(()=>{_resetAIProviderManagerForTests();vi.unstubAllEnvs();});
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
 async function admittedFixture(){
  const x=await fixture();
  const result=await admitAIText({...x.scope,source:'coding_proposal',idempotencyKey:x.key,codingRunClaim:x.claim,codingPhase:'initial',codingModel:model,textPolicy},{prompt:'Synthetic bounded prompt',system:'Synthetic system'});
  if(!result.ok)throw Error('actual_admission_required');
  return {...x,admission:result.admission};
 }
 function options(x:Awaited<ReturnType<typeof admittedFixture>>){return{organizationId:x.scope.organizationId,correlationId:x.scope.correlationId,only:'vercel_gateway' as const,allowedProviders:['vercel_gateway' as const],modelSelections:{vercel_gateway:model},model,system:'Synthetic system',maxTokens:20};}
 it('one coding SDK dispatch links attributed usage to both actual ledgers without replay',async()=>{
  const x=await admittedFixture();
  const result=await getAIProviderManager().generateTextWithAdmission('Synthetic bounded prompt',options(x),x.admission);
  expect(result.text).toBe('Synthetic coding response');expect(f.fetcher).toHaveBeenCalledTimes(1);
  const usage=await f.db.usageEvent.findMany({where:{organizationId:x.scope.organizationId}});expect(usage).toHaveLength(1);
  expect(usage[0]).toMatchObject({triggeredBy:x.scope.userId,correlationId:x.scope.correlationId,externalUsageId:f.generation,provider:'vercel_gateway',model});
  const workspace=await f.db.aIUsageReservation.findMany({where:{organizationId:x.scope.organizationId}});expect(workspace).toHaveLength(1);
  const companion=await f.db.pipelineAICallReservation.findMany({where:{organizationId:x.scope.organizationId}});expect(companion).toHaveLength(1);
  expect(workspace[0]).toMatchObject({status:'pending_settlement',reservedCents:1000,usageEventId:usage[0].id});
  expect(companion[0]).toMatchObject({status:'pending_settlement',workspaceReservationId:workspace[0].id,usageEventId:usage[0].id});
  await expect(getAIProviderManager().generateTextWithAdmission('Synthetic bounded prompt',options(x),x.admission)).rejects.toThrow();
  expect(f.fetcher).toHaveBeenCalledTimes(1);expect(await f.db.usageEvent.count({where:{organizationId:x.scope.organizationId}})).toBe(1);
 });
 it('disabling policy after coding claim prevents SDK dispatch and retains both unknown holds',async()=>{
  const x=await admittedFixture();
  const beforeWorkspace=await f.db.aIUsageReservation.findMany({where:{organizationId:x.scope.organizationId}});
  const beforeCompanion=await f.db.pipelineAICallReservation.findMany({where:{organizationId:x.scope.organizationId}});
  await f.db.organizationAIProviderPolicy.update({where:{organizationId:x.scope.organizationId},data:{enabled:false}});
  await expect(getAIProviderManager().generateTextWithAdmission('Synthetic bounded prompt',options(x),x.admission)).rejects.toThrow();
  await f.db.organizationAIProviderPolicy.update({where:{organizationId:x.scope.organizationId},data:{enabled:true}});
  await expect(getAIProviderManager().generateTextWithAdmission('Synthetic bounded prompt',options(x),x.admission)).rejects.toThrow();
  expect(f.fetcher).not.toHaveBeenCalled();expect(await f.db.usageEvent.count({where:{organizationId:x.scope.organizationId}})).toBe(0);
  expect(await f.db.aIUsageReservation.findMany({where:{organizationId:x.scope.organizationId}})).toEqual(beforeWorkspace);
  expect(await f.db.pipelineAICallReservation.findMany({where:{organizationId:x.scope.organizationId}})).toEqual(beforeCompanion);
  expect(beforeWorkspace[0].status).toBe('dispatch_unknown');expect(beforeCompanion[0].status).toBe('dispatch_unknown');
 });
});
