import {readCustodianClosureObservation} from './custodianClosureObservation';
import {compileCustodianClosureSnapshot,type CustodianClosureTransaction} from './custodianClosureSnapshot';
import {readCustodianIntent} from './custodianIntentContract';
import {assertCustodianAdmission} from './custodianDrainKernel';
import type {CustodianIntentTransaction} from './custodianIntentAdmission';
import 'server-only';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {digest} from '../contracts';
import {readPlatformAction} from '../kernel';
import type {PlatformSql} from '../sqlRepository';
import type {PlatformTransaction} from '../actionStore';
import {readCustodianDrainPlan,compileCustodianDrainPlatformPlan} from './custodianDrainContract';
import {readCustodianBarrier,transitionCustodianBarrier,type CustodianBarrier} from './custodianDrainKernel';
import type {CustodianDrainTransaction} from './custodianDrainStore';
const fail=():never=>{throw Error('platform_custodian_storage_unavailable')};
const same=(a:unknown,b:unknown)=>sha256ContentHash(a)===sha256ContentHash(b);
/** Private transaction-only adapter. Never opens a database or qualifies a
 * profile/fleet. The SAME physical lock is required for intent admission. */
export function createCustodianDrainSqlMethods(sql:PlatformSql,getTx:()=>PlatformTransaction,check:(id:string)=>void):Pick<CustodianDrainTransaction,'readCustodianControl'|'lockCustodian'|'readCustodianBarrier'|'writeCustodianBarrier'|'assertNoCustodianIntents'> & Pick<CustodianIntentTransaction,'readCustodianIntent'|'insertCustodianIntent'> & Pick<CustodianClosureTransaction,'readCustodianClosureSnapshot'|'readCustodianClosure'|'readCustodianClosureHistory'>{
 let issuerKey:string|null=null,written:CustodianBarrier|null=null;
 function issuer(raw:string){const key=digest.parse(raw);if(issuerKey!==key)fail();return key}
 async function controlFor(id:string,parent:unknown){
  const rows=await sql.$queryRawUnsafe<Array<{control:unknown}>>('SELECT "detailJson"->\'custodianControl\' AS control FROM "PlatformGovernanceEvent" WHERE "actionId"=$1 AND kind=\'proposed\' AND "detailJson" ? \'custodianControl\' ORDER BY sequence LIMIT 2',id);
  if(rows.length!==1)fail();const control=readCustodianDrainPlan(rows[0].control),state=readPlatformAction(parent);if(compileCustodianDrainPlatformPlan(control).digest!==state.plan.digest)fail();return control;
 }
 async function readBarrier(raw:string):Promise<CustodianBarrier|null>{
  const key=issuer(raw),rows=await sql.$queryRawUnsafe<Array<{stateJson:unknown;version:number;controlActionId:string;parent:unknown;receipt:unknown}>>('SELECT b."stateJson",b.version,b."controlActionId",a."stateJson" AS parent,e."detailJson"->\'custodianBarrier\' AS receipt FROM "PlatformCustodianBarrier" b JOIN "PlatformGovernanceAction" a ON a.id=b."controlActionId" LEFT JOIN "PlatformGovernanceEvent" e ON e."actionId"=a.id AND e.kind=\'effect.observed\' AND e."detailJson" ? \'custodianBarrier\' WHERE b."nativeKey"=$1 LIMIT 2',key);
  if(rows.length===0)return null;if(rows.length!==1)fail();const row=rows[0],state=readCustodianBarrier(row.stateJson);
  if(state.nativeKey!==key||state.version!==row.version||state.controlActionId!==row.controlActionId)fail();
  const parent=readPlatformAction(row.parent),control=await controlFor(state.controlActionId,parent);if(control.digest!==state.controlDigest||control.nativeKey!==key)fail();
  if(written&&same(state,written)&&(parent.status==='claimed'||parent.status==='confirmed'))return state;
  if(parent.status!=='confirmed'||!same(readCustodianBarrier(row.receipt),state))fail();return state;
 }
 async function readClosureFor(barrier:CustodianBarrier){
  const rows=await sql.$queryRawUnsafe<Array<{sequence:number;observation:unknown}>>('SELECT sequence,"detailJson"->\'custodianClosure\' AS observation FROM "PlatformGovernanceEvent" WHERE "actionId"=$1 AND kind=\'custodian.closure_observed\' ORDER BY sequence DESC LIMIT 1',barrier.controlActionId);
  if(rows.length===0)return null;const saved=readCustodianClosureObservation(rows[0].observation);if(!same(saved.snapshot.barrier,barrier))fail();return saved;
 }
 async function snapshotFor(raw:string,originalBarrier?:CustodianBarrier){
   const key=issuer(raw);await getTx().now();const actual=await readBarrier(key);if(!actual)return fail();const barrier=originalBarrier?readCustodianBarrier(originalBarrier):actual;
   if(barrier.nativeKey!==key||barrier.issuerProfileDigest!==actual.issuerProfileDigest||barrier.admissionDigest!==actual.admissionDigest)fail();
   if(originalBarrier&&!same(actual,originalBarrier)&&(!written||!same(actual,written)||actual.mode!=='admitting'||actual.version!==originalBarrier.version+1||actual.generation!==originalBarrier.generation))fail();
   // One statement snapshot; lock each original delegation in the scalar
   // subquery. A missing delegation remains NULL and REFUSES projection, never
   // disappears through an inner join. Row locks last to transaction end.
   const rows=await sql.$queryRawUnsafe<unknown[]>('SELECT i.id,i."nativeKey",i."actionId",i."stateJson" AS "intentJson",a."stateJson" AS "parentJson",(SELECT d."stateJson" FROM "PlatformOperationalDelegation" d WHERE d."actionId"=i."actionId" FOR SHARE) AS "delegationJson" FROM "PlatformCustodianIntent" i JOIN "PlatformGovernanceAction" a ON a.id=i."actionId" WHERE i."nativeKey"=$1 ORDER BY i.id LIMIT 129 FOR SHARE OF i,a',key);
   return compileCustodianClosureSnapshot(barrier,rows);
 }

 return {
  async readCustodianControl(id){check(id);return controlFor(id,await getTx().read(id))},
  async lockCustodian(raw){const key=digest.parse(raw);if(issuerKey!==null)fail();await sql.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))','axiom-platform-custodian:'+key);issuerKey=key},
  readCustodianBarrier:readBarrier,
  async writeCustodianBarrier(raw,expectedVersion,rawState){
   const key=issuer(raw),state=readCustodianBarrier(rawState),tx=getTx();check(state.controlActionId);
   const parent=readPlatformAction(await tx.read(state.controlActionId)),control=await controlFor(state.controlActionId,parent),prior=await readBarrier(key);
   if(parent.status!=='claimed'||await tx.readEffect(state.controlActionId,0)!=='claimed'||state.nativeKey!==key||(prior?.version??null)!==expectedVersion||written)fail();
   const now=await tx.now();if(state.updatedAt>now||!same(transitionCustodianBarrier(prior,control,state.controlActionId,state.updatedAt),state))fail();
   const count=prior===null?await sql.$executeRawUnsafe('INSERT INTO "PlatformCustodianBarrier" ("nativeKey","controlActionId",version,"stateJson") VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT ("nativeKey") DO NOTHING',key,state.controlActionId,state.version,JSON.stringify(state)):await sql.$executeRawUnsafe('UPDATE "PlatformCustodianBarrier" SET "controlActionId"=$1,version=$2,"stateJson"=$3::jsonb WHERE "nativeKey"=$4 AND version=$5 AND "stateJson"=$6::jsonb',state.controlActionId,state.version,JSON.stringify(state),key,expectedVersion,JSON.stringify(prior));
   if(count!==1)fail();written=state;
  },
  readCustodianClosureSnapshot:snapshotFor,
  async readCustodianClosureHistory(id,afterSequence){
   check(id);const parent=readPlatformAction(await getTx().read(id)),control=await controlFor(id,parent),rows=await sql.$queryRawUnsafe<Array<{sequence:number;observation:unknown}>>('SELECT sequence,"detailJson"->\'custodianClosure\' AS observation FROM "PlatformGovernanceEvent" WHERE "actionId"=$1 AND kind=\'custodian.closure_observed\' AND sequence>$2 ORDER BY sequence LIMIT 33',id,afterSequence);if(!Number.isInteger(afterSequence)||afterSequence< -1||afterSequence>2147483647)fail();
   let previous=afterSequence;const observations=rows.map(row=>{if(!Number.isInteger(row.sequence)||row.sequence<=previous||row.sequence>2147483647)fail();previous=row.sequence;const record=readCustodianClosureObservation(row.observation);if(record.snapshot.barrier.controlActionId!==id||record.snapshot.barrier.controlDigest!==control.digest||record.snapshot.barrier.nativeKey!==control.nativeKey)fail();return record});return {observations:observations.slice(0,32),nextSequence:rows.length>32?rows[31].sequence:null};
  },
  async readCustodianClosure(raw){const key=issuer(raw),barrier=await readBarrier(key);return barrier===null?null:readClosureFor(barrier)},
  async readCustodianIntent(id){
   if(!/^platform_intent_[a-f0-9]{64}$/.test(id))fail();const rows=await sql.$queryRawUnsafe<Array<{id:string;nativeKey:string;actionId:string;stateJson:unknown}>>('SELECT id,"nativeKey","actionId","stateJson" FROM "PlatformCustodianIntent" WHERE id=$1',id);
   if(rows.length===0)return null;if(rows.length!==1)fail();const row=rows[0],state=readCustodianIntent(row.stateJson);check(state.actionId);issuer(state.nativeKey);if(row.id!==state.id||row.nativeKey!==state.nativeKey||row.actionId!==state.actionId)fail();return state;
  },
  async insertCustodianIntent(raw){
   const state=readCustodianIntent(raw),key=issuer(state.nativeKey),tx=getTx();check(state.actionId);const parent=readPlatformAction(await tx.read(state.actionId)),barrier=await readBarrier(key),now=await tx.now();
   if(parent.status!=='claimed'||parent.plan.sourceDigest!==state.manifestDigest||state.createdAt>now||state.createdAt<parent.updatedAt||now>=Date.parse(parent.plan.expiresAt))fail();
   assertCustodianAdmission(barrier,{nativeKey:key,issuerProfileDigest:state.issuerProfileDigest,admissionDigest:state.admissionDigest,generation:state.generation,version:state.barrierVersion});
   const count=await sql.$executeRawUnsafe('INSERT INTO "PlatformCustodianIntent" (id,"nativeKey","actionId","stateJson") VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (id) DO NOTHING',state.id,key,state.actionId,JSON.stringify(state));if(count!==1)fail();
  },
  async assertNoCustodianIntents(raw,originalBarrier){
   const key=issuer(raw);const rows=await sql.$queryRawUnsafe<Array<{held:number}>>('SELECT 1 AS held FROM "PlatformCustodianIntent" WHERE "nativeKey"=$1 LIMIT 1',key);
   // No expiry/deletion shortcut or reset. Qualified closure is separate.
   if(rows.length!==0){const snapshot=await snapshotFor(key,originalBarrier),saved=await readClosureFor(snapshot.barrier);if(!saved||saved.snapshot.digest!==snapshot.digest||await getTx().now()>=saved.evidence.expiresAt)fail();}
  },
 };
}
/** Existing immutable platform events retain the full control and exact barrier
 * receipt; no parallel approval/audit system or synthetic completed receipt. */
export async function custodianEventDetail(tx:CustodianClosureTransaction,event:Parameters<PlatformTransaction['event']>[0]){
 const control=event.custodianControl===undefined?undefined:readCustodianDrainPlan(event.custodianControl),barrier=event.custodianBarrier===undefined?undefined:readCustodianBarrier(event.custodianBarrier),closure=event.custodianClosure===undefined?undefined:readCustodianClosureObservation(event.custodianClosure);
 if(control){
  if(event.kind!=='proposed'||event.state.status!=='proposed'||compileCustodianDrainPlatformPlan(control).digest!==event.state.plan.digest||event.ecsManifest!==undefined||event.settingsManifest!==undefined||barrier!==undefined)fail();
 }
 if(barrier){
  if(event.kind!=='effect.observed'||event.state.status!=='confirmed'||event.outcome!=='confirmed'||event.effectIndex!==0||barrier.controlActionId!==event.actionId||event.state.plan.sourceDigest!==barrier.controlDigest||!same(await tx.readCustodianBarrier(barrier.nativeKey),barrier)||!same(await tx.read(event.actionId),event.state))fail();
 }
 if(closure){
  const b=closure.snapshot.barrier,now=await tx.now();if(event.kind!=='custodian.closure_observed'||event.state.status!=='confirmed'||event.actionId!==b.controlActionId||event.state.plan.sourceDigest!==b.controlDigest||control||barrier||event.ecsManifest||event.settingsManifest||closure.observedAt>now||now>=closure.evidence.expiresAt||!same(await tx.read(event.actionId),event.state)||(await tx.readCustodianClosureSnapshot(b.nativeKey)).digest!==closure.snapshot.digest)fail();
 }else if(event.kind==='custodian.closure_observed')fail();
 return {...(closure?{custodianClosure:closure}:{}),...(control?{custodianControl:control}:{}),...(barrier?{custodianBarrier:barrier}:{})};
}
