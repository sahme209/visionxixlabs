import { createDatabaseClient } from "@/lib/database/createDatabaseClient";
import {beforeAll,afterAll,beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import {realpathSync,statSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import type {PrismaClient} from '@/lib/prismaClient';
const f=vi.hoisted(()=>{
 const fetcher=vi.fn(async(_input:RequestInfo|URL,_init:RequestInit):Promise<Response>=>{throw Error('synthetic_offline_default');});
 vi.stubGlobal('fetch',fetcher);vi.stubGlobal('AI_SDK_DEFAULT_PROVIDER',undefined);
 return {db:null as unknown as PrismaClient,fetcher,generation:''};
});
vi.mock('@/lib/db',()=>({get prisma(){return f.db;}}));
vi.mock('@/lib/audit/secureAudit',()=>({record:vi.fn()}));
import {codeProposeRealExecutor} from '../codeProposeRealExecutor';
import {getAIProviderManager,_resetAIProviderManagerForTests} from '@/lib/ai/AIProviderManager';
import {admitAIText} from '@/lib/billing/governedExtractAdmission';
import {claimCodingRunStage,reserveCodingCall,dispatchCodingCall,readCodingRunExposure} from '../codingRunReservation';
import {planForStripeTier} from '@/lib/billing/planRegistry';
const root=process.env.AXIOM_GENERIC_AI_PG_ROOT,model='anthropic/claude-sonnet-5';
const patch='diff --git a/axiom-fixture.txt b/axiom-fixture.txt\nnew file mode 100644\n--- /dev/null\n+++ b/axiom-fixture.txt\n@@ -0,0 +1 @@\n+Synthetic fixture\n';
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
 beforeEach(()=>{f.fetcher.mockReset();f.generation='synthetic_coding_'+randomUUID();vi.stubEnv('AI_GATEWAY_API_KEY','synthetic-not-a-provider-credential');vi.stubEnv('VERCEL_OIDC_TOKEN','');vi.stubEnv('AI_GATEWAY_MODEL',model);_resetAIProviderManagerForTests();f.fetcher.mockImplementation(async input=>{if(String(input)!=='https://ai-gateway.vercel.sh/v4/ai/language-model')throw Error('unexpected_synthetic_destination');return new Response(JSON.stringify({content:[{type:'text',text:patch}],finishReason:{unified:'stop',raw:'stop'},usage:{inputTokens:{total:5,noCache:5},outputTokens:{total:2,text:2}},providerMetadata:{gateway:{generationId:f.generation}},warnings:[]}),{headers:{'content-type':'application/json'}});});vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','');vi.stubEnv('AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME','false');vi.stubEnv('AXIOM_AI_MAX_REQUEST_CREDITS_CENTS','');});
 afterEach(()=>{_resetAIProviderManagerForTests();vi.unstubAllEnvs();});
 async function fixture(){
  const organizationId=randomUUID(),userId=randomUUID(),correlationId=randomUUID();
  expect(planForStripeTier('starter').entitlements.includedAICreditsCents).toBe(2500);
  await f.db.orgMembership.create({data:{organizationId,userId,role:'owner',acceptedAt:new Date()}});
  await f.db.tenantBillingPlan.create({data:{organizationId,tier:'starter',status:'active'}});
  await f.db.organizationAIProviderPolicy.create({data:{organizationId,enabled:true,allowedProviders:['vercel_gateway'],modelSelections:{vercel_gateway:model},fallbackOrder:['vercel_gateway'],updatedBy:userId}});
  await f.db.organizationBudgetConfig.create({data:{organizationId,defaultMaxCostCents:2000,pipelineOverrides:[],updatedBy:userId}});
  const run=await f.db.pipelineRun.create({data:{organizationId,pipelineId:'ai_coding',status:'running',triggeredBy:userId,correlationId,metadata:{instruction:'Add a synthetic fixture file',repoRef:'synthetic/repo',repoContext:'Synthetic repository fixture only'},stages:{create:{stageId:'propose',stageKind:'code_propose',ordering:1}}},include:{stages:true}});
  const claim=await claimCodingRunStage(f.db,organizationId,run.id,run.stages[0].id);if(!claim)throw Error('actual_coding_claim_required');
  return {scope:{organizationId,userId,correlationId},runId:run.id,stageRunId:run.stages[0].id,claim,key:'coding_policy_'+randomUUID()};
 }
 function context(x:Awaited<ReturnType<typeof fixture>>){return{organizationId:x.scope.organizationId,triggeredBy:x.scope.userId,correlationId:x.scope.correlationId,runId:x.runId,stageRunId:x.stageRunId,pipelineId:'ai_coding',stageId:'propose',stageKind:'code_propose' as const,codingRunClaim:x.claim,runMetadata:{instruction:'Add a synthetic fixture file',repoRef:'synthetic/repo',repoContext:'Synthetic repository fixture only'}};}
 function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};}
 async function waitForPolicyLockAndReservation(organizationId:string){
  const deadline=Date.now()+3000;
  while(Date.now()<deadline){
   const holds=await f.db.aIUsageReservation.findMany({where:{organizationId},select:{status:true}});
   const waits=await f.db.$queryRawUnsafe<Array<{pid:number}>>("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND wait_event_type='Lock' AND query LIKE '%OrganizationAIProviderPolicy%' AND query LIKE '%FOR SHARE%' AND pid<>pg_backend_pid()");
   if(holds.length===1&&holds[0].status==='reserved'&&waits.length===1)return;
   if(holds.some(h=>h.status!=='reserved'))throw Error('unexpected_claim_before_policy_change');
   await new Promise<void>(done=>setTimeout(done,10));
  }
  throw Error('actual_policy_shared_lock_wait_not_observed');
 }
 it('the actual coding executor returns one parsed accounted proposal without repeated generation',async()=>{
  const x=await fixture(),ctx=context(x),result=await codeProposeRealExecutor(ctx);
  expect(result.ok).toBe(true);expect(result.detail).toMatchObject({proposedPatchText:patch,refinementAttempts:0,cost:{recorded:true,pendingSettlement:true}});
  expect(f.fetcher).toHaveBeenCalledTimes(1);
  const usage=await f.db.usageEvent.findMany({where:{organizationId:x.scope.organizationId}});expect(usage).toHaveLength(1);
  expect(usage[0]).toMatchObject({triggeredBy:x.scope.userId,correlationId:x.scope.correlationId,externalUsageId:f.generation,provider:'vercel_gateway',model});
  const workspace=await f.db.aIUsageReservation.findMany({where:{organizationId:x.scope.organizationId}});expect(workspace).toHaveLength(1);
  const companion=await f.db.pipelineAICallReservation.findMany({where:{organizationId:x.scope.organizationId}});expect(companion).toHaveLength(1);
  expect(workspace[0]).toMatchObject({status:'pending_settlement',usageEventId:usage[0].id});
  expect(companion[0]).toMatchObject({status:'pending_settlement',usageEventId:usage[0].id,workspaceReservationId:workspace[0].id});
  expect((await codeProposeRealExecutor(ctx)).ok).toBe(false);expect(f.fetcher).toHaveBeenCalledTimes(1);
 });
 it('the actual coding executor refuses when policy changes while its final claim policy lock waits',async()=>{
  const x=await fixture(),locked=deferred(),release=deferred();
  let execution:ReturnType<typeof codeProposeRealExecutor>|undefined,setupError:unknown;
  const writer=f.db.$transaction(async tx=>{
   const rows=await tx.$queryRawUnsafe<Array<{organizationId:string}>>('SELECT "organizationId" FROM "OrganizationAIProviderPolicy" WHERE "organizationId"=$1 FOR UPDATE',x.scope.organizationId);
   if(rows.length!==1)throw Error('exact_fixture_policy_required');
   locked.resolve();await release.promise;
   await tx.organizationAIProviderPolicy.update({where:{organizationId:x.scope.organizationId},data:{enabled:false}});
  },{maxWait:3000,timeout:10000});
  const observed=writer.then(()=>undefined,error=>{throw error;});
  try{
   let timer:ReturnType<typeof setTimeout>|undefined;
   try{await Promise.race([locked.promise,observed,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('policy_lock_not_acquired')),3000);})]);}finally{if(timer)clearTimeout(timer);}
   execution=codeProposeRealExecutor(context(x));execution.catch(()=>undefined);
   await waitForPolicyLockAndReservation(x.scope.organizationId);expect(f.fetcher).not.toHaveBeenCalled();
  }catch(error){setupError=error;}
  finally{release.resolve();const done=await Promise.allSettled([observed]);if(!setupError&&done[0].status==='rejected')setupError=done[0].reason;}
  const outcomes=execution?await Promise.allSettled([execution]):[];
  if(setupError)throw setupError;
  expect(outcomes).toHaveLength(1);expect(outcomes[0].status).toBe('fulfilled');
  if(outcomes[0].status!=='fulfilled')throw Error('executor_result_required');
  expect(outcomes[0].value.ok).toBe(false);expect(f.fetcher).not.toHaveBeenCalled();
  expect(await f.db.usageEvent.count({where:{organizationId:x.scope.organizationId}})).toBe(0);
  expect(await f.db.organizationAIProviderPolicy.findUnique({where:{organizationId:x.scope.organizationId},select:{enabled:true}})).toEqual({enabled:false});
  const workspace=await f.db.aIUsageReservation.findMany({where:{organizationId:x.scope.organizationId}});expect(workspace).toHaveLength(1);expect(workspace[0]).toMatchObject({status:'reserved',usageEventId:null});
  const companion=await f.db.pipelineAICallReservation.findMany({where:{organizationId:x.scope.organizationId}});expect(companion).toHaveLength(1);expect(companion[0]).toMatchObject({status:'reserved',dispatchedAt:null,usageEventId:null});
 },15000);
});
