import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createRequire } from 'node:module';
import { realpathSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
const f=vi.hoisted(()=>{
 const fetcher=vi.fn(async(_input:RequestInfo|URL,_init:RequestInit):Promise<Response>=>{throw new TypeError('synthetic_offline_default');});vi.stubGlobal('fetch',fetcher);vi.stubGlobal('AI_SDK_DEFAULT_PROVIDER',undefined);
 return {fetcher,db:null as unknown as PrismaClient,context:vi.fn(),generation:''};
});
vi.mock('@/lib/db',()=>({get prisma(){return f.db;}}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:f.context}));
import { POST } from '../route';
import { _resetAIProviderManagerForTests } from '@/lib/ai/AIProviderManager';
import { planForStripeTier } from '@/lib/billing/planRegistry';
const root=process.env.AXIOM_GENERIC_AI_PG_ROOT,model='anthropic/claude-sonnet-5';
describe.skipIf(!root)('fresh owned generic AI durable composition',()=>{
 beforeAll(async()=>{
  if(!/^\/private\/tmp\/axiom-generic-ai-pg-[^/]+$/.test(root!))throw Error('owned_root_required');
  const socket=process.env.AXIOM_GENERIC_AI_PG_SOCKET!,client=process.env.AXIOM_GENERIC_AI_PG_CLIENT!;
  if(socket!==root+'/socket'||client!==root+'/generated/index.js'||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||realpathSync(client)!==client)throw Error('owned_private_client_required');
  const {PrismaClient}=createRequire(import.meta.url)(client);
  f.db=new PrismaClient({datasources:{db:{url:'postgresql://generic_ai_fixture@localhost:55492/axiom_generic_ai_fixture?host='+encodeURIComponent(socket)}}});
  expect(await f.db.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('listen_addresses') AS listen,current_setting('data_directory') AS data")).toEqual([{db:'axiom_generic_ai_fixture',role:'generic_ai_fixture',listen:'',data:root+'/data'}]);
 });
 afterAll(async()=>{await f.db?.$disconnect();vi.unstubAllGlobals();});
 beforeEach(()=>{
  f.fetcher.mockReset();f.context.mockReset();f.generation='synthetic_generic_'+randomUUID();
  vi.stubEnv('AI_GATEWAY_API_KEY','synthetic-not-a-provider-credential');vi.stubEnv('VERCEL_OIDC_TOKEN','');vi.stubEnv('AI_GATEWAY_MODEL',model);
  vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','');vi.stubEnv('AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME','false');
  // Preserve the existing default fixed hold (1000), not a price quote.
  vi.stubEnv('AXIOM_AI_MAX_REQUEST_CREDITS_CENTS','');
  _resetAIProviderManagerForTests();
  f.fetcher.mockImplementation(async(input:RequestInfo|URL)=>{
   if(String(input)!=='https://ai-gateway.vercel.sh/v3/ai/language-model')throw Error('unexpected_synthetic_destination');
   return new Response(JSON.stringify({content:[{type:'text',text:'Synthetic durable result'}],finishReason:{unified:'stop',raw:'stop'},usage:{inputTokens:{total:5,noCache:5},outputTokens:{total:2,text:2}},providerMetadata:{gateway:{generationId:f.generation}},warnings:[]}),{headers:{'content-type':'application/json'}});
  });
 });
 afterEach(()=>{_resetAIProviderManagerForTests();vi.unstubAllEnvs();});
 async function fixture(){
  const organizationId=randomUUID(),userId=randomUUID(),correlationId=randomUUID();
  expect(planForStripeTier('starter').entitlements.includedAICreditsCents).toBe(2500);
  expect(planForStripeTier('starter').entitlements.overagePolicy).toBe('hard_stop');
  await f.db.orgMembership.create({data:{organizationId,userId,role:'owner',acceptedAt:new Date()}});
  await f.db.tenantBillingPlan.create({data:{organizationId,tier:'starter',status:'active'}});
  await f.db.organizationAIProviderPolicy.create({data:{organizationId,enabled:true,allowedProviders:['vercel_gateway'],modelSelections:{vercel_gateway:model},fallbackOrder:['vercel_gateway'],updatedBy:userId}});
  f.context.mockResolvedValue({isAuthenticated:true,organizationId,userId,sessionUserId:userId,correlationId});
  return {organizationId,userId,correlationId};
 }
 function request(scope:{correlationId:string},key:string){return new NextRequest('http://localhost/api/ai/generate',{method:'POST',headers:{'content-type':'application/json','idempotency-key':key,'x-correlation-id':scope.correlationId},body:JSON.stringify({prompt:'Summarize this synthetic fixture.',maxTokens:20,organizationId:'forged-org',userId:'forged-actor'})});}
 it('joins actual member claim, installed SDK and durable usage linkage; same key cannot dispatch twice',async()=>{
  const x=await fixture(),key='generic_'+randomUUID();
  const response=await POST(request(x,key));expect(response.status).toBe(200);
  expect((await response.json()).data).toMatchObject({text:'Synthetic durable result',gatewayGenerationId:f.generation});
  expect(f.fetcher).toHaveBeenCalledTimes(1);
  const [url,init]=f.fetcher.mock.calls[0];expect(String(url)).toBe('https://ai-gateway.vercel.sh/v3/ai/language-model');
  expect(JSON.parse(String(init.body))).toMatchObject({maxOutputTokens:20,providerOptions:{gateway:{user:x.organizationId,tags:['product:axiom-agent',`correlation:${x.correlationId}`]}}});
  const holds=await f.db.aIUsageReservation.findMany({where:{organizationId:x.organizationId}});expect(holds).toHaveLength(1);
  expect(holds[0]).toMatchObject({idempotencyKey:key,reservedCents:1000,status:'pending_settlement',settledCents:null});
  const usage=await f.db.usageEvent.findMany({where:{organizationId:x.organizationId}});expect(usage).toHaveLength(1);
  expect(usage[0]).toMatchObject({id:holds[0].usageEventId,organizationId:x.organizationId,triggeredBy:x.userId,correlationId:x.correlationId,externalUsageId:f.generation,provider:'vercel_gateway',model,inputTokens:5,outputTokens:2,billingStatus:'pending'});
  const replay=await POST(request(x,key));expect(replay.status).toBeGreaterThanOrEqual(400);expect((await replay.json()).error.code).toBe('ai.request_already_in_progress');
  expect(f.fetcher).toHaveBeenCalledTimes(1);expect(await f.db.aIUsageReservation.count({where:{organizationId:x.organizationId}})).toBe(1);expect(await f.db.usageEvent.count({where:{organizationId:x.organizationId}})).toBe(1);
 });
 it('retains unknown claimed capacity across failures and refuses replay or excess pool dispatch',async()=>{
  const x=await fixture(),first='generic_'+randomUUID();
  f.fetcher.mockImplementation(async(input:RequestInfo|URL)=>{if(String(input)!=='https://ai-gateway.vercel.sh/v3/ai/language-model')throw Error('unexpected_synthetic_destination');throw new TypeError('synthetic-network-failure');});
  expect((await POST(request(x,first))).status).toBeGreaterThanOrEqual(400);expect(f.fetcher).toHaveBeenCalledTimes(1);
  const replay=await POST(request(x,first));expect((await replay.json()).error.code).toBe('ai.request_already_in_progress');expect(f.fetcher).toHaveBeenCalledTimes(1);
  expect((await POST(request(x,'generic_'+randomUUID()))).status).toBeGreaterThanOrEqual(400);expect(f.fetcher).toHaveBeenCalledTimes(2);
  const denied=await POST(request(x,'generic_'+randomUUID()));expect(denied.status).toBeGreaterThanOrEqual(400);expect((await denied.json()).error.code).toBe('ai.credit_pool_exhausted');expect(f.fetcher).toHaveBeenCalledTimes(2);
  const holds=await f.db.aIUsageReservation.findMany({where:{organizationId:x.organizationId}});expect(holds).toHaveLength(2);
  for(const hold of holds)expect(hold).toMatchObject({reservedCents:1000,status:'dispatch_unknown',usageEventId:null,settledCents:null,releasedAt:null});
  expect(holds.reduce((sum,hold)=>sum+hold.reservedCents,0)).toBe(2000);expect(await f.db.usageEvent.count({where:{organizationId:x.organizationId}})).toBe(0);
 });
});
