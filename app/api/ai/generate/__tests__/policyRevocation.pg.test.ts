import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createRequire } from 'node:module';
import { realpathSync, statSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
const f=vi.hoisted(()=>{
 const fetcher=vi.fn(async(_input:RequestInfo|URL,_init:RequestInit):Promise<Response>=>{throw new TypeError('synthetic_offline_default');});vi.stubGlobal('fetch',fetcher);vi.stubGlobal('AI_SDK_DEFAULT_PROVIDER',undefined);
 return {fetcher,db:null as unknown as PrismaClient,context:vi.fn(),generation:''};
});
vi.mock('@/lib/db',()=>({get prisma(){return f.db;}}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:f.context}));
import { POST } from '../route';
import { admitAIText } from "@/lib/billing/governedExtractAdmission";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import { _resetAIProviderManagerForTests } from '@/lib/ai/AIProviderManager';
import { planForStripeTier } from '@/lib/billing/planRegistry';
const root=process.env.AXIOM_GENERIC_AI_PG_ROOT,model='anthropic/claude-sonnet-5';
describe.skipIf(!root)('fresh owned generic AI post-admission policy diagnostic',()=>{
 beforeAll(async()=>{
  if(!/^\/private\/tmp\/axiom-generic-ai-policy-pg-[^/]+$/.test(root!))throw Error('owned_root_required');
  const socket=process.env.AXIOM_GENERIC_AI_PG_SOCKET!,client=process.env.AXIOM_GENERIC_AI_PG_CLIENT!;
  if(socket!==root+'/socket'||client!==root+'/generated/index.js'||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||realpathSync(client)!==client)throw Error('owned_private_client_required');
  const {PrismaClient}=createRequire(import.meta.url)(client);
  f.db=new PrismaClient({datasources:{db:{url:'postgresql://generic_ai_policy_fixture@localhost:55494/axiom_generic_ai_policy_fixture?host='+encodeURIComponent(socket)}}});
  expect(await f.db.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('listen_addresses') AS listen,current_setting('data_directory') AS data")).toEqual([{db:'axiom_generic_ai_policy_fixture',role:'generic_ai_policy_fixture',listen:'',data:root+'/data'}]);
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
 function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};}
 async function waitReserved(organizationId:string,key:string){
  const deadline=Date.now()+3000;
  while(Date.now()<deadline){
   const hold=await f.db.aIUsageReservation.findUnique({where:{organizationId_idempotencyKey:{organizationId,idempotencyKey:key}}});
   if(hold?.status==='reserved')return hold;
   if(hold)throw Error('unexpected_hold_state_before_claim');
   await new Promise<void>(done=>setTimeout(done,10));
  }
  throw Error('fresh_reservation_not_observed_within_bound');
 }
 async function admittedFixture(){
  const x=await fixture(),key='generic_'+randomUUID();
  const result=await admitAIText({...x,idempotencyKey:key,textPolicy:{provider:'vercel_gateway',model}}, {prompt:'Synthetic policy check'});
  if(!result.ok)throw Error('positive_admission_required');
  return {...x,admission:result.admission};
 }
 function options(x:{organizationId:string;correlationId:string}){return{organizationId:x.organizationId,correlationId:x.correlationId,only:'vercel_gateway' as const,model,maxTokens:20,allowedProviders:['vercel_gateway' as const],modelSelections:{vercel_gateway:model}};}
 it('enabled current policy claims and records exactly one actual-route generation',async()=>{
  const x=await fixture(),response=await POST(request(x,'generic_'+randomUUID()));
  expect(response.status).toBe(200);expect(f.fetcher).toHaveBeenCalledTimes(1);
  expect(await f.db.usageEvent.count({where:{organizationId:x.organizationId}})).toBe(1);
  const holds=await f.db.aIUsageReservation.findMany({where:{organizationId:x.organizationId}});
  expect(holds).toHaveLength(1);expect(holds[0].status).toBe('pending_settlement');
 });
 it('an enabled service-default policy uses the pinned concrete service model',async()=>{
  const x=await fixture();
  await f.db.organizationAIProviderPolicy.update({where:{organizationId:x.organizationId},data:{modelSelections:{vercel_gateway:'service-default'}}});
  const response=await POST(request(x,'generic_'+randomUUID()));
  expect(response.status).toBe(200);expect(f.fetcher).toHaveBeenCalledTimes(1);
 });
 it('disabling policy after durable claim refuses final dispatch and burns the admission',async()=>{
  const x=await admittedFixture();
  await f.db.organizationAIProviderPolicy.update({where:{organizationId:x.organizationId},data:{enabled:false}});
  await expect(getAIProviderManager().generateTextWithAdmission('Synthetic policy check',options(x),x.admission)).rejects.toThrow();
  await f.db.organizationAIProviderPolicy.update({where:{organizationId:x.organizationId},data:{enabled:true}});
  await expect(getAIProviderManager().generateTextWithAdmission('Synthetic policy check',options(x),x.admission)).rejects.toThrow();
  expect(f.fetcher).not.toHaveBeenCalled();
  expect(await f.db.usageEvent.count({where:{organizationId:x.organizationId}})).toBe(0);
  expect((await f.db.aIUsageReservation.findMany({where:{organizationId:x.organizationId}}))[0].status).toBe('dispatch_unknown');
 });
 it('a changed selected model after claim refuses final dispatch',async()=>{
  const x=await admittedFixture();
  await f.db.organizationAIProviderPolicy.update({where:{organizationId:x.organizationId},data:{modelSelections:{vercel_gateway:'anthropic/claude-sonnet-4'}}});
  await expect(getAIProviderManager().generateTextWithAdmission('Synthetic policy check',options(x),x.admission)).rejects.toThrow();
  expect(f.fetcher).not.toHaveBeenCalled();
 });
 it('a different final model burns exact admitted authority without dispatch',async()=>{
  const x=await admittedFixture();
  await expect(getAIProviderManager().generateTextWithAdmission('Synthetic policy check',{...options(x),model:'anthropic/claude-sonnet-4'},x.admission)).rejects.toThrow();
  await expect(getAIProviderManager().generateTextWithAdmission('Synthetic policy check',options(x),x.admission)).rejects.toThrow();
  expect(f.fetcher).not.toHaveBeenCalled();
 });
 it('refuses final inference when workspace policy is disabled during the awaited financial claim',async()=>{
  const x=await fixture(),key='generic_'+randomUUID(),locked=deferred(),release=deferred();
  let post:Promise<Response>|undefined,setupError:unknown;
  let transportPolicy:boolean|null=null;
  const responseFactory=f.fetcher.getMockImplementation()!;
  f.fetcher.mockImplementation(async(input,init)=>{
   // Read the actual fixture row at the attempted installed-adapter send;
   // no request is forwarded and no SDK headers/prompt are persisted.
   const policy=await f.db.organizationAIProviderPolicy.findUnique({where:{organizationId:x.organizationId},select:{enabled:true}});
   transportPolicy=policy?.enabled??null;
   return responseFactory(input,init);
  });
  const lockTransaction=f.db.$transaction(async tx=>{
   const rows=await tx.$queryRawUnsafe<Array<{userId:string}>>('SELECT "userId" FROM "OrgMembership" WHERE "organizationId"=$1 AND "userId"=$2 FOR UPDATE',x.organizationId,x.userId);
   if(rows.length!==1)throw Error('exact_fixture_member_required');
   locked.resolve();await release.promise;
   await tx.organizationAIProviderPolicy.update({where:{organizationId:x.organizationId},data:{enabled:false}});
  },{maxWait:3000,timeout:10000});
  const lockObserved=lockTransaction.then(()=>undefined,error=>{throw error;});
  try{
   let timer:ReturnType<typeof setTimeout>|undefined;
   try{await Promise.race([locked.promise,lockObserved,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('member_lock_not_acquired')),3000);})]);}finally{if(timer)clearTimeout(timer);}
   post=POST(request(x,key));post.catch(()=>undefined);
   await waitReserved(x.organizationId,key);
   expect(f.fetcher).not.toHaveBeenCalled();
  }catch(error){setupError=error;}
  finally{
   release.resolve();
   const lockResults=await Promise.allSettled([lockObserved]);
   if(!setupError&&lockResults[0].status==='rejected')setupError=lockResults[0].reason;
  }
  const postResults=post?await Promise.allSettled([post]):[];
  const result=postResults[0],response=result?.status==='fulfilled'?result.value:undefined;
  const policy=await f.db.organizationAIProviderPolicy.findUnique({where:{organizationId:x.organizationId},select:{enabled:true}});
  const member=await f.db.orgMembership.findUnique({where:{userId_organizationId:{userId:x.userId,organizationId:x.organizationId}},select:{acceptedAt:true}});
  const holds=await f.db.aIUsageReservation.findMany({where:{organizationId:x.organizationId},select:{status:true,reservedCents:true,usageEventId:true}});
  const usageCount=await f.db.usageEvent.count({where:{organizationId:x.organizationId}});
  writeFileSync(root!+'/logs/policy-witness.json',JSON.stringify({scope:'synthetic owned local fixture; no real provider, session or customer database',postStatus:response?.status??null,fetchCount:f.fetcher.mock.calls.length,currentPolicyEnabled:policy?.enabled??null,transportTimePolicyEnabled:transportPolicy,memberStillAccepted:member?.acceptedAt instanceof Date,holds:holds.map(hold=>({status:hold.status,reservedCents:hold.reservedCents,usageLinked:hold.usageEventId!==null})),usageCount,setupFailure:setupError?{name:setupError instanceof Error?setupError.name:'unknown'}:null,routeRejected:result?.status==='rejected'},null,2)+'\n');
  if(setupError)throw setupError;
  if(!response)throw Error('actual_route_outcome_required');
  expect(policy?.enabled).toBe(false);expect(member?.acceptedAt).toBeInstanceOf(Date);
  // Desired invariant, intentionally RED if the actual adapter sends while
  // the stored provider policy is disabled. Never invert into acceptance.
  expect(f.fetcher).not.toHaveBeenCalled();
  expect(usageCount).toBe(0);expect(response.status).toBeGreaterThanOrEqual(400);
 },15000);
});
