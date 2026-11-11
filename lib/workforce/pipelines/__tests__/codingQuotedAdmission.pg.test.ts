import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';

// Install a throwing transport before importing the REAL SDK or provider. This
// file may only replace it with the explicit synthetic success below; it never
// forwards a request to another fetch or records authentication headers.
const f=vi.hoisted(()=>{
 const fetch=vi.fn(async(..._args:unknown[]):Promise<Response>=>{throw new TypeError('synthetic_offline_default');});
 vi.stubGlobal('fetch',fetch);vi.stubGlobal('AI_SDK_DEFAULT_PROVIDER',undefined);
 return {fetch,db:undefined as any,protocol:undefined as any,coordinator:undefined as any,resolver:undefined as any,generation:'',requests:[] as Array<{url:string;model:string|null;body:Record<string,unknown>}>};
});
vi.mock('@/lib/db',()=>({get prisma(){return f.db;}}));
// Canonical issuance stays closed. Only this test module substitutes each
// capability boundary with one instance-owned synthetic protocol.
vi.mock('@/lib/ai/codingRequestQuote',async original=>{
 const actual=await original<typeof import('@/lib/ai/codingRequestQuote')>();
 return {...actual,
  quoteCodingRequest:(prepared:Parameters<typeof actual.quoteCodingRequest>[0])=>{
   if(!f.protocol)throw Error('isolated_protocol_required');const at=Date.now();
   const pricing=actual.parseSyntheticCodingPricing({schema:'synthetic_coding_pricing_v1',model:prepared.envelope.model,currency:'USD',unit:'nano_dollars_per_token',inputRate:'3000',outputRate:'15000',requestFee:'0',ancillaryFee:'0',route:'anthropic',region:'default',retrievedAt:at-100,expiresAt:at+120000});
   return f.protocol.quote(prepared,pricing,1000,at);
  },
  consumeCodingManagerQuoteForRequest:(...args:Parameters<typeof actual.consumeCodingManagerQuoteForRequest>)=>f.protocol.consumeManagerForRequest(...args),
  consumeCodingProviderDispatchForRequest:(...args:Parameters<typeof actual.consumeCodingProviderDispatchForRequest>)=>f.protocol.consumeProviderForRequest(...args),
 };
});
// The coordinator itself, claim CAS, ledger/funding calls and SQL remain real.
vi.mock('../codingRunReservation',async original=>{
 const actual=await original<typeof import('../codingRunReservation')>();
 return {...actual,
  reserveQuotedCodingCall:(...args:Parameters<typeof actual.reserveQuotedCodingCall>)=>f.coordinator.reserveQuotedCodingCall(args[0],args[1],args[2],args[3],f.resolver),
  dispatchQuotedCodingCall:(...args:Parameters<typeof actual.dispatchQuotedCodingCall>)=>f.coordinator.dispatchQuotedCodingCall(...args),
 };
});
import { createIsolatedCodingQuoteProtocol } from '@/lib/ai/codingRequestQuote';
import { claimCodingRunStage, createIsolatedQuotedCodingCoordinator } from '../codingRunReservation';
import { admitQuotedAIText } from '@/lib/billing/governedExtractAdmission';
import { AIProviderManager } from '@/lib/ai/AIProviderManager';
import { boundedAIInput } from '@/lib/ai/inputByteBound';
import { settleGatewayGenerationInTransaction } from '@/lib/billing/reconcileGatewayUsage';
import { enrollNewPublicWorkspace } from '@/lib/billing/publicFreeEnrollment';
import { readPublicCreditAllowance } from '@/lib/billing/publicCreditAuthority';
import { fixtureAllocationDDL, enrollFixtureAllowanceV2, readFixtureEnrollment } from '@/lib/billing/newTestSubscription/fixtureAllocation';
import { fixtureCoverageDDL } from '@/lib/billing/newTestSubscription/fixtureCoverage';
import { newTestAllocationPricingPlan, readAllocationAllowanceV2 } from '@/lib/billing/newTestSubscription/allocationPlan';

const root=process.env.AXIOM_CODING_QUOTE_PG_ROOT,model='anthropic/claude-sonnet-5',accountId='acct_composed_quote_fixture';
describe.skipIf(!root)('fresh owned composed quoted admission',()=>{
 beforeAll(async()=>{
  if(!/^\/private\/tmp\/axiom-cq-pg-[^/]+$/.test(root!))throw Error('owned_root_required');
  const socket=process.env.AXIOM_CODING_QUOTE_PG_SOCKET!,client=process.env.AXIOM_CODING_QUOTE_PG_CLIENT!;
  if(socket!==root+'/socket'||client!==root+'/generated/index.js'||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||realpathSync(client)!==client)throw Error('owned_private_client_required');
  const {PrismaClient}=createRequire(import.meta.url)(client);
  f.db=new PrismaClient({datasources:{db:{url:'postgresql://coding_quote_fixture@localhost:55491/axiom_coding_quote_fixture?host='+encodeURIComponent(socket)}}});
  expect(await f.db.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('listen_addresses') AS listen,current_setting('data_directory') AS data")).toEqual([{db:'axiom_coding_quote_fixture',role:'coding_quote_fixture',listen:'',data:root+'/data'}]);
 });
 afterAll(async()=>{await f.db?.$disconnect();vi.unstubAllGlobals();vi.unstubAllEnvs();});
 beforeEach(()=>{
  f.requests=[];f.resolver=undefined;f.protocol=undefined;f.coordinator=undefined;f.generation='synthetic_composed_'+randomUUID();f.fetch.mockReset();
  vi.stubEnv('AI_GATEWAY_API_KEY','synthetic-not-a-provider-credential');vi.stubEnv('AI_GATEWAY_MODEL',model);vi.stubEnv('VERCEL_OIDC_TOKEN','');
  vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','');vi.stubEnv('AXIOM_AI_MAX_REQUEST_CREDITS_CENTS','');vi.stubEnv('AXIOM_STRIPE_ACCOUNT_ID',accountId);vi.stubEnv('AXIOM_STRIPE_MODE','test');
  f.fetch.mockImplementation(async(...args:unknown[])=>{
   const [input,init]=args as [RequestInfo|URL,RequestInit];
   const url=String(input);if(url!=='https://ai-gateway.vercel.sh/v4/ai/language-model')throw Error('unexpected_synthetic_transport_destination');
   f.requests.push({url,model:new Headers(init.headers).get('ai-language-model-id'),body:JSON.parse(String(init.body))});
   return new Response(JSON.stringify({content:[{type:'text',text:'Synthetic completed coding response'}],finishReason:{unified:'stop',raw:'stop'},usage:{inputTokens:{total:5,noCache:5},outputTokens:{total:2,text:2,reasoning:0}},providerMetadata:{gateway:{generationId:f.generation}},warnings:[]}),{headers:{'content-type':'application/json'}});
  });
 });
 let ddlReady=false;
 async function allocationDDL(){
  if(ddlReady)return;
  const ddl=[
   'CREATE TABLE "PublicBillingEnrollment" ("organizationId" text PRIMARY KEY,id text UNIQUE NOT NULL,"accountId" text NOT NULL,livemode boolean NOT NULL,policy text NOT NULL,"legacyFreeMonth" text NOT NULL,"legacyFreeUsedCents" integer NOT NULL CHECK("legacyFreeUsedCents">=0))',
   'CREATE TABLE "PublicSubscriptionContract" ("organizationId" text PRIMARY KEY,body jsonb NOT NULL,revision integer NOT NULL)',
   'CREATE TABLE "PublicCreditAttribution" ("reservationId" text PRIMARY KEY REFERENCES "AIUsageReservation"(id),"organizationId" text NOT NULL,body jsonb NOT NULL)',
   'CREATE TABLE "IsolatedTestRuntime" (id text PRIMARY KEY,account text NOT NULL)',
   'CREATE TABLE "RecurringSubscriptionIntent" (id text PRIMARY KEY,org text NOT NULL,body jsonb NOT NULL,UNIQUE(id,org))',
   'CREATE TABLE "OrganizationTestSubscriptionContract" (org text PRIMARY KEY,intent text UNIQUE NOT NULL,customer text UNIQUE NOT NULL,subscription text UNIQUE NOT NULL,body jsonb NOT NULL,FOREIGN KEY(intent,org) REFERENCES "RecurringSubscriptionIntent"(id,org))',
   ...fixtureCoverageDDL,...fixtureAllocationDDL,
  ];
  for(const statement of ddl)await f.db.$executeRawUnsafe(statement);ddlReady=true;
 }
 type Mode='legacy'|'public'|'v2';
 async function fixture(mode:Mode){
  if(mode!=='legacy')await allocationDDL();
  const organizationId=randomUUID(),userId=randomUUID(),correlationId=randomUUID(),binding={runtimeId:randomUUID(),accountId,organizationId};
  await f.db.orgMembership.create({data:{organizationId,userId,role:'owner',acceptedAt:new Date()}});
  if(mode==='public'){
   vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','axiom_public_anniversary_v1');
   expect(await f.db.$transaction((tx:any)=>enrollNewPublicWorkspace(tx,organizationId,{accountId,livemode:false}))).toBe(true);
  }else{
   await f.db.tenantBillingPlan.create({data:{organizationId,tier:'starter',status:mode==='legacy'?'active':'no_plan'}});
   if(mode==='v2'){
    await f.db.$executeRawUnsafe('INSERT INTO "IsolatedTestRuntime" (id,account) VALUES ($1,$2)',binding.runtimeId,accountId);
    await f.db.$transaction((tx:any)=>enrollFixtureAllowanceV2(tx,binding));
    f.resolver=async(tx:any,org:string)=>{if(org!==organizationId)throw Error('fixture_scope');const state=await readFixtureEnrollment(tx,binding);if(!state)throw Error('fixture_enrollment');return newTestAllocationPricingPlan(tx,binding,null,state);};
   }
  }
  await f.db.organizationAIProviderPolicy.create({data:{organizationId,enabled:true,allowedProviders:['vercel_gateway'],modelSelections:{vercel_gateway:model},fallbackOrder:['vercel_gateway'],updatedBy:userId}});
  await f.db.organizationBudgetConfig.create({data:{organizationId,defaultMaxCostCents:20,pipelineOverrides:[],updatedBy:userId}});
  const run=await f.db.pipelineRun.create({data:{organizationId,pipelineId:'ai_coding',status:'running',triggeredBy:userId,correlationId,metadata:{instruction:'Synthetic composed coding fixture'},stages:{create:{stageId:'propose',stageKind:'code_propose',ordering:1}}},include:{stages:true}});
  const claim=await claimCodingRunStage(f.db,organizationId,run.id,run.stages[0].id);if(!claim)throw Error('actual_claim_required');
  f.protocol=createIsolatedCodingQuoteProtocol();f.coordinator=createIsolatedQuotedCodingCoordinator(f.protocol);
  const scope={organizationId,userId,correlationId,source:'coding_proposal' as const,codingRunClaim:claim,codingPhase:'initial' as const,codingModel:model,idempotencyKey:'composed_'+randomUUID().replaceAll('-','')};
  const secret=`ghp_${'a'.repeat(36)}`,prompt='Synthetic task '+secret,system='Synthetic system '+secret,payload=boundedAIInput(prompt,system);
  const options={organizationId,correlationId,only:'vercel_gateway' as const,model:'service-default',system,maxTokens:4096,temperature:0.2};
  const allowance=()=>f.db.$transaction(async(tx:any)=>mode==='public'?readPublicCreditAllowance(tx,organizationId,{accountId,livemode:false},new Date()):readAllocationAllowanceV2(tx,await f.resolver(tx,organizationId)));
  return {scope,run,prompt,system,payload,secret,options,allowance};
 }
 it.each(['legacy','public','v2'] as const)('composed: %s actual admission/manager/provider/SDK/usage/settlement retains exact quoted funding',async mode=>{
  const x=await fixture(mode),admitted=await admitQuotedAIText(x.scope,{prompt:x.prompt,system:x.system});if(!admitted.ok)throw Error('actual_admission_required');
  const before=await f.db.pipelineAICallReservation.findMany({where:{organizationId:x.scope.organizationId}});expect(before).toHaveLength(1);expect(before[0]).toMatchObject({status:'dispatch_unknown',estimatedCents:17,admissionContract:'coding_request_quote_v1'});expect(f.requests).toHaveLength(0);
  const response=await new AIProviderManager().generateTextWithAdmission(x.prompt,x.options,admitted.admission);
  expect(response).toMatchObject({text:'Synthetic completed coding response',usage:{promptTokens:5,completionTokens:2},gatewayGenerationId:f.generation,model});
  expect(f.fetch).toHaveBeenCalledTimes(1);expect(f.requests).toHaveLength(1);expect(f.requests[0].model).toBe(model);
  expect(f.requests[0].body).toMatchObject({temperature:0.2,maxOutputTokens:4096,prompt:[{role:'system',content:x.payload.system},{role:'user',content:[{type:'text',text:x.payload.prompt}]}],providerOptions:{anthropic:{thinking:{type:'disabled'}},gateway:{only:['anthropic'],user:x.scope.organizationId}}});
  expect(f.requests[0].body.prompt).toEqual([{role:'system',content:x.payload.system},{role:'user',content:[{type:'text',text:x.payload.prompt}]}]);
  expect(f.requests[0].body.providerOptions).toEqual({anthropic:{thinking:{type:'disabled'}},gateway:{only:['anthropic'],user:x.scope.organizationId,tags:['product:axiom-agent',`correlation:${x.scope.correlationId}`]}});
  expect(f.requests[0].body.tools).toBeUndefined();expect(f.requests[0].body.toolChoice).toBeUndefined();
  expect(JSON.stringify(f.requests[0].body)).not.toContain(x.secret);
  const call=await f.db.pipelineAICallReservation.findUniqueOrThrow({where:{id:before[0].id}}),hold=await f.db.aIUsageReservation.findUniqueOrThrow({where:{id:call.workspaceReservationId}}),usage=await f.db.usageEvent.findUniqueOrThrow({where:{id:call.usageEventId}});
  expect(call).toMatchObject({status:'pending_settlement',estimatedCents:17,externalUsageId:f.generation});expect(hold).toMatchObject({status:'pending_settlement',reservedCents:17,usageEventId:usage.id});expect(usage).toMatchObject({billingStatus:'pending',externalUsageId:f.generation});
  if(mode!=='legacy')expect(await x.allowance()).toMatchObject({includedRemainingCents:183,heldCents:17});
  await f.db.$transaction((tx:any)=>settleGatewayGenerationInTransaction(tx,usage,{id:f.generation,totalCost:0.07,model,providerName:'synthetic',promptTokens:5,completionTokens:2,cachedTokens:0}),{isolationLevel:'Serializable'});
  expect(await f.db.pipelineAICallReservation.findUniqueOrThrow({where:{id:call.id}})).toMatchObject({status:'settled',providerCents:7,estimatedCents:17});
  expect(await f.db.aIUsageReservation.findUniqueOrThrow({where:{id:hold.id}})).toMatchObject({status:'settled',reservedCents:17,settledCents:11});
  expect(await f.db.usageEvent.findUniqueOrThrow({where:{id:usage.id}})).toMatchObject({billingStatus:'settled',costCents:7,billedCents:11});
  if(mode!=='legacy')expect(await x.allowance()).toMatchObject({includedRemainingCents:189,heldCents:0});
  await expect(new AIProviderManager().generateTextWithAdmission(x.prompt,x.options,admitted.admission)).rejects.toThrow();expect(f.requests).toHaveLength(1);expect(f.fetch).toHaveBeenCalledTimes(1);
 });
 it('composed: changed final payload after real claim refuses before HTTP and retains unknown funding',async()=>{
  const x=await fixture('legacy'),admitted=await admitQuotedAIText(x.scope,{prompt:x.prompt,system:x.system});if(!admitted.ok)throw Error('actual_admission_required');
  await expect(new AIProviderManager().generateTextWithAdmission(x.prompt+' changed',x.options,admitted.admission)).rejects.toThrow();expect(f.requests).toHaveLength(0);expect(f.fetch).not.toHaveBeenCalled();
  const calls=await f.db.pipelineAICallReservation.findMany({where:{organizationId:x.scope.organizationId}});expect(calls).toHaveLength(1);expect(calls[0]).toMatchObject({status:'dispatch_unknown',estimatedCents:17,usageEventId:null});
  expect(await f.db.aIUsageReservation.findUniqueOrThrow({where:{id:calls[0].workspaceReservationId}})).toMatchObject({status:'dispatch_unknown',reservedCents:17,usageEventId:null});
  expect(await f.db.usageEvent.count({where:{organizationId:x.scope.organizationId}})).toBe(0);
  await expect(new AIProviderManager().generateTextWithAdmission(x.prompt,x.options,admitted.admission)).rejects.toThrow();expect(f.requests).toHaveLength(0);expect(f.fetch).not.toHaveBeenCalled();
 });
});
