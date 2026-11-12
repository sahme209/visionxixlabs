import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
import {createCustomerHostedTokenRepository,type CustomerHostedSqlRepository} from '../customerHostedTokenRepository';
import {createCustomerHostedTokenStore} from '../customerHostedTokenStore';
import {createCustomerHostedExtraction} from '../customerHostedExtraction';
import {parseCustomerHostedOperatorConfig} from '../customerHostedConfig';
const root=process.env.AXIOM_HOSTED_TOKEN_PG_ROOT;
describe.skipIf(!root)('customer-hosted ledger on owned PostgreSQL (no model)',()=>{
 let pool:Pool;
 beforeAll(async()=>{
  if(!root||!/^\/private\/tmp\/axiom-hosted-token-pg-[^/]+$/.test(root)||realpathSync(root)!==root||(statSync(root).mode&0o077)!==0)throw Error('owned_fixture_required');
  pool=new Pool({host:root+'/socket',port:55496,user:'token_fixture',database:'token_fixture',max:6,connectionTimeoutMillis:3000});
  const {rows}=await pool.query("SELECT current_database()='token_fixture' AND current_user='token_fixture' AND current_setting('listen_addresses')='' AS owned");
  if(!rows[0]?.owned)throw Error('owned_fixture_required');
 });
 afterAll(async()=>{await pool?.end()});
 function fixture(failEvent:boolean|((eventType:string)=>boolean)=false){
  const org='token-'+randomUUID();
  const db:CustomerHostedSqlRepository={$transaction:async(fn)=>{
   const client=await pool.connect();
   try{await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');await client.query("SET LOCAL statement_timeout='5s'");
    const value=await fn({$queryRawUnsafe:async<T>(sql:string,...args:unknown[])=>{const result=await client.query(sql,args);return result.rows as T},$executeRawUnsafe:async(sql,...args)=>{if((typeof failEvent==='function'?failEvent(String(args[4])):failEvent)&&sql.startsWith('INSERT INTO "DurableAgentWorkflowEvent"'))throw Error('synthetic_event_failure');return (await client.query(sql,args)).rowCount??0}});
    await client.query('COMMIT');return value;
   }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
  }};
  let budget={digest:'a'.repeat(64),windowId:'w1',limitTokens:100,startsAt:0,expiresAt:Date.now()+60000};
  const repository=createCustomerHostedTokenRepository(db),store=createCustomerHostedTokenStore(repository,async()=>budget);
  const request={installationId:'install',organizationId:org,actorId:'actor',requestDigest:'b'.repeat(64),modelId:'local-model',configDigest:'a'.repeat(64),windowId:'w1',reservedTokens:60};
  return {org,store,request,setBudget:(value:typeof budget)=>{budget=value},another:()=>createCustomerHostedTokenStore(repository,async()=>budget)};
 }
 it('serializes actual competing transactions without overspending',async()=>{
  const f=fixture(),results=await Promise.allSettled([f.store.reserveCustomerHostedCall(f.request),f.another().reserveCustomerHostedCall({...f.request,requestDigest:'c'.repeat(64)})]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  const {rows}=await pool.query('SELECT "stateJson",status FROM "DurableAgentWorkflow" WHERE "organizationId"=$1',[f.org]);
  expect(rows).toHaveLength(1);expect(rows[0].stateJson.reservedTokens).toBe(60);expect(rows[0].status).toBe('completed');
 });
 it('survives service recreation and refuses a second durable claim',async()=>{
  const f=fixture(),id=await f.store.reserveCustomerHostedCall(f.request),claim=await f.store.claimCustomerHostedCall(f.request,id);
  await expect(f.another().claimCustomerHostedCall(f.request,id)).rejects.toThrow();
  await f.store.settleCustomerHostedCall(claim,25);
  const {rows}=await pool.query('SELECT "eventType",sequence FROM "DurableAgentWorkflowEvent" WHERE "organizationId"=$1 ORDER BY sequence',[f.org]);
  expect(rows).toEqual([{eventType:'customer_hosted.reserved',sequence:0},{eventType:'customer_hosted.dispatched',sequence:1},{eventType:'customer_hosted.settled',sequence:2}]);
 });
 it('rolls back the reservation when its durable event is unconfirmed',async()=>{
  const f=fixture(true);await expect(f.store.reserveCustomerHostedCall(f.request)).rejects.toThrow('synthetic_event_failure');
  expect((await pool.query('SELECT id FROM "DurableAgentWorkflow" WHERE "organizationId"=$1',[f.org])).rows).toHaveLength(0);
 });
 it('keeps unknown old-window exposure after a new service and config',async()=>{
  const f=fixture(),id=await f.store.reserveCustomerHostedCall(f.request),claim=await f.store.claimCustomerHostedCall(f.request,id);await f.store.settleCustomerHostedCall(claim,null);
  f.setBudget({digest:'d'.repeat(64),windowId:'w2',limitTokens:100,startsAt:0,expiresAt:Date.now()+60000});
  await expect(f.another().reserveCustomerHostedCall({...f.request,requestDigest:'e'.repeat(64),configDigest:'d'.repeat(64),windowId:'w2'})).rejects.toThrow();
  expect((await pool.query('SELECT "stateJson" FROM "DurableAgentWorkflow" WHERE id=$1',[id])).rows[0].stateJson.status).toBe('unknown');
 });
 it('uses database time to refuse an expired budget before dispatch',async()=>{
  const f=fixture(),id=await f.store.reserveCustomerHostedCall(f.request);f.setBudget({digest:'a'.repeat(64),windowId:'w1',limitTokens:100,startsAt:0,expiresAt:1});
  await expect(f.store.claimCustomerHostedCall(f.request,id)).rejects.toThrow();
  expect((await pool.query('SELECT "stateJson" FROM "DurableAgentWorkflow" WHERE id=$1',[id])).rows[0].stateJson.status).toBe('reserved');
 });
 function snapshotFor(org:string){
  const config=parseCustomerHostedOperatorConfig(JSON.stringify({format:'axiom.customer-hosted/1',installationId:'install',revision:'r1',server:{kind:'vllm',baseUrl:'https://models.private.test/v1',allowedHosts:['models.private.test']},models:[{id:'local-model',maxInputTokens:40,maxOutputTokens:20,maxInputBytes:8192}],budgets:[{organizationId:org,windowId:'w1',startsAt:'2026-01-01T00:00:00.000Z',expiresAt:'2099-01-01T00:00:00.000Z',limitTokens:100}]}))!;
  return {config,modelId:'local-model',policyDigest:'d'.repeat(64),reservedTokens:60,windowId:'w1'};
 }
 it('composes the real ledger through one simulated model response and settlement',async()=>{
  const f=fixture(),snapshot=snapshotFor(f.org);f.setBudget({digest:snapshot.config.digest,windowId:'w1',limitTokens:100,startsAt:0,expiresAt:Date.now()+60000});
  const audit:unknown[]=[],oldMode=process.env.AXIOM_OFFLINE_MODE;process.env.AXIOM_OFFLINE_MODE='true';let sends=0;
  try{
   const extract=createCustomerHostedExtraction({organizationId:f.org,actorId:'actor'},{store:f.store,readCurrent:async()=>snapshot,assertActor:async()=>{},audit:async detail=>{audit.push(detail)},send:async input=>{await input.beforeSend();sends++;return {data:{ok:true},raw:'{}',promptTokens:10,completionTokens:10,totalTokens:20}}});
   expect(await extract('redacted input','shape','composed-1')).toMatchObject({data:{ok:true},usage:{totalTokens:20}});expect(sends).toBe(1);
   const row=(await pool.query('SELECT "stateJson" FROM "DurableAgentWorkflow" WHERE "organizationId"=$1',[f.org])).rows[0];expect(row.stateJson).toMatchObject({status:'settled',reservedTokens:60,reportedTokens:20});
   expect(audit).toEqual([{settlement:'customer_hosted_unpriced',outcome:'confirmed',modelId:'local-model',totalTokens:20}]);
  }finally{if(oldMode===undefined)delete process.env.AXIOM_OFFLINE_MODE;else process.env.AXIOM_OFFLINE_MODE=oldMode}
 });
 it('preserves an unknown database hold when authority is revoked after its claim',async()=>{
  const f=fixture(),snapshot=snapshotFor(f.org);f.setBudget({digest:snapshot.config.digest,windowId:'w1',limitTokens:100,startsAt:0,expiresAt:Date.now()+60000});
  const oldMode=process.env.AXIOM_OFFLINE_MODE;process.env.AXIOM_OFFLINE_MODE='true';let current=true,sends=0;
  try{
   const store={...f.store,claimCustomerHostedCall:async(...args:Parameters<typeof f.store.claimCustomerHostedCall>)=>{const claim=await f.store.claimCustomerHostedCall(...args);current=false;return claim}};
   const extract=createCustomerHostedExtraction({organizationId:f.org,actorId:'actor'},{store,readCurrent:async()=>{if(!current)throw Error('synthetic revocation');return snapshot},assertActor:async()=>{},audit:async()=>{},send:async input=>{await input.beforeSend();sends++;return {data:{},raw:'{}',promptTokens:1,completionTokens:1,totalTokens:2}}});
   await expect(extract('input','shape','composed-2')).rejects.toThrow();expect(sends).toBe(0);
   const row=(await pool.query('SELECT "stateJson" FROM "DurableAgentWorkflow" WHERE "organizationId"=$1',[f.org])).rows[0];expect(row.stateJson).toMatchObject({status:'unknown',reservedTokens:60,reportedTokens:null});
  }finally{if(oldMode===undefined)delete process.env.AXIOM_OFFLINE_MODE;else process.env.AXIOM_OFFLINE_MODE=oldMode}
 });
 it('rolls settlement back and retains dispatched exposure without a second settlement attempt',async()=>{
  let fail=false;const f=fixture(()=>fail),snapshot=snapshotFor(f.org);f.setBudget({digest:snapshot.config.digest,windowId:'w1',limitTokens:100,startsAt:0,expiresAt:Date.now()+60000});
  const oldMode=process.env.AXIOM_OFFLINE_MODE;process.env.AXIOM_OFFLINE_MODE='true';let settlements=0;
  try{
   const store={...f.store,settleCustomerHostedCall:async(...args:Parameters<typeof f.store.settleCustomerHostedCall>)=>{settlements++;return f.store.settleCustomerHostedCall(...args)}};
   const extract=createCustomerHostedExtraction({organizationId:f.org,actorId:'actor'},{store,readCurrent:async()=>snapshot,assertActor:async()=>{},audit:async()=>{},send:async input=>{await input.beforeSend();fail=true;return {data:{},raw:'{}',promptTokens:1,completionTokens:1,totalTokens:2}}});
   await expect(extract('input','shape','composed-3')).rejects.toThrow();expect(settlements).toBe(1);
   const row=(await pool.query('SELECT "stateJson" FROM "DurableAgentWorkflow" WHERE "organizationId"=$1',[f.org])).rows[0];expect(row.stateJson).toMatchObject({status:'dispatched',reservedTokens:60,reportedTokens:null});
   expect((await pool.query('SELECT sequence FROM "DurableAgentWorkflowEvent" WHERE "organizationId"=$1 ORDER BY sequence',[f.org])).rows).toEqual([{sequence:0},{sequence:1}]);
  }finally{if(oldMode===undefined)delete process.env.AXIOM_OFFLINE_MODE;else process.env.AXIOM_OFFLINE_MODE=oldMode}
 });

 it('rolls back an actual dispatch claim when cancellation arrives before commit',async()=>{
  const controller=new AbortController(),f=fixture(type=>{if(type==='customer_hosted.dispatched')controller.abort();return false});
  const id=await f.store.reserveCustomerHostedCall(f.request);await expect(f.store.claimCustomerHostedCall(f.request,id,controller.signal)).rejects.toThrow();
  expect((await pool.query('SELECT "stateJson" FROM "DurableAgentWorkflow" WHERE id=$1',[id])).rows[0].stateJson.status).toBe('reserved');
  expect((await pool.query('SELECT sequence FROM "DurableAgentWorkflowEvent" WHERE "organizationId"=$1',[f.org])).rows).toEqual([{sequence:0}]);
 });

});
