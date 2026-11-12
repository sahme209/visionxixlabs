import 'server-only';
import type {PlatformAuthority,PlatformTransaction} from '../actionStore';
import {platformPrincipalSchema,type PlatformPrincipal,type PlatformAction} from '../contracts';
import {createPlatformAction,readPlatformAction,approvePlatformAction,claimPlatformAction,finishPlatformAction} from '../kernel';
import {preparationActionReference} from '../preparationReference';
import {compileCustodianDrainPlan,readCustodianDrainPlan,compileCustodianDrainPlatformPlan,type CustodianDrainPlan} from './custodianDrainContract';
import {readCustodianBarrier,transitionCustodianBarrier,type CustodianBarrier} from './custodianDrainKernel';
export interface CustodianDrainTransaction extends PlatformTransaction{
 readCustodianControl(actionId:string):Promise<unknown>;
 lockCustodian(nativeKey:string):Promise<void>;
 readCustodianBarrier(nativeKey:string):Promise<unknown|null>;
 writeCustodianBarrier(nativeKey:string,expectedVersion:number|null,state:CustodianBarrier):Promise<void>;
 /** Must cover ALL original pending/unknown slots, never local expiry cleanup. */
 assertNoCustodianIntents(nativeKey:string):Promise<void>;
}
export interface CustodianDrainRepository{transaction<T>(fn:(tx:CustodianDrainTransaction)=>Promise<T>):Promise<T>}
interface Source{
 /** Protected current profile/runtime/admission source; no default supplier. */
 assertCurrent(tx:CustodianDrainTransaction,control:CustodianDrainPlan):Promise<void>;
 /** Fresh complete source/fleet/time qualification, NOT identity-probe success. */
 assertAbortSafe(tx:CustodianDrainTransaction,control:CustodianDrainPlan,barrier:CustodianBarrier):Promise<void>;
}
const fail=():never=>{throw Error('platform_custodian_control_unavailable')};
const actionId=/^platform_action_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
/** Local platform-control service. No native credential/IAM/process operation.
 * All transitions share the physical issuer lock with future intent admission.
 * Repositories lacking that serialization are not qualified for mounting. */
export function createCustodianDrainService(repo:CustodianDrainRepository,authority:PlatformAuthority,source:Source){
 async function load(tx:CustodianDrainTransaction,id:string){const state=readPlatformAction(await tx.read(id)),control=readCustodianDrainPlan(await tx.readCustodianControl(id));if(compileCustodianDrainPlatformPlan(control).digest!==state.plan.digest)fail();return {state,control}}
 async function current(tx:CustodianDrainTransaction,state:PlatformAction,control:CustodianDrainPlan,actor:PlatformPrincipal){
  await authority.assertCurrent(tx,actor);await authority.assertCurrent(tx,state.requester);if(state.reviewer)await authority.assertCurrent(tx,state.reviewer);
  await source.assertCurrent(tx,control);
  await authority.assertCurrent(tx,actor);await authority.assertCurrent(tx,state.requester);if(state.reviewer)await authority.assertCurrent(tx,state.reviewer);
  const now=await tx.now();if(!Number.isSafeInteger(now)||now<state.updatedAt||now>=Date.parse(control.expiresAt))fail();return now;
 }
 async function predecessor(tx:CustodianDrainTransaction,control:CustodianDrainPlan){const raw=await tx.readCustodianBarrier(control.nativeKey);return raw===null?null:readCustodianBarrier(raw)}
 async function locked<T>(id:string,fn:(tx:CustodianDrainTransaction,loaded:Awaited<ReturnType<typeof load>>)=>Promise<T>){if(!actionId.test(id))fail();return repo.transaction(async tx=>{await tx.lock(id);const loaded=await load(tx,id);await tx.lockCustodian(loaded.control.nativeKey);return fn(tx,loaded)})}
 return Object.freeze({
  async prepare(raw:unknown,principal:PlatformPrincipal,reference:string){
   const actor=platformPrincipalSchema.parse(principal),control=compileCustodianDrainPlan(raw),plan=compileCustodianDrainPlatformPlan(control),id=preparationActionReference(reference,actor,'platform_custodian_drain_preparation_v1');
   return repo.transaction(async tx=>{await tx.lock(id);await authority.assertCurrent(tx,actor);const existing=await tx.read(id);
    if(existing){const saved=await load(tx,id);if(saved.state.requester.userId!==actor.userId||saved.state.requester.sessionId!==actor.sessionId||saved.control.digest!==control.digest)fail();await authority.assertCurrent(tx,actor);return {actionId:id,planDigest:saved.state.plan.digest,historical:true as const}}
    await tx.lockCustodian(control.nativeKey);const state=createPlatformAction(plan,actor,await tx.now()),now=await current(tx,state,control,actor),prior=await predecessor(tx,control);transitionCustodianBarrier(prior,control,id,now);
    await tx.insert(id,state);await tx.event({actionId:id,kind:'proposed',state,custodianControl:control});await current(tx,state,control,actor);return {actionId:id,planDigest:plan.digest,historical:false as const};
   });
  },
  async review(id:string,version:number,planDigest:string,principal:PlatformPrincipal){const actor=platformPrincipalSchema.parse(principal);return locked(id,async(tx,{state,control})=>{
   if(state.version!==version||state.plan.digest!==planDigest)fail();const now=await current(tx,state,control,actor),prior=await predecessor(tx,control);transitionCustodianBarrier(prior,control,id,now);
   const next=approvePlatformAction(state,{...actor,planDigest},now);await tx.replace(id,version,next);await tx.event({actionId:id,kind:'approved',state:next});await current(tx,next,control,actor);
  })},
  async execute(id:string,version:number,principal:PlatformPrincipal){const actor=platformPrincipalSchema.parse(principal);return locked(id,async(tx,{state,control})=>{
   if(state.version!==version)fail();let now=await current(tx,state,control,actor);const prior=await predecessor(tx,control);let nextBarrier=transitionCustodianBarrier(prior,control,id,now);
   const claimed=claimPlatformAction(state,actor,now);
   if(control.operation==='abort'){if(prior===null)return fail();await source.assertAbortSafe(tx,control,prior);await tx.assertNoCustodianIntents(control.nativeKey)}
   now=await current(tx,state,control,actor);nextBarrier=transitionCustodianBarrier(prior,control,id,now);
   await tx.replace(id,version,claimed);await tx.event({actionId:id,kind:'claimed',state:claimed});
   await tx.writeEffect(id,0,null,'claimed');await tx.event({actionId:id,kind:'effect.claimed',state:claimed,effectIndex:0});
   await tx.writeCustodianBarrier(control.nativeKey,prior?.version??null,nextBarrier);
   await tx.writeEffect(id,0,'claimed','confirmed');const confirmed=finishPlatformAction(claimed,'confirmed',await tx.now());await tx.replace(id,claimed.version,confirmed);await tx.event({actionId:id,kind:'effect.observed',state:confirmed,effectIndex:0,outcome:'confirmed',custodianBarrier:nextBarrier});
   await current(tx,confirmed,control,actor);
   if(control.operation==='abort'){await source.assertAbortSafe(tx,control,prior!);await tx.assertNoCustodianIntents(control.nativeKey);await current(tx,confirmed,control,actor)}
   return {actionId:id,status:'confirmed' as const,barrier:nextBarrier,executionAuthorized:false as const,closureObserved:false as const};
  })},
 });
}
