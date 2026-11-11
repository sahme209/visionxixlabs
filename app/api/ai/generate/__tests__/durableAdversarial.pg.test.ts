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
describe.skipIf(!root)('fresh owned generic AI adversarial composition',()=>{
 beforeAll(async()=>{
  if(!/^\/private\/tmp\/axiom-generic-ai-adversarial-pg-[^/]+$/.test(root!))throw Error('owned_root_required');
  const socket=process.env.AXIOM_GENERIC_AI_PG_SOCKET!,client=process.env.AXIOM_GENERIC_AI_PG_CLIENT!;
  if(socket!==root+'/socket'||client!==root+'/generated/index.js'||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||realpathSync(client)!==client)throw Error('owned_private_client_required');
  const {PrismaClient}=createRequire(import.meta.url)(client);
  f.db=new PrismaClient({datasources:{db:{url:'postgresql://generic_ai_adversarial_fixture@localhost:55493/axiom_generic_ai_adversarial_fixture?host='+encodeURIComponent(socket)}}});
  expect(await f.db.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('listen_addresses') AS listen,current_setting('data_directory') AS data")).toEqual([{db:'axiom_generic_ai_adversarial_fixture',role:'generic_ai_adversarial_fixture',listen:'',data:root+'/data'}]);
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
   if(String(input)!=='https://ai-gateway.vercel.sh/v4/ai/language-model')throw Error('unexpected_synthetic_destination');
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
 it('admits exactly one of three concurrent same-key submissions with one linked usage',async()=>{
  const x=await fixture(),key='generic_'+randomUUID(),entered=deferred(),release=deferred();
  const responseFactory=f.fetcher.getMockImplementation()!;
  f.fetcher.mockImplementation(async(input,init)=>{entered.resolve();await release.promise;return responseFactory(input,init);});
  const requests=Array.from({length:3},()=>POST(request(x,key)));
  const settled=Promise.allSettled(requests);
  let rendezvousError:unknown;
  try{
   // A bounded transport rendezvous proves dispatch actually started without
   // assuming scheduler ordering or sleeping to manufacture a race.
   let timer:ReturnType<typeof setTimeout>|undefined;
   try{await Promise.race([entered.promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('dispatch_not_entered')),3000);})]);}finally{if(timer)clearTimeout(timer);}
  }catch(error){rendezvousError=error;}finally{release.resolve();}
  const results=await settled;
  if(rendezvousError)throw rendezvousError;
  const responses=results.map(result=>{if(result.status!=='fulfilled')throw result.reason;return result.value;});
  expect(responses.filter(response=>response.status===200)).toHaveLength(1);
  expect(responses.filter(response=>response.status>=400)).toHaveLength(2);
  expect(f.fetcher).toHaveBeenCalledTimes(1);
  const holds=await f.db.aIUsageReservation.findMany({where:{organizationId:x.organizationId}});expect(holds).toHaveLength(1);
  expect(holds[0]).toMatchObject({idempotencyKey:key,status:'pending_settlement',reservedCents:1000,settledCents:null});
  const usage=await f.db.usageEvent.findMany({where:{organizationId:x.organizationId}});expect(usage).toHaveLength(1);
  expect(usage[0]).toMatchObject({id:holds[0].usageEventId,organizationId:x.organizationId,triggeredBy:x.userId,externalUsageId:f.generation,billingStatus:'pending'});
 },15000);

 async function beforeClaim(kind:'revoke'|'expire'){
  const x=await fixture(),key='generic_'+randomUUID(),locked=deferred(),release=deferred();
  let post:Promise<Response>|undefined;
  let holdId:string|undefined;
  const lockTransaction=f.db.$transaction(async tx=>{
   const rows=await tx.$queryRawUnsafe<Array<{userId:string}>>('SELECT "userId" FROM "OrgMembership" WHERE "organizationId"=$1 AND "userId"=$2 FOR UPDATE',x.organizationId,x.userId);
   if(rows.length!==1)throw Error('exact_fixture_member_required');
   locked.resolve();await release.promise;
   if(kind==='revoke')await tx.orgMembership.update({where:{userId_organizationId:{organizationId:x.organizationId,userId:x.userId}},data:{acceptedAt:null}});
   if(kind==='expire'){
    if(!holdId)throw Error('fresh_hold_required');
    const rows=await tx.$queryRawUnsafe<Array<{id:string}>>('UPDATE "AIUsageReservation" SET "expiresAt"=(clock_timestamp() AT TIME ZONE \'UTC\') - interval \'1 second\' WHERE id=$1 AND "organizationId"=$2 AND status=\'reserved\' AND "usageEventId" IS NULL RETURNING id',holdId,x.organizationId);
    if(rows.length!==1||rows[0].id!==holdId)throw Error('exact_fresh_hold_expiry_required');
   }
  },{maxWait:3000,timeout:10000});
  // Observe rejection immediately, including failure before the lock rendezvous.
  const lockObserved=lockTransaction.then(()=>undefined,error=>{throw error;});
  let setupError:unknown;
  try{
   let timer:ReturnType<typeof setTimeout>|undefined;
   try{await Promise.race([locked.promise,lockObserved,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('member_lock_not_acquired')),3000);})]);}finally{if(timer)clearTimeout(timer);}
   post=POST(request(x,key));post.catch(()=>undefined);
   const hold=await waitReserved(x.organizationId,key);holdId=hold.id;
   expect(f.fetcher).not.toHaveBeenCalled();
  }catch(error){setupError=error;}
  finally{
   release.resolve();
   const lockResult=await Promise.allSettled([lockObserved]);
   // Commit the revocation/expiry before waiting for the actual blocked claim.
   if(!setupError&&lockResult[0].status==='rejected')setupError=lockResult[0].reason;
  }
  const postResult=post?await Promise.allSettled([post]):[];
  if(setupError)throw setupError;
  if(!postResult.length||postResult[0].status!=='fulfilled')throw Error('actual_route_outcome_required');
  expect(postResult[0].value.status).toBeGreaterThanOrEqual(400);
  expect(f.fetcher).not.toHaveBeenCalled();expect(await f.db.usageEvent.count({where:{organizationId:x.organizationId}})).toBe(0);
  const holds=await f.db.aIUsageReservation.findMany({where:{organizationId:x.organizationId}});expect(holds).toHaveLength(1);
  expect(holds[0]).toMatchObject({id:holdId,status:'reserved',reservedCents:1000,usageEventId:null,settledCents:null});
  const member=await f.db.orgMembership.findUnique({where:{userId_organizationId:{organizationId:x.organizationId,userId:x.userId}}});
  if(kind==='revoke')expect(member?.acceptedAt).toBeNull();else{expect(member?.acceptedAt).toBeInstanceOf(Date);expect(holds[0].expiresAt.getTime()).toBeLessThan(Date.now());}
 }
 it('refuses when the accepted member is revoked while the real claim waits on its row lock',async()=>{await beforeClaim('revoke');},15000);
 it('refuses when the newly reserved hold expires by database clock before its blocked claim',async()=>{await beforeClaim('expire');},15000);
});
