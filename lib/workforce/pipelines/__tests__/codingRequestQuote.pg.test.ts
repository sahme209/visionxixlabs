import { createDatabaseClient } from "@/lib/database/createDatabaseClient";
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
const f=vi.hoisted(()=>({db:undefined as any}));
vi.mock('@/lib/db',()=>({get prisma(){return f.db;}}));
import { createIsolatedCodingQuoteProtocol, prepareCodingRequestEnvelope, parseSyntheticCodingPricing } from '@/lib/ai/codingRequestQuote';
import { claimCodingRunStage, codingClaimBinding, createIsolatedQuotedCodingCoordinator, readCodingRunExposure, releaseCodingCall, lockCodingFinancial, linkCodingUsage, persistCodingStageResult } from '../codingRunReservation';
import { recordAIUsageEvent } from '@/lib/billing/recordAIUsageEvent';
import { settleGatewayGenerationInTransaction } from '@/lib/billing/reconcileGatewayUsage';
import { enrollNewPublicWorkspace } from '@/lib/billing/publicFreeEnrollment';
import { readPublicCreditAllowance } from '@/lib/billing/publicCreditAuthority';
import { fixtureAllocationDDL, enrollFixtureAllowanceV2, readFixtureEnrollment } from '@/lib/billing/newTestSubscription/fixtureAllocation';
import { fixtureCoverageDDL } from '@/lib/billing/newTestSubscription/fixtureCoverage';
import { newTestAllocationPricingPlan, readAllocationAllowanceV2 } from '@/lib/billing/newTestSubscription/allocationPlan';
import { recordAttributedUsageV2 } from '@/lib/billing/newTestSubscription/usageAllocationIO';
const root=process.env.AXIOM_CODING_QUOTE_PG_ROOT;
const model='anthropic/claude-sonnet-5';
describe.skipIf(!root)('fresh owned quoted coding database journey',()=>{
 beforeAll(async()=>{
  if(!/^\/private\/tmp\/axiom-cq-pg-[^/]+$/.test(root!))throw Error('owned_root_required');
  const socket=process.env.AXIOM_CODING_QUOTE_PG_SOCKET!,client=process.env.AXIOM_CODING_QUOTE_PG_CLIENT!;
  if(socket!==root+'/socket'||client!==root+'/generated/index.js'||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||realpathSync(client)!==client)throw Error('owned_private_client_required');
  const privateRequire=createRequire(import.meta.url),{PrismaClient}=privateRequire(client);
  f.db=createDatabaseClient('postgresql://coding_quote_fixture@localhost:55491/axiom_coding_quote_fixture?host='+encodeURIComponent(socket));
  const rows=await f.db.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('listen_addresses') AS listen,current_setting('data_directory') AS data");
  expect(rows).toEqual([{db:'axiom_coding_quote_fixture',role:'coding_quote_fixture',listen:'',data:root+'/data'}]);
 });
 afterAll(async()=>{await f.db?.$disconnect();vi.unstubAllEnvs();});
 beforeEach(()=>{vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','');vi.stubEnv('AXIOM_AI_MAX_REQUEST_CREDITS_CENTS','');});
 async function fixture(cap=20){
  const organizationId=randomUUID(),userId=randomUUID(),correlationId=randomUUID();
  await f.db.orgMembership.create({data:{organizationId,userId,role:'owner',acceptedAt:new Date()}});
  await f.db.tenantBillingPlan.create({data:{organizationId,tier:'starter',status:'active'}});
  await f.db.organizationAIProviderPolicy.create({data:{organizationId,enabled:true,allowedProviders:['vercel_gateway'],modelSelections:{vercel_gateway:model},fallbackOrder:['vercel_gateway'],updatedBy:userId}});
  await f.db.organizationBudgetConfig.create({data:{organizationId,defaultMaxCostCents:cap,pipelineOverrides:[],updatedBy:userId}});
  const run=await f.db.pipelineRun.create({data:{organizationId,pipelineId:'ai_coding',status:'running',triggeredBy:userId,correlationId,metadata:{instruction:'Synthetic local fixture'},stages:{create:{stageId:'propose',stageKind:'code_propose',ordering:1}}},include:{stages:true}});
  const scope={organizationId,userId,correlationId},claim=await claimCodingRunStage(f.db,organizationId,run.id,run.stages[0].id);
  if(!claim)throw Error('actual_claim_required');
  const b=codingClaimBinding(claim,scope),protocol=createIsolatedCodingQuoteProtocol(),coordinator=createIsolatedQuotedCodingCoordinator(protocol),key='quote_'+randomUUID().replaceAll('-','');
  const prepared=prepareCodingRequestEnvelope({...scope,runId:run.id,stageRunId:run.stages[0].id,claimGeneration:b.generation,phase:'initial',idempotencyKey:key,task:'generate_text',model,prompt:'Synthetic exact prompt',temperature:0.2,maxOutputTokens:4096,maxRetries:0,adapterContract:'coding_gateway_text_v1',routing:{only:['anthropic'],thinking:'disabled',region:'default',cache:'none'}});
  function quote(at=Date.now()) {return protocol.quote(prepared,parseSyntheticCodingPricing({schema:'synthetic_coding_pricing_v1',model,currency:'USD',unit:'nano_dollars_per_token',inputRate:'3000',outputRate:'15000',requestFee:'0',ancillaryFee:'0',route:'anthropic',region:'default',retrievedAt:at-100,expiresAt:at+120000}),1000,at);}
  return {scope,claim,run,protocol,coordinator,prepared,key,quote};
 }
 async function counts(org:string){return {calls:await f.db.pipelineAICallReservation.count({where:{organizationId:org}}),holds:await f.db.aIUsageReservation.count({where:{organizationId:org}})};}
 it('reserves the same full quote in both actual ledgers then retains unknown exposure without replay',async()=>{
  const x=await fixture(),q=x.quote();const held=await x.coordinator.reserveQuotedCodingCall(f.db,x.claim,x.scope,{idempotencyKey:x.key,phase:'initial',prepared:x.prepared,quote:q});
  const call=await f.db.pipelineAICallReservation.findUniqueOrThrow({where:{id:held.callId}}),hold=await f.db.aIUsageReservation.findUniqueOrThrow({where:{id:held.reservation.id}});
  expect(call).toMatchObject({admissionContract:'coding_request_quote_v1',estimatedCents:17,status:'reserved'});expect(hold).toMatchObject({reservedCents:17,status:'reserved'});expect(JSON.stringify(call.quoteEvidence)).not.toContain(x.prepared.envelope.prompt);
  const dispatch=await x.coordinator.dispatchQuotedCodingCall(f.db,x.claim,x.scope,held.callId,x.prepared,held.quoteReservation);
  const provider=x.protocol.consumeManager(dispatch.managerQuote,x.prepared,Date.now());expect(x.protocol.consumeProvider(provider,x.prepared,Date.now()).reservedCents).toBe(17);
  expect(await readCodingRunExposure(f.db,x.scope.organizationId,x.run.id,x.run.stages[0].id)).toBe(17);
  await expect(x.coordinator.dispatchQuotedCodingCall(f.db,x.claim,x.scope,held.callId,x.prepared,held.quoteReservation)).rejects.toThrow();
  await expect(releaseCodingCall(f.db,x.claim,x.scope,held.callId)).rejects.toThrow();
  expect(await f.db.pipelineAICallReservation.findUniqueOrThrow({where:{id:held.callId}})).toMatchObject({status:'dispatch_unknown'});expect(await f.db.aIUsageReservation.findUniqueOrThrow({where:{id:hold.id}})).toMatchObject({status:'dispatch_unknown',reservedCents:17});
 });
 it('refuses a quote above the actual saved run cap without either financial row',async()=>{const x=await fixture(16);await expect(x.coordinator.reserveQuotedCodingCall(f.db,x.claim,x.scope,{idempotencyKey:x.key,phase:'initial',prepared:x.prepared,quote:x.quote()})).rejects.toThrow();expect(await counts(x.scope.organizationId)).toEqual({calls:0,holds:0});});
 it('rolls back both actual rows and burns quote authority on outer abort',async()=>{
  const x=await fixture(),quote=x.quote();const aborted={$transaction:(fn:any,options:any)=>f.db.$transaction(async(tx:any)=>{await fn(tx);throw Error('synthetic_outer_abort');},options)};
  await expect(x.coordinator.reserveQuotedCodingCall(aborted as never,x.claim,x.scope,{idempotencyKey:x.key,phase:'initial',prepared:x.prepared,quote})).rejects.toThrow('synthetic_outer_abort');expect(await counts(x.scope.organizationId)).toEqual({calls:0,holds:0});
  await expect(x.coordinator.reserveQuotedCodingCall(f.db,x.claim,x.scope,{idempotencyKey:x.key,phase:'initial',prepared:x.prepared,quote})).rejects.toThrow();
 });
 it('rejects expired quote under the actual database clock before funding',async()=>{const x=await fixture(),quote=x.quote(Date.now()-120001);await expect(x.coordinator.reserveQuotedCodingCall(f.db,x.claim,x.scope,{idempotencyKey:x.key,phase:'initial',prepared:x.prepared,quote})).rejects.toThrow();expect(await counts(x.scope.organizationId)).toEqual({calls:0,holds:0});});
 it('rechecks actual membership before dispatch and preserves undispatched full holds on revocation',async()=>{
  const x=await fixture(),held=await x.coordinator.reserveQuotedCodingCall(f.db,x.claim,x.scope,{idempotencyKey:x.key,phase:'initial',prepared:x.prepared,quote:x.quote()});
  await f.db.orgMembership.update({where:{userId_organizationId:{userId:x.scope.userId,organizationId:x.scope.organizationId}},data:{acceptedAt:null}});
  await expect(x.coordinator.dispatchQuotedCodingCall(f.db,x.claim,x.scope,held.callId,x.prepared,held.quoteReservation)).rejects.toThrow();
  expect(await f.db.pipelineAICallReservation.findUniqueOrThrow({where:{id:held.callId}})).toMatchObject({status:'reserved',dispatchedAt:null});expect(await f.db.aIUsageReservation.findUniqueOrThrow({where:{id:held.reservation.id}})).toMatchObject({status:'reserved',reservedCents:17});
 });
 // Follow-on packet only: these cases require a separately reviewed fresh owned
 // client/socket and filter. They do not invoke a provider or reuse old fixtures.
 type Fixture=Awaited<ReturnType<typeof fixture>>;
 function freshRequest(x:Fixture,phase:'initial'|'refinement',prompt:string,inputTokens:number){
  const binding=codingClaimBinding(x.claim,x.scope),idempotencyKey='quote_'+randomUUID().replaceAll('-',''),at=Date.now();
  const prepared=prepareCodingRequestEnvelope({...x.scope,runId:x.run.id,stageRunId:x.run.stages[0].id,claimGeneration:binding.generation,phase,idempotencyKey,task:'generate_text',model,prompt,temperature:0.2,maxOutputTokens:4096,maxRetries:0,adapterContract:'coding_gateway_text_v1',routing:{only:['anthropic'],thinking:'disabled',region:'default',cache:'none'}});
  const pricing=parseSyntheticCodingPricing({schema:'synthetic_coding_pricing_v1',model,currency:'USD',unit:'nano_dollars_per_token',inputRate:'3000',outputRate:'15000',requestFee:'0',ancillaryFee:'0',route:'anthropic',region:'default',retrievedAt:at-100,expiresAt:at+120000});
  return {idempotencyKey,phase,prepared,quote:x.protocol.quote(prepared,pricing,inputTokens,at)};
 }
 async function initialPending(x:Fixture){
  const held=await x.coordinator.reserveQuotedCodingCall(f.db,x.claim,x.scope,{idempotencyKey:x.key,phase:'initial',prepared:x.prepared,quote:x.quote()});
  const dispatch=await x.coordinator.dispatchQuotedCodingCall(f.db,x.claim,x.scope,held.callId,x.prepared,held.quoteReservation);
  const provider=x.protocol.consumeManager(dispatch.managerQuote,x.prepared,Date.now());x.protocol.consumeProvider(provider,x.prepared,Date.now());
  // An explicitly synthetic completed generation is recorded using the actual
  // production financial linkage. No Gateway lookup or inference is performed.
  const generation='synthetic_quote_'+randomUUID();
  const usage=await f.db.$transaction(async(tx:any)=>{
   await lockCodingFinancial(tx,held.reservation.id);
   const saved=await recordAIUsageEvent({organizationId:x.scope.organizationId,triggeredBy:x.scope.userId,correlationId:x.scope.correlationId,provider:'vercel_gateway',model,externalUsageId:generation,inputTokens:5,outputTokens:2},{usageEvent:{upsert:(args:any)=>tx.usageEvent.create({data:args.create})}} as never);
   if(!saved.recorded||!saved.usageEventId)throw Error('synthetic_usage_link_failed');
   await tx.aIUsageReservation.update({where:{id:held.reservation.id},data:{status:'pending_settlement',usageEventId:saved.usageEventId}});
   await linkCodingUsage(tx,held.reservation.id,saved.usageEventId,generation);
   return tx.usageEvent.findUniqueOrThrow({where:{id:saved.usageEventId}});
  },{isolationLevel:'Serializable'});
  return {held,usage,generation};
 }
 const syntheticReceipt=(generation:string,cents:number)=>({id:generation,totalCost:cents/100,model,providerName:'synthetic',promptTokens:5,completionTokens:2,cachedTokens:0});
 it('follow-on: quotes the full larger refinement separately while retaining the initial pending hold',async()=>{
  const x=await fixture(40),initial=await initialPending(x);
  const request=freshRequest(x,'refinement','Synthetic original instruction plus broken patch and validation feedback. '.repeat(200),10000);
  const refinement=await x.coordinator.reserveQuotedCodingCall(f.db,x.claim,x.scope,request);
  const rows=await f.db.pipelineAICallReservation.findMany({where:{runId:x.run.id},orderBy:{createdAt:'asc'}});
  expect(rows).toHaveLength(2);expect(rows[0]).toMatchObject({id:initial.held.callId,status:'pending_settlement',estimatedCents:17});expect(rows[1]).toMatchObject({id:refinement.callId,phase:'refinement',status:'reserved',estimatedCents:23});
  expect(rows[1].quoteEvidence.requestDigest).not.toBe(rows[0].quoteEvidence.requestDigest);expect(rows[1].quoteEvidence.payloadBytes).toBeGreaterThan(rows[0].quoteEvidence.payloadBytes);
  expect((await f.db.aIUsageReservation.findUniqueOrThrow({where:{id:refinement.reservation.id}})).reservedCents).toBe(23);
  expect(await readCodingRunExposure(f.db,x.scope.organizationId,x.run.id,x.run.stages[0].id)).toBe(40);
 });
 it('follow-on: refuses a larger refinement beyond the saved cap without dropping the initial pending exposure',async()=>{
  const x=await fixture(39),initial=await initialPending(x),request=freshRequest(x,'refinement','Synthetic larger refinement. '.repeat(200),10000);
  await expect(x.coordinator.reserveQuotedCodingCall(f.db,x.claim,x.scope,request)).rejects.toThrow();
  expect(await counts(x.scope.organizationId)).toEqual({calls:1,holds:1});expect(await readCodingRunExposure(f.db,x.scope.organizationId,x.run.id,x.run.stages[0].id)).toBe(17);
  expect(await f.db.pipelineAICallReservation.findUniqueOrThrow({where:{id:initial.held.callId}})).toMatchObject({status:'pending_settlement',estimatedCents:17});
 });
 it('follow-on: concurrent same-phase quotes cannot create duplicate companion or workspace holds',async()=>{
  const x=await fixture(40);
  const inputs=[freshRequest(x,'initial','Synthetic same phase A',1000),freshRequest(x,'initial','Synthetic same phase B',1000)];
  const results=await Promise.allSettled(inputs.map(input=>x.coordinator.reserveQuotedCodingCall(f.db,x.claim,x.scope,input)));
  expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(await counts(x.scope.organizationId)).toEqual({calls:1,holds:1});
  expect(await readCodingRunExposure(f.db,x.scope.organizationId,x.run.id,x.run.stages[0].id)).toBe(17);
 });
 it('follow-on: competing refinements on distinct claimed stages cannot overspend remaining run capacity',async()=>{
  const x=await fixture(57);await initialPending(x);
  const stage=await f.db.pipelineStageRun.create({data:{runId:x.run.id,stageId:'second_proposal',stageKind:'code_propose',ordering:2}});
  const claim=await claimCodingRunStage(f.db,x.scope.organizationId,x.run.id,stage.id);if(!claim)throw Error('second_actual_claim_required');
  const binding=codingClaimBinding(claim,x.scope),key='quote_'+randomUUID().replaceAll('-','');
  const prepared=prepareCodingRequestEnvelope({...x.prepared.envelope,stageRunId:stage.id,claimGeneration:binding.generation,idempotencyKey:key});
  const second={...x,claim,key,prepared,run:{...x.run,stages:[stage]},quote:(at=Date.now())=>x.protocol.quote(prepared,parseSyntheticCodingPricing({schema:'synthetic_coding_pricing_v1',model,currency:'USD',unit:'nano_dollars_per_token',inputRate:'3000',outputRate:'15000',requestFee:'0',ancillaryFee:'0',route:'anthropic',region:'default',retrievedAt:at-100,expiresAt:at+120000}),1000,at)};
  await initialPending(second);
  const requests=[{x,input:freshRequest(x,'refinement','Synthetic first larger refinement. '.repeat(200),10000)},{x:second,input:freshRequest(second,'refinement','Synthetic second larger refinement. '.repeat(200),10000)}];
  const results=await Promise.allSettled(requests.map(({x:owner,input})=>owner.coordinator.reserveQuotedCodingCall(f.db,owner.claim,owner.scope,input)));
  expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(await counts(x.scope.organizationId)).toEqual({calls:3,holds:3});
  expect(await readCodingRunExposure(f.db,x.scope.organizationId,x.run.id,x.run.stages[0].id)).toBe(57);
 });
 it('follow-on: quoted settlement rolls back atomically then updates late stage cost without losing history',async()=>{
  const x=await fixture(40),event=await initialPending(x);
  await persistCodingStageResult(f.db,x.scope.organizationId,x.run.id,x.run.stages[0].id,{status:'succeeded',completedAt:new Date(),outputDetail:{retained:'synthetic detail',cost:{totalCents:null,pendingSettlement:true,recorded:true}}});
  await expect(f.db.$transaction(async(tx:any)=>{await settleGatewayGenerationInTransaction(tx,event.usage,syntheticReceipt(event.generation,7));throw Error('synthetic_settlement_abort');},{isolationLevel:'Serializable'})).rejects.toThrow('synthetic_settlement_abort');
  expect(await f.db.pipelineAICallReservation.findUniqueOrThrow({where:{id:event.held.callId}})).toMatchObject({status:'pending_settlement',providerCents:null});
  expect(await f.db.aIUsageReservation.findUniqueOrThrow({where:{id:event.held.reservation.id}})).toMatchObject({status:'pending_settlement',settledCents:null});
  expect(await f.db.usageEvent.findUniqueOrThrow({where:{id:event.usage.id}})).toMatchObject({billingStatus:'pending',costCents:0});
  await f.db.$transaction((tx:any)=>settleGatewayGenerationInTransaction(tx,event.usage,syntheticReceipt(event.generation,7)),{isolationLevel:'Serializable'});
  await f.db.$transaction((tx:any)=>settleGatewayGenerationInTransaction(tx,event.usage,syntheticReceipt(event.generation,7)),{isolationLevel:'Serializable'});
  expect(await f.db.pipelineAICallReservation.findUniqueOrThrow({where:{id:event.held.callId}})).toMatchObject({status:'settled',providerCents:7,estimatedCents:17});
  expect(await f.db.aIUsageReservation.findUniqueOrThrow({where:{id:event.held.reservation.id}})).toMatchObject({status:'settled',settledCents:11,reservedCents:17});
  expect(await f.db.usageEvent.findUniqueOrThrow({where:{id:event.usage.id}})).toMatchObject({billingStatus:'settled',costCents:7,billedCents:11});
  expect(await f.db.pipelineStageRun.findUniqueOrThrow({where:{id:x.run.stages[0].id}})).toMatchObject({status:'succeeded',costCents:7,outputDetail:{retained:'synthetic detail',cost:{totalCents:7,pendingSettlement:false,recorded:true}}});
  expect(await readCodingRunExposure(f.db,x.scope.organizationId,x.run.id,x.run.stages[0].id)).toBe(7);
 });
 it('follow-on: provider overrun retains full provider cost and blocks another paid phase without increasing customer hold',async()=>{
  const x=await fixture(100),event=await initialPending(x);
  await f.db.$transaction((tx:any)=>settleGatewayGenerationInTransaction(tx,event.usage,syntheticReceipt(event.generation,18)),{isolationLevel:'Serializable'});
  expect(await f.db.pipelineAICallReservation.findUniqueOrThrow({where:{id:event.held.callId}})).toMatchObject({status:'settled',providerCents:18,estimatedCents:17,integrityError:'provider_cost_exceeded_estimate'});
  expect(await f.db.aIUsageReservation.findUniqueOrThrow({where:{id:event.held.reservation.id}})).toMatchObject({status:'settled',settledCents:17,reservedCents:17});
  expect(await f.db.usageEvent.findUniqueOrThrow({where:{id:event.usage.id}})).toMatchObject({billingStatus:'settled',costCents:18,billedCents:17});
  await expect(x.coordinator.reserveQuotedCodingCall(f.db,x.claim,x.scope,freshRequest(x,'refinement','Synthetic overrun follow-up',1000))).rejects.toThrow();
  expect(await counts(x.scope.organizationId)).toEqual({calls:1,holds:1});await expect(readCodingRunExposure(f.db,x.scope.organizationId,x.run.id,x.run.stages[0].id)).rejects.toThrow();
 });


 // Allocation packet only: fresh rows and explicit owned-fixture DDL. These
 // free/no-contract paths intentionally do not provision Checkout/invoices.
 type AllocationMode='public'|'v2';
 const accountId='acct_coding_quote_fixture';
 let allocationDDLReady=false;
 async function allocationDDL(){
  if(allocationDDLReady)return;
  const ddl=[
   'CREATE TABLE "PublicBillingEnrollment" ("organizationId" text PRIMARY KEY,id text UNIQUE NOT NULL,"accountId" text NOT NULL,livemode boolean NOT NULL,policy text NOT NULL,"legacyFreeMonth" text NOT NULL,"legacyFreeUsedCents" integer NOT NULL CHECK("legacyFreeUsedCents">=0))',
   'CREATE TABLE "PublicSubscriptionContract" ("organizationId" text PRIMARY KEY,body jsonb NOT NULL,revision integer NOT NULL)',
   'CREATE TABLE "PublicCreditAttribution" ("reservationId" text PRIMARY KEY REFERENCES "AIUsageReservation"(id),"organizationId" text NOT NULL,body jsonb NOT NULL)',
   'CREATE TABLE "IsolatedTestRuntime" (id text PRIMARY KEY,account text NOT NULL)',
   'CREATE TABLE "RecurringSubscriptionIntent" (id text PRIMARY KEY,org text NOT NULL,body jsonb NOT NULL,UNIQUE(id,org))',
   'CREATE TABLE "OrganizationTestSubscriptionContract" (org text PRIMARY KEY,intent text UNIQUE NOT NULL,customer text UNIQUE NOT NULL,subscription text UNIQUE NOT NULL,body jsonb NOT NULL,FOREIGN KEY(intent,org) REFERENCES "RecurringSubscriptionIntent"(id,org))',
   ...fixtureCoverageDDL,...fixtureAllocationDDL,
  ];
  for(const statement of ddl)await f.db.$executeRawUnsafe(statement);
  allocationDDLReady=true;
 }
 async function allocationFixture(mode:AllocationMode,cap=1000){
  await allocationDDL();
  const organizationId=randomUUID(),userId=randomUUID(),correlationId=randomUUID(),binding={runtimeId:randomUUID(),accountId,organizationId};
  await f.db.orgMembership.create({data:{organizationId,userId,role:'owner',acceptedAt:new Date()}});
  let resolver:any;
  if(mode==='public'){
   vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','axiom_public_anniversary_v1');vi.stubEnv('AXIOM_STRIPE_ACCOUNT_ID',accountId);vi.stubEnv('AXIOM_STRIPE_MODE','test');
   expect(await f.db.$transaction((tx:any)=>enrollNewPublicWorkspace(tx,organizationId,{accountId,livemode:false}))).toBe(true);
  }else{
   await f.db.tenantBillingPlan.create({data:{organizationId,tier:'starter',status:'no_plan'}});
   await f.db.$executeRawUnsafe('INSERT INTO "IsolatedTestRuntime" (id,account) VALUES ($1,$2)',binding.runtimeId,accountId);
   await f.db.$transaction((tx:any)=>enrollFixtureAllowanceV2(tx,binding));
   resolver=async(tx:any,org:string)=>{if(org!==organizationId)throw Error('fixture_scope');const state=await readFixtureEnrollment(tx,binding);if(!state)throw Error('fixture_enrollment');return newTestAllocationPricingPlan(tx,binding,null,state);};
  }
  await f.db.organizationAIProviderPolicy.create({data:{organizationId,enabled:true,allowedProviders:['vercel_gateway'],modelSelections:{vercel_gateway:model},fallbackOrder:['vercel_gateway'],updatedBy:userId}});
  await f.db.organizationBudgetConfig.create({data:{organizationId,defaultMaxCostCents:cap,pipelineOverrides:[],updatedBy:userId}});
  const run=await f.db.pipelineRun.create({data:{organizationId,pipelineId:'ai_coding',status:'running',triggeredBy:userId,correlationId,metadata:{instruction:'Synthetic allocation fixture'},stages:{create:{stageId:'propose',stageKind:'code_propose',ordering:1}}},include:{stages:true}});
  const scope={organizationId,userId,correlationId},claim=await claimCodingRunStage(f.db,organizationId,run.id,run.stages[0].id);if(!claim)throw Error('actual_claim_required');
  const b=codingClaimBinding(claim,scope),protocol=createIsolatedCodingQuoteProtocol(),coordinator=createIsolatedQuotedCodingCoordinator(protocol),key='quote_'+randomUUID().replaceAll('-','');
  const prepared=prepareCodingRequestEnvelope({...scope,runId:run.id,stageRunId:run.stages[0].id,claimGeneration:b.generation,phase:'initial',idempotencyKey:key,task:'generate_text',model,prompt:'Synthetic exact allocation prompt',temperature:0.2,maxOutputTokens:4096,maxRetries:0,adapterContract:'coding_gateway_text_v1',routing:{only:['anthropic'],thinking:'disabled',region:'default',cache:'none'}});
  function quote(at=Date.now()){return protocol.quote(prepared,parseSyntheticCodingPricing({schema:'synthetic_coding_pricing_v1',model,currency:'USD',unit:'nano_dollars_per_token',inputRate:'3000',outputRate:'15000',requestFee:'0',ancillaryFee:'0',route:'anthropic',region:'default',retrievedAt:at-100,expiresAt:at+120000}),1000,at);}
  const x={scope,claim,run,protocol,coordinator,key,prepared,quote,mode,resolver};
  const allowance=()=>f.db.$transaction(async(tx:any)=>mode==='public'?readPublicCreditAllowance(tx,organizationId,{accountId,livemode:false},new Date()):readAllocationAllowanceV2(tx,await resolver(tx,organizationId)));
  const attributionCount=async()=>{const rows=await f.db.$queryRawUnsafe(mode==='public'?'SELECT count(*)::integer AS count FROM "PublicCreditAttribution" WHERE "organizationId"=$1':'SELECT count(*)::integer AS count FROM "NewTestReservationAttribution" WHERE org=$1',organizationId);return rows[0].count;};
  return {...x,allowance,attributionCount};
 }
 type AllocationFixture=Awaited<ReturnType<typeof allocationFixture>>;
 async function reserveAllocation(x:AllocationFixture,input:ReturnType<typeof freshRequest>={idempotencyKey:x.key,phase:'initial',prepared:x.prepared,quote:x.quote()},repo=f.db){return x.coordinator.reserveQuotedCodingCall(repo,x.claim,x.scope,input,x.resolver);}
 async function pendingAllocation(x:AllocationFixture){
  const held=await reserveAllocation(x),dispatch=await x.coordinator.dispatchQuotedCodingCall(f.db,x.claim,x.scope,held.callId,x.prepared,held.quoteReservation),provider=x.protocol.consumeManager(dispatch.managerQuote,x.prepared,Date.now());x.protocol.consumeProvider(provider,x.prepared,Date.now());
  const generation='synthetic_allocation_'+randomUUID();
  const usage=await f.db.$transaction(async(tx:any)=>{
   await lockCodingFinancial(tx,held.reservation.id);
   const input={organizationId:x.scope.organizationId,triggeredBy:x.scope.userId,correlationId:x.scope.correlationId,provider:'vercel_gateway',model,externalUsageId:generation,inputTokens:5,outputTokens:2};
   const saved=x.mode==='v2'?await recordAttributedUsageV2(tx,held.reservation.id,input,null):await recordAIUsageEvent(input,{usageEvent:{upsert:(args:any)=>tx.usageEvent.create({data:args.create})}} as never);
   if(!saved.recorded||!saved.usageEventId)throw Error('actual_usage_write_required');
   if(x.mode==='public')await tx.aIUsageReservation.update({where:{id:held.reservation.id},data:{status:'pending_settlement',usageEventId:saved.usageEventId}});
   await linkCodingUsage(tx,held.reservation.id,saved.usageEventId,generation);
   return tx.usageEvent.findUniqueOrThrow({where:{id:saved.usageEventId}});
  },{isolationLevel:'Serializable'});
  return {held,usage,generation};
 }
 it.each(['public','v2'] as const)('allocation: %s quoted reserve/dispatch/actual attributed usage and exact seven-cent settlement',async mode=>{
  const x=await allocationFixture(mode),event=await pendingAllocation(x);
  expect(await x.allowance()).toMatchObject({includedRemainingCents:183,heldCents:17});expect(await x.attributionCount()).toBe(1);
  await f.db.$transaction((tx:any)=>settleGatewayGenerationInTransaction(tx,event.usage,syntheticReceipt(event.generation,7)),{isolationLevel:'Serializable'});
  expect(await f.db.pipelineAICallReservation.findUniqueOrThrow({where:{id:event.held.callId}})).toMatchObject({status:'settled',providerCents:7,estimatedCents:17});
  expect(await f.db.aIUsageReservation.findUniqueOrThrow({where:{id:event.held.reservation.id}})).toMatchObject({status:'settled',settledCents:11,reservedCents:17});
  expect(await f.db.usageEvent.findUniqueOrThrow({where:{id:event.usage.id}})).toMatchObject({billingStatus:'settled',costCents:7,billedCents:11});
  expect(await x.allowance()).toMatchObject({includedRemainingCents:189,heldCents:0});
 });
 it.each(['public','v2'] as const)('allocation: %s safe unused void restores original allowance while phase remains consumed',async mode=>{
  const x=await allocationFixture(mode),held=await reserveAllocation(x);await releaseCodingCall(f.db,x.claim,x.scope,held.callId);
  expect(await x.allowance()).toMatchObject({includedRemainingCents:200,heldCents:0});expect(await x.attributionCount()).toBe(1);
  expect(await f.db.pipelineAICallReservation.findUniqueOrThrow({where:{id:held.callId}})).toMatchObject({status:'released',estimatedCents:17});
  expect(await f.db.aIUsageReservation.findUniqueOrThrow({where:{id:held.reservation.id}})).toMatchObject({status:'released',reservedCents:17});
  await expect(reserveAllocation(x)).rejects.toThrow();expect(await counts(x.scope.organizationId)).toEqual({calls:1,holds:1});
 });
 it.each(['public','v2'] as const)('allocation: %s exhausted workspace and outer abort leave no partial financial or attribution rows',async mode=>{
  const x=await allocationFixture(mode),tooLarge=freshRequest(x,'initial','Synthetic conservatively quoted input',300000);
  await expect(reserveAllocation(x,tooLarge)).rejects.toThrow();expect(await counts(x.scope.organizationId)).toEqual({calls:0,holds:0});expect(await x.attributionCount()).toBe(0);
  const input={idempotencyKey:x.key,phase:'initial' as const,prepared:x.prepared,quote:x.quote()},aborted={$transaction:(fn:any,options:any)=>f.db.$transaction(async(tx:any)=>{await fn(tx);throw Error('synthetic_allocation_abort');},options)};
  await expect(reserveAllocation(x,input,aborted)).rejects.toThrow('synthetic_allocation_abort');expect(await counts(x.scope.organizationId)).toEqual({calls:0,holds:0});expect(await x.attributionCount()).toBe(0);expect(await x.allowance()).toMatchObject({includedRemainingCents:200});
 });
 it.each(['public','v2'] as const)('allocation: %s unknown dispatch retains the full original hold and cannot void or replay',async mode=>{
  const x=await allocationFixture(mode),held=await reserveAllocation(x);await x.coordinator.dispatchQuotedCodingCall(f.db,x.claim,x.scope,held.callId,x.prepared,held.quoteReservation);
  await expect(releaseCodingCall(f.db,x.claim,x.scope,held.callId)).rejects.toThrow();await expect(x.coordinator.dispatchQuotedCodingCall(f.db,x.claim,x.scope,held.callId,x.prepared,held.quoteReservation)).rejects.toThrow();
  expect(await x.allowance()).toMatchObject({includedRemainingCents:183,heldCents:17});expect(await x.attributionCount()).toBe(1);expect(await readCodingRunExposure(f.db,x.scope.organizationId,x.run.id,x.run.stages[0].id)).toBe(17);
  expect(await f.db.pipelineAICallReservation.findUniqueOrThrow({where:{id:held.callId}})).toMatchObject({status:'dispatch_unknown',estimatedCents:17});expect(await f.db.aIUsageReservation.findUniqueOrThrow({where:{id:held.reservation.id}})).toMatchObject({status:'dispatch_unknown',reservedCents:17});
 });
});
