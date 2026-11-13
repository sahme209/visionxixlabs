import 'server-only';
import {platformPrincipalSchema,type PlatformPrincipal} from '../contracts';
import type {PlatformAuthority} from '../actionStore';
import {readPlatformAction} from '../kernel';
import {readCustodianDrainPlan,compileCustodianDrainPlatformPlan} from './custodianDrainContract';
import type {CustodianClosureTransaction,CustodianClosureSnapshot} from './custodianClosureSnapshot';
import {compileCustodianClosureObservation,readCustodianClosureObservation,type CustodianClosureObservation,type CustodianClosureEvidence} from './custodianClosureObservation';
export interface CustodianClosureRepository{transaction<T>(fn:(tx:CustodianClosureTransaction & {readCustodianClosure(nativeKey:string):Promise<unknown|null>})=>Promise<T>):Promise<T>}
interface Source{
 /** Actual protected complete fleet/runtime/source+derived lifetime/time
  * receipts. No default supplier and never evidence supplied in request JSON. */
 readEvidence(tx:CustodianClosureTransaction,snapshot:CustodianClosureSnapshot):Promise<unknown>;
 assertCurrent(tx:CustodianClosureTransaction,snapshot:CustodianClosureSnapshot,evidence:CustodianClosureEvidence):Promise<void>;
}
const fail=():never=>{throw Error('platform_custodian_closure_unavailable')};
/** Supplemental local observation, not approval, replay or target recovery. */
export function createCustodianClosureService(repo:CustodianClosureRepository,authority:Pick<PlatformAuthority,'assertCurrent'>,source:Source){return Object.freeze({async observe(id:string,rawReader:PlatformPrincipal,refresh=false){
 try{
  if(!/^platform_action_[a-f0-9-]{36}$/.test(id)||typeof refresh!=='boolean')return fail();const reader=platformPrincipalSchema.parse(rawReader);
  return await repo.transaction(async tx=>{
   await tx.lock(id);await authority.assertCurrent(tx,reader);const parent=readPlatformAction(await tx.read(id)),control=readCustodianDrainPlan(await tx.readCustodianControl(id));
   if(parent.status!=='confirmed'||control.operation!=='begin'||compileCustodianDrainPlatformPlan(control).digest!==parent.plan.digest||await tx.readEffect(id,0)!=='confirmed')return fail();
   await tx.lockCustodian(control.nativeKey);const snapshot=await tx.readCustodianClosureSnapshot(control.nativeKey);if(snapshot.barrier.controlActionId!==id||snapshot.barrier.controlDigest!==control.digest)return fail();
   const existing=await tx.readCustodianClosure(control.nativeKey),now=await tx.now();
   if(existing&&!refresh){const saved=readCustodianClosureObservation(existing);if(saved.snapshot.digest===snapshot.digest&&saved.evidence.expiresAt>now){await authority.assertCurrent(tx,reader);return {observation:saved,historical:true,sourceValidation:'historical_not_checked' as const,executionAuthorized:false as const}}}
   const rawEvidence=await source.readEvidence(tx,snapshot),observation=compileCustodianClosureObservation(snapshot,rawEvidence,reader.userId,await tx.now());
   await source.assertCurrent(tx,snapshot,observation.evidence);await authority.assertCurrent(tx,reader);
   if((await tx.readCustodianClosureSnapshot(control.nativeKey)).digest!==snapshot.digest)return fail();
   await tx.event({actionId:id,kind:'custodian.closure_observed',state:parent,custodianClosure:observation});
   await source.assertCurrent(tx,snapshot,observation.evidence);await authority.assertCurrent(tx,reader);
   const after=await tx.now();if(after<observation.observedAt||after>=observation.evidence.expiresAt||(await tx.readCustodianClosureSnapshot(control.nativeKey)).digest!==snapshot.digest)return fail();
   return {observation,historical:false,sourceValidation:'checked_by_private_source' as const,executionAuthorized:false as const};
  });
 }catch{return fail()}
}})}
