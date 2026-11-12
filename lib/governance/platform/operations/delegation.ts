import {custodianCredentialObservation,type CustodianCredentialObservation} from './custodianCredentialContract';
import {readOperationalStabilityHistory} from './stabilityHistory';
import {createOperationalEcsResult,readOperationalEcsResult,type OperationalEcsResult,type OperationalEcsTransport} from './ecsExecution';
import {projectOperationalEcsAcceptance} from './ecsProtocol';
import {readOperationalTarget} from './reservationContract';
import {finishPlatformAction} from '../kernel';
import {z} from 'zod';
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
export interface OperationalCredentialIssuer{
 assertQualified(tx:OperationalDelegationTransaction,manifest:OperationalDelegation['manifest']):Promise<void>;
 assertSourceCurrent?(tx:OperationalDelegationTransaction,manifest:OperationalDelegation['manifest'],metadata:CustodianCredentialObservation):Promise<void>;
 /** Private fixed issuer; no raw token/role/target from request JSON. */
 issue(manifest:OperationalDelegation['manifest'],beforeIssue:()=>Promise<void>,signal:AbortSignal,recordSource?:(metadata:CustodianCredentialObservation)=>Promise<void>):Promise<unknown>;
}
const privateCredential=z.object({leaseRef:z.string().regex(/^platform_credential_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/),accessKeyId:z.string().min(1).max(128),secretAccessKey:z.string().min(1).max(8192),sessionToken:z.string().min(1).max(16384),expiresAt:z.number().int().nonnegative().safe()}).strict().refine(v=>[v.accessKeyId,v.secretAccessKey,v.sessionToken].every(s=>!/[\s\x00-\x1f\x7f]/.test(s)));
const fail=():never=>{throw Error('operational_delegation_unavailable')};
const same=(a:unknown,b:unknown)=>sha256ContentHash(a)===sha256ContentHash(b);
/** Private server composition. Workload is never relabeled a human. All phase
 * proofs stay in this instance, never in HTTP JSON or durable state. Optional private issuance is bounded and recorded before any later use;
 * source/profile defaults remain closed and no provider send is exposed. */
export function createOperationalDelegationStore(repo:OperationalDelegationRepository,authority:Pick<PlatformAuthority,'assertCurrent'>,source:Source,identity:Identity,targets?:Pick<OperationalTargetReservations,'reserve'|'assertHeld'> & Partial<Pick<OperationalTargetReservations,'observe'|'assertTerminalCurrent'>>,issuer?:OperationalCredentialIssuer,transport?:OperationalEcsTransport){
 const claims=new WeakMap<object,{actionId:string;identity:Consumed}>(),issuance=new WeakMap<object,{actionId:string;version:number;identity:Consumed}>(),credentials=new WeakMap<object,{actionId:string;identity:Consumed;value:z.infer<typeof privateCredential>}>();
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
 function projection(state:OperationalDelegation,now:number){const p=state.executionPrincipal;return Object.freeze({actionId:state.actionId,manifest:state.manifest,status:state.status,version:state.version,attemptCount:state.attemptCount,requesterUserId:state.requester.userId,reviewerUserId:state.reviewer.userId,executionPrincipal:p?{kind:p.kind,workload:p.workload,profileDigest:p.profileDigest,expiresAt:p.expiresAt}:null,credential:state.credential,...(state.sourceCredential?{sourceCredential:state.sourceCredential}:{}),targetReservation:state.targetReservation,expired:now>=Date.parse(state.manifest.expiresAt),authority:'delegation_history_only' as const,sourceValidation:'not_checked' as const,executionAuthorized:false as const,providerExecution:false as const})}
 async function event(tx:OperationalDelegationTransaction,parent:PlatformAction,state:OperationalDelegation,kind:'workload.delegated'|'workload.claimed'|'credential.pending'|'credential.observed'|'credential.source_observed'){
  await tx.event({actionId:state.actionId,state:parent,kind,operationalDigest:sha256ContentHash(state)});
 }
 async function sourceCurrent(tx:OperationalDelegationTransaction,state:OperationalDelegation){
  if(!state.manifest.issuerProfileDigest)return;
  const source=state.sourceCredential;if(!issuer?.assertSourceCurrent||source?.status!=='issued'||source.profileDigest!==state.manifest.issuerProfileDigest)return fail();
  const before=await tx.now();if(before>=source.expiresAt)return fail();
  await issuer.assertSourceCurrent(tx,state.manifest,{leaseRef:source.leaseRef,profileDigest:source.profileDigest,expiresAt:source.expiresAt});
  const after=await tx.now();if(after<before||after>=source.expiresAt)return fail();
 }
 async function recordCredential(proof:object,rawOutcome:unknown){const pending=issuance.get(proof);if(!pending)return fail();issuance.delete(proof);
   try{const outcome=credentialOutcome.parse(rawOutcome);return await locked(pending.actionId,async(tx,key)=>{
    const state=await load(tx,key);if(state.version!==pending.version||state.credential.status!=='pending')return fail();const now=await tx.now();if(!Number.isSafeInteger(now)||now<state.updatedAt)return fail();
    const next=readOperationalDelegation({...state,...(state.sourceCredential?.status==='pending'?{sourceCredential:{status:'unknown',requestedAt:state.sourceCredential.requestedAt,observedAt:now}}:{}),version:3,credential:{...outcome,requestedAt:state.credential.requestedAt,observedAt:now},updatedAt:now}),parent=readPlatformAction(await tx.read(key));match(parent,state);
    await tx.replaceDelegation(key,state.version,next);await event(tx,parent,next,'credential.observed');return projection(next,now);
   })}catch{throw Error('operational_credential_observation_unconfirmed')}
  }
 return Object.freeze({
  async executeCredential(handle:object){
   const held=credentials.get(handle);if(!held||!issuer||!transport||!targets)return fail();credentials.delete(handle);
   async function sendCurrent(tx:OperationalDelegationTransaction,key:string,child:boolean){
    const state=await load(tx,key);if(state.credential.status!=='issued'||state.credential.leaseRef!==held!.value.leaseRef||state.credential.expiresAt!==held!.value.expiresAt||state.executionPrincipal?.replayKey!==held!.identity.replayKey)return fail();
    await current(tx,state,'claimed');await targets!.assertHeld(tx,{actionId:key,manifest:state.manifest},state.targetReservation);await identity.assertConsumedCurrent(tx,held!.identity,binding(state));await issuer!.assertQualified(tx,state.manifest);await transport!.assertQualified(tx,state.manifest);await current(tx,state,'claimed');await targets!.assertHeld(tx,{actionId:key,manifest:state.manifest},state.targetReservation);await identity.assertConsumedCurrent(tx,held!.identity,binding(state));
    await sourceCurrent(tx,state);const now=await tx.now();if(now>=held!.value.expiresAt||child&&await tx.readEffect(key,0)!=='claimed')return fail();return state;
   }
   let claimed=false;
   try{
    const saved=await locked(held.actionId,async(tx,key)=>{
     const state=await sendCurrent(tx,key,false);if(await tx.readEffect(key,0)!==null)return fail();await tx.writeEffect(key,0,null,'claimed');const parent=readPlatformAction(await tx.read(key));await tx.event({actionId:key,kind:'effect.claimed',state:parent,effectIndex:0});await sendCurrent(tx,key,true);const ref=state.targetReservation;if(!ref)return fail();const native=readOperationalTarget(await tx.readOperationalTarget(ref.nativeKey));if(native.actionId!==key||native.generation!==ref.generation)return fail();return {state,priorDeploymentId:native.priorDeploymentId};
    });claimed=true;
    const abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,authorized=false,used=false,accepted:ReturnType<typeof projectOperationalEcsAcceptance>|null=null;
    try{
     const beforeSend=async()=>{if(used)return fail();used=true;abort.signal.throwIfAborted();await locked(held.actionId,async(tx,key)=>{await sendCurrent(tx,key,true)});abort.signal.throwIfAborted();authorized=true};
     const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error('unavailable'))},10000)});
     const raw=await Promise.race([transport.send(saved.state.manifest,Object.freeze({accessKeyId:held.value.accessKeyId,secretAccessKey:held.value.secretAccessKey,sessionToken:held.value.sessionToken,expiresAt:held.value.expiresAt}),beforeSend,abort.signal),timeout]);abort.signal.throwIfAborted();if(!authorized)return fail();accepted=projectOperationalEcsAcceptance(saved.state.manifest,saved.priorDeploymentId,raw);
    }catch{accepted=null}finally{if(timer)clearTimeout(timer);abort.abort()}
    return await locked(held.actionId,async(tx,key)=>{
     const state=await load(tx,key),parent=readPlatformAction(await tx.read(key));match(parent,state);if(parent.status!=='claimed'||await tx.readEffect(key,0)!=='claimed'||state.credential.status!=='issued'||state.credential.leaseRef!==held.value.leaseRef||!state.targetReservation)return fail();const now=await tx.now(),outcome=accepted?'confirmed' as const:'unknown' as const;
     const receipt=createOperationalEcsResult({format:1,purpose:'operational_ecs_update_result_v1',actionId:key,manifestDigest:state.manifest.digest,nativeKey:state.targetReservation.nativeKey,generation:state.targetReservation.generation,leaseRef:held.value.leaseRef,kind:accepted?'accepted':'unknown',deploymentId:accepted?.deploymentId??null,requestId:accepted?.requestId??null,observedAt:now,stable:false,rollbackAuthorized:false});
     await tx.writeEffect(key,0,'claimed',outcome);const next=accepted?parent:finishPlatformAction(parent,'unknown',now);if(!accepted)await tx.replace(key,parent.version,next);await tx.event({actionId:key,kind:'effect.observed',state:next,effectIndex:0,outcome,operationalResult:receipt});return receipt;
    });
   }catch{throw Error(claimed?'operational_ecs_outcome_unconfirmed':'operational_ecs_claim_unconfirmed')}
  },
  async issueCredential(proof:object){try{
   const pending=issuance.get(proof);if(!pending||!issuer||!targets)return fail();issuance.delete(proof);
   const manifest=await locked(pending.actionId,async(tx,key)=>{
    const state=await load(tx,key);if(state.version!==pending.version||state.credential.status!=='pending'||state.executionPrincipal?.replayKey!==pending.identity.replayKey)return fail();
    await current(tx,state,'claimed');await targets.assertHeld(tx,{actionId:key,manifest:state.manifest},state.targetReservation);await identity.assertConsumedCurrent(tx,pending.identity,binding(state));await issuer.assertQualified(tx,state.manifest);await current(tx,state,'claimed');await targets.assertHeld(tx,{actionId:key,manifest:state.manifest},state.targetReservation);await identity.assertConsumedCurrent(tx,pending.identity,binding(state));return state.manifest;
   });
   const observation=Object.freeze(Object.create(null)) as object;issuance.set(observation,pending);
   const abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,value:z.infer<typeof privateCredential>,authorized=false,used=false;
   try{
    const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error('unavailable'))},10000)});
    const beforeIssue=async()=>{if(used)return fail();used=true;abort.signal.throwIfAborted();await locked(pending.actionId,async(tx,key)=>{
     const state=await load(tx,key);if(state.version!==pending.version||state.credential.status!=='pending'||state.executionPrincipal?.replayKey!==pending.identity.replayKey)return fail();await current(tx,state,'claimed');await targets.assertHeld(tx,{actionId:key,manifest:state.manifest},state.targetReservation);await identity.assertConsumedCurrent(tx,pending.identity,binding(state));await issuer.assertQualified(tx,state.manifest);await current(tx,state,'claimed');await targets.assertHeld(tx,{actionId:key,manifest:state.manifest},state.targetReservation);await identity.assertConsumedCurrent(tx,pending.identity,binding(state));await sourceCurrent(tx,state);
    });abort.signal.throwIfAborted();authorized=true};
    const recordSource=async(raw:CustodianCredentialObservation)=>{
     abort.signal.throwIfAborted();const metadata=custodianCredentialObservation.parse(raw);
     await locked(pending.actionId,async(tx,key)=>{const state=await load(tx,key);if(!tx.writeOperationalSourceCredential||state.version!==pending.version||state.credential.status!=='pending'||state.sourceCredential?.status!=='pending'||metadata.profileDigest!==state.manifest.issuerProfileDigest)return fail();const now=await tx.now();if(now<state.updatedAt||metadata.expiresAt<=now)return fail();
      const next=readOperationalDelegation({...state,sourceCredential:{...metadata,status:'issued',requestedAt:state.sourceCredential.requestedAt,observedAt:now},updatedAt:now}),parent=readPlatformAction(await tx.read(key));match(parent,state);await tx.writeOperationalSourceCredential(key,state.version,next);await event(tx,parent,next,'credential.source_observed');
     });abort.signal.throwIfAborted();
    };
    value=privateCredential.parse(await Promise.race([issuer.issue(manifest,beforeIssue,abort.signal,recordSource),timeout]));abort.signal.throwIfAborted();
   }catch{
    const history=await recordCredential(observation,{status:'unknown'});return {history,credentialHandle:null};
   }finally{if(timer)clearTimeout(timer);abort.abort()}
   const history=await recordCredential(observation,{status:'issued',leaseRef:value.leaseRef,expiresAt:value.expiresAt});
   if(!authorized)return fail();
   await locked(pending.actionId,async(tx,key)=>{
    const state=await load(tx,key);if(state.credential.status!=='issued'||state.credential.leaseRef!==value.leaseRef||state.credential.expiresAt!==value.expiresAt)return fail();await current(tx,state,'claimed');await targets.assertHeld(tx,{actionId:key,manifest:state.manifest},state.targetReservation);await identity.assertConsumedCurrent(tx,pending.identity,binding(state));await issuer.assertQualified(tx,state.manifest);await current(tx,state,'claimed');await sourceCurrent(tx,state);const now=await tx.now();if(now>=value.expiresAt)return fail();
   });
   const credentialHandle=Object.freeze(Object.create(null)) as object;credentials.set(credentialHandle,{actionId:pending.actionId,identity:pending.identity,value});return {history,credentialHandle};
   }catch{throw Error('operational_credential_issuance_unconfirmed')}
  },
  async observeTarget(id:string,rawReader:PlatformPrincipal){
   try{const reader=platformPrincipalSchema.parse(rawReader);return await locked(id,async(tx,key)=>{
    await authority.assertCurrent(tx,reader);const state=await load(tx,key),parent=readPlatformAction(await tx.read(key));match(parent,state);
    if(!targets?.observe||!state.targetReservation)return fail();await tx.lockOperationalTarget(state.targetReservation.nativeKey);const prior=readOperationalTarget(await tx.readOperationalTarget(state.targetReservation.nativeKey)),storedTerminal=['stable','terminal_failure'].includes(prior.phase);const observed=await targets.observe(tx,{actionId:key,manifest:state.manifest},state.targetReservation.generation);
    await authority.assertCurrent(tx,reader);const now=await tx.now();if(!Number.isSafeInteger(now)||now<state.updatedAt)return fail();
    let finalParent=parent,parentReconciliation:'not_performed'|'confirmed_from_native_receipt'='not_performed';
    if(!storedTerminal&&observed.phase==='stable'&&parent.status==='claimed'&&targets.assertTerminalCurrent){
     const result=readOperationalEcsResult(await tx.readOperationalEcsResult(key)),ref=state.targetReservation;
     if(await tx.readEffect(key,0)!=='confirmed'||state.credential.status!=='issued'||result.kind!=='accepted'||result.actionId!==key||result.manifestDigest!==state.manifest.digest||result.nativeKey!==ref.nativeKey||result.generation!==ref.generation||result.leaseRef!==state.credential.leaseRef||result.deploymentId!==observed.deploymentId||result.observedAt<state.createdAt||result.observedAt>now)return fail();
     const terminal=await targets.assertTerminalCurrent(tx,{actionId:key,manifest:state.manifest},ref.generation,observed.lastReceiptId);if(Date.parse(terminal.detail.observedAt)<result.observedAt||Date.parse(terminal.detail.observedAt)>now)return fail();await authority.assertCurrent(tx,reader);
     finalParent=finishPlatformAction(parent,'confirmed',await tx.now());await tx.replace(key,parent.version,finalParent);await tx.event({actionId:key,kind:'workload.stable_observed',state:finalParent,operationalObserverUserId:reader.userId,operationalStabilityReceiptId:observed.lastReceiptId,operationalCommandReceiptDigest:result.receiptDigest});
     await targets.assertTerminalCurrent(tx,{actionId:key,manifest:state.manifest},ref.generation,observed.lastReceiptId);await authority.assertCurrent(tx,reader);parentReconciliation='confirmed_from_native_receipt';
    }
    const finalNow=await tx.now();if(!Number.isSafeInteger(finalNow)||finalNow<now||finalNow<finalParent.updatedAt)return fail();
    return Object.freeze({actionId:key,phase:observed.phase,generation:observed.generation,deploymentId:observed.deploymentId,lastReceiptId:observed.lastReceiptId,credentialStatus:state.credential.status,expired:finalNow>=Date.parse(state.manifest.expiresAt),authority:'native_observation_only' as const,sourceValidation:storedTerminal?'historical_terminal_receipt_only' as const:'checked_by_private_source' as const,parentStatus:finalParent.status,parentReconciliation,executionAuthorized:false as const,providerWritePerformed:false as const});
   })}catch{throw Error('operational_observation_unavailable')}
  },
  async inspect(id:string,rawActor:PlatformPrincipal){const actor=platformPrincipalSchema.parse(rawActor);return locked(id,async(tx,key)=>{
   await authority.assertCurrent(tx,actor);const state=await load(tx,key),parent=readPlatformAction(await tx.read(key));match(parent,state);
   const effectStatus=await tx.readEffect(key,0);let result:OperationalEcsResult|null=null;
   if(effectStatus==='confirmed'||effectStatus==='unknown'){
    result=readOperationalEcsResult(await tx.readOperationalEcsResult(key));const ref=state.targetReservation;
    if(!ref||state.credential.status!=='issued'||result.actionId!==key||result.manifestDigest!==state.manifest.digest||result.nativeKey!==ref.nativeKey||result.generation!==ref.generation||result.leaseRef!==state.credential.leaseRef||result.observedAt<state.createdAt||effectStatus==='confirmed'&&result.kind!=='accepted'||effectStatus==='unknown'&&result.kind!=='unknown')return fail();
   }
   let stability:ReturnType<typeof readOperationalStabilityHistory>|null=null;
   if(parent.status==='confirmed'){
    if(!result||!tx.readOperationalStabilityEvent)return fail();const event=await tx.readOperationalStabilityEvent(key);if(!event||typeof event!=='object')return fail();const receiptId=(event as Record<string,unknown>).operationalStabilityReceiptId;if(typeof receiptId!=='string'||!state.targetReservation)return fail();await tx.lockOperationalTarget(state.targetReservation.nativeKey);stability=readOperationalStabilityHistory(key,parent,result,event,await tx.readOperationalTargetReceipt(receiptId));
   }
   await authority.assertCurrent(tx,actor);const now=await tx.now();if(!Number.isSafeInteger(now)||now<state.updatedAt||result&&result.observedAt>now)return fail();await authority.assertCurrent(tx,actor);
   return Object.freeze({...projection(state,now),parentStatus:parent.status,parentVersion:parent.version,effectStatus,result,stability});
  })},
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
    const {parent,now}=await current(tx,state,'claimed');await targets.assertHeld(tx,{actionId:key,manifest:state.manifest},state.targetReservation);await identity.assertConsumedCurrent(tx,claimed.identity,binding(state));const next=readOperationalDelegation({...state,version:2,credential:{status:'pending',requestedAt:now},...(state.manifest.issuerProfileDigest?{sourceCredential:{status:'pending',requestedAt:now}}:{}),updatedAt:now});
    await tx.replaceDelegation(key,state.version,next);await event(tx,parent,next,'credential.pending');await current(tx,next,'claimed');await targets.assertHeld(tx,{actionId:key,manifest:next.manifest},next.targetReservation);await identity.assertConsumedCurrent(tx,claimed.identity,binding(next));return {state:next,now};
   });const issuanceProof=Object.freeze(Object.create(null)) as object;issuance.set(issuanceProof,{actionId:result.state.actionId,version:result.state.version,identity:claimed.identity});return {proof:issuanceProof,history:projection(result.state,result.now)};
   }catch{throw Error('operational_credential_request_unconfirmed')}
  },
  /** Private observation only, including after human/source expiry or revocation.
   * Never discard knowledge of issued/unknown credentials to claim safety. */
  observeCredential:recordCredential,
 });
}
