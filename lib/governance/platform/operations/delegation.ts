import 'server-only';
import type {OperationalTargetReservations} from './reservationStore';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {platformPrincipalSchema,type PlatformPrincipal,type PlatformAction} from '../contracts';
import type {PlatformAuthority} from '../actionStore';
import {readPlatformAction} from '../kernel';
import {readOperationalManifest} from './kernel';
import {credentialOutcome,readOperationalDelegation,type OperationalDelegation,type OperationalDelegationRepository,type OperationalDelegationTransaction} from './delegationContract';
import {operationalWorkloadBinding,type createOperationalWorkloadIdentity} from './workloadIdentity';
interface Source{
 readManifest(tx:OperationalDelegationTransaction,parent:PlatformAction):Promise<unknown>;
 assertCurrent(tx:OperationalDelegationTransaction,manifest:OperationalDelegation['manifest']):Promise<void>;
}
type Identity=Pick<ReturnType<typeof createOperationalWorkloadIdentity>,'authenticate'|'consume'|'assertConsumedCurrent'>;
type Consumed=Awaited<ReturnType<Identity['consume']>>;
const fail=():never=>{throw Error('operational_delegation_unavailable')};
const same=(a:unknown,b:unknown)=>sha256ContentHash(a)===sha256ContentHash(b);
/** Private server composition. Workload is never relabeled a human. All phase
 * proofs stay in this instance, never in HTTP JSON or durable state. No provider
 * or credential mint function is accepted; source/profile defaults remain closed. */
export function createOperationalDelegationStore(repo:OperationalDelegationRepository,authority:Pick<PlatformAuthority,'assertCurrent'>,source:Source,identity:Identity,targets?:Pick<OperationalTargetReservations,'reserve'|'assertHeld'>){
 const claims=new WeakMap<object,{actionId:string;identity:Consumed}>(),issuance=new WeakMap<object,{actionId:string;version:number}>();
 const binding=(state:OperationalDelegation)=>({actionId:state.actionId,manifestDigest:state.manifest.digest,workload:state.manifest.workload,expiresAt:state.manifest.expiresAt});
 function match(parent:PlatformAction,state:OperationalDelegation){
  const m=state.manifest,e=parent.plan.effects[0];
  if(parent.plan.digest!==state.parentPlanDigest||!same(parent.requester,state.requester)||!same(parent.reviewer,state.reviewer)||parent.plan.sourceDigest!==m.digest||Date.parse(parent.plan.expiresAt)!==Date.parse(m.expiresAt)||parent.plan.effects.length!==1||e.kind!=='deployment.ecs')return fail();
  if(!same(e.target,{accountId:m.target.accountId,region:m.target.region,cluster:m.target.clusterArn,service:m.target.serviceArn,taskDefinitionArn:m.target.taskDefinitionArn,operation:m.operation,configurationDigest:m.digest}))return fail();
 }
 async function load(tx:OperationalDelegationTransaction,id:string){const value=readOperationalDelegation(await tx.readDelegation(id));if(value.actionId!==id)return fail();return value}
 async function current(tx:OperationalDelegationTransaction,state:OperationalDelegation,parentStatus:'approved'|'claimed'){
  const parent=readPlatformAction(await tx.read(state.actionId));match(parent,state);if(parent.status!==parentStatus)return fail();
  await authority.assertCurrent(tx,state.requester);await authority.assertCurrent(tx,state.reviewer);await source.assertCurrent(tx,state.manifest);await authority.assertCurrent(tx,state.requester);await authority.assertCurrent(tx,state.reviewer);
  const now=await tx.now();if(!Number.isSafeInteger(now)||now<state.updatedAt||now>=Date.parse(state.manifest.expiresAt))return fail();return {parent,now};
 }
 async function locked<T>(raw:string,fn:(tx:OperationalDelegationTransaction,id:string)=>Promise<T>){const id=operationalWorkloadBinding.shape.actionId.parse(raw);return repo.transaction(async tx=>{await tx.lock(id);return fn(tx,id)})}
 function projection(state:OperationalDelegation,now:number){const p=state.executionPrincipal;return Object.freeze({actionId:state.actionId,manifest:state.manifest,status:state.status,version:state.version,attemptCount:state.attemptCount,requesterUserId:state.requester.userId,reviewerUserId:state.reviewer.userId,executionPrincipal:p?{kind:p.kind,workload:p.workload,profileDigest:p.profileDigest,expiresAt:p.expiresAt}:null,credential:state.credential,targetReservation:state.targetReservation,expired:now>=Date.parse(state.manifest.expiresAt),authority:'delegation_history_only' as const,sourceValidation:'not_checked' as const,executionAuthorized:false as const,providerExecution:false as const})}
 async function event(tx:OperationalDelegationTransaction,parent:PlatformAction,state:OperationalDelegation,kind:'workload.delegated'|'workload.claimed'|'credential.pending'|'credential.observed'){
  await tx.event({actionId:state.actionId,state:parent,kind,operationalDigest:sha256ContentHash(state)});
 }
 return Object.freeze({
  async inspect(id:string,rawActor:PlatformPrincipal){const actor=platformPrincipalSchema.parse(rawActor);return locked(id,async(tx,key)=>{await authority.assertCurrent(tx,actor);const state=await load(tx,key),now=await tx.now();if(!Number.isSafeInteger(now)||now<state.updatedAt)return fail();await authority.assertCurrent(tx,actor);return projection(state,now)})},
  async delegate(id:string,parentVersion:number,parentDigest:string,rawActor:PlatformPrincipal){const actor=platformPrincipalSchema.parse(rawActor);return locked(id,async(tx,key)=>{
   const parent=readPlatformAction(await tx.read(key));if(parent.status!=='approved'||parent.version!==parentVersion||parent.plan.digest!==parentDigest||!same(actor,parent.requester)||await tx.readDelegation(key))return fail();
   await authority.assertCurrent(tx,actor);const manifest=readOperationalManifest(await source.readManifest(tx,parent));if(manifest.kind!=='deployment.ecs')return fail();
   const state=readOperationalDelegation({actionId:key,parentPlanDigest:parent.plan.digest,manifest,requester:parent.requester,reviewer:parent.reviewer,status:'delegated',version:0,attemptCount:0,executionPrincipal:null,targetReservation:null,credential:{status:'not_requested'},createdAt:await tx.now(),updatedAt:await tx.now()});
   await current(tx,state,'approved');await tx.insertDelegation(key,state);await event(tx,parent,state,'workload.delegated');await current(tx,state,'approved');return projection(state,await tx.now());
  })},
  async claim(id:string,expectedVersion:number,token:unknown){
   try{const result=await locked(id,async(tx,key)=>{
    const state=await load(tx,key);if(!targets||state.status!=='delegated'||state.version!==expectedVersion)return fail();const {parent}=await current(tx,state,'approved'),b=binding(state);
    const proof=await identity.authenticate(tx,token,b),principal=await identity.consume(tx,proof,b);if(principal.actionId!==key||principal.manifestDigest!==state.manifest.digest||!same(principal.workload,state.manifest.workload))return fail();
    const targetReservation=await targets.reserve(tx,{actionId:key,manifest:state.manifest});
    const {now}=await current(tx,state,'approved'),next=readOperationalDelegation({...state,targetReservation,status:'claimed',version:1,attemptCount:1,executionPrincipal:{kind:'workload',workload:principal.workload,profileDigest:principal.profileDigest,replayKey:principal.replayKey,expiresAt:principal.expiresAt},updatedAt:now});
    // A delegated workload transition, not claimPlatformAction(...requester):
    // actual executor identity is retained in the delegation and event kind.
    const claimed=readPlatformAction({...parent,status:'claimed',version:2,attemptCount:1,updatedAt:now});await tx.replace(key,parent.version,claimed);await tx.replaceDelegation(key,state.version,next);await event(tx,claimed,next,'workload.claimed');await current(tx,next,'claimed');await identity.assertConsumedCurrent(tx,principal,b);
    return {state:next,principal,now};
   });const proof=Object.freeze(Object.create(null)) as object;claims.set(proof,{actionId:result.state.actionId,identity:result.principal});return {proof,history:projection(result.state,result.now)};
   }catch{throw Error('operational_delegation_unconfirmed')}
  },
  async beginCredential(proof:object){const claimed=claims.get(proof);if(!claimed)return fail();claims.delete(proof);
   try{const result=await locked(claimed.actionId,async(tx,key)=>{
    const state=await load(tx,key);if(!targets||state.status!=='claimed'||state.version!==1||state.credential.status!=='not_requested'||state.executionPrincipal?.replayKey!==claimed.identity.replayKey)return fail();
    const {parent,now}=await current(tx,state,'claimed');await targets.assertHeld(tx,{actionId:key,manifest:state.manifest},state.targetReservation);await identity.assertConsumedCurrent(tx,claimed.identity,binding(state));const next=readOperationalDelegation({...state,version:2,credential:{status:'pending',requestedAt:now},updatedAt:now});
    await tx.replaceDelegation(key,state.version,next);await event(tx,parent,next,'credential.pending');await current(tx,next,'claimed');await targets.assertHeld(tx,{actionId:key,manifest:next.manifest},next.targetReservation);await identity.assertConsumedCurrent(tx,claimed.identity,binding(next));return {state:next,now};
   });const issuanceProof=Object.freeze(Object.create(null)) as object;issuance.set(issuanceProof,{actionId:result.state.actionId,version:result.state.version});return {proof:issuanceProof,history:projection(result.state,result.now)};
   }catch{throw Error('operational_credential_request_unconfirmed')}
  },
  /** Private observation only, including after human/source expiry or revocation.
   * Never discard knowledge of issued/unknown credentials to claim safety. */
  async observeCredential(proof:object,rawOutcome:unknown){const pending=issuance.get(proof);if(!pending)return fail();issuance.delete(proof);
   try{const outcome=credentialOutcome.parse(rawOutcome);return await locked(pending.actionId,async(tx,key)=>{
    const state=await load(tx,key);if(state.version!==pending.version||state.credential.status!=='pending')return fail();const now=await tx.now();if(!Number.isSafeInteger(now)||now<state.updatedAt)return fail();
    const next=readOperationalDelegation({...state,version:3,credential:{...outcome,requestedAt:state.credential.requestedAt,observedAt:now},updatedAt:now}),parent=readPlatformAction(await tx.read(key));match(parent,state);
    await tx.replaceDelegation(key,state.version,next);await event(tx,parent,next,'credential.observed');return projection(next,now);
   })}catch{throw Error('operational_credential_observation_unconfirmed')}
  },
 });
}
