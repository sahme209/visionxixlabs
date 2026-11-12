import 'server-only';
import {platformPrincipalSchema,type PlatformPrincipal,type PlatformAction} from './contracts';
import {deploymentRecoverySelection} from './deploymentRecoveryCommand';
export {deploymentRecoverySelection} from './deploymentRecoveryCommand';
import {platformActionId} from './viewContract';
import type {PlatformTransaction,PlatformAuthority} from './actionStore';
import {createPlatformAction,readPlatformAction,approvePlatformAction,claimPlatformAction,finishPlatformAction} from './kernel';
import {preparationActionReference} from './preparationReference';
import {compileDeploymentRecoveryPlan,readDeploymentRecoveryPlan,compileDeploymentRecoveryPlatformPlan,validateDeploymentRecoveryEvidence,type DeploymentRecoveryPlan} from './deploymentRecoveryContract';
import {deploymentTerminalObservationSchema,type DeploymentReservation,type DeploymentTerminalObservation} from './deploymentLiability';
export interface DeploymentRecoveryTransaction extends PlatformTransaction {
 lockDeploymentTarget(key:string):Promise<void>;
 readDeploymentTarget(key:string):Promise<Readonly<DeploymentReservation>|null>;
 readDeploymentRecoveryReceipt(nativeKey:string,receiptId:string):Promise<unknown>;
 readDeploymentRecoveryPlan(id:string):Promise<unknown>;
 readDeploymentReleaseObservation(id:string):Promise<DeploymentTerminalObservation|null>;
 releaseDeploymentReservation(plan:DeploymentRecoveryPlan,evidence:DeploymentTerminalObservation,next:Readonly<DeploymentReservation>):Promise<void>;
}
export interface DeploymentRecoveryRepository {transaction<T>(fn:(tx:DeploymentRecoveryTransaction)=>Promise<T>):Promise<T>}
export interface DeploymentRecoverySource {
 /** Protected current runtime/provider profile. No working default exists. */
 assertCurrent(tx:DeploymentRecoveryTransaction,plan:DeploymentRecoveryPlan):Promise<void>;
 /** One bounded, read-only observation of the exact known provider reference.
  * Caller JSON/status strings/URLs can never implement this private supplier. */
 readTerminal(plan:DeploymentRecoveryPlan,signal:AbortSignal):Promise<unknown>;
 /** Native completeness/currentness, including absence of unqualified work,
  * must remain valid across the atomic release. Not a parser/hash check. */
 assertEvidenceCurrent(tx:DeploymentRecoveryTransaction,plan:DeploymentRecoveryPlan,evidence:DeploymentTerminalObservation):Promise<void>;
}
const fail=():never=>{throw Error('platform_deployment_recovery_unavailable')};
/** Prepared private service only; no route, native supplier or execution default.
 * Claim commits BEFORE the one native read. Unknown acknowledgements cannot
 * yield a read capability or a second observation attempt. */
export function createDeploymentRecoveryService(repo:DeploymentRecoveryRepository,authority:PlatformAuthority,source:DeploymentRecoverySource){
 async function load(tx:DeploymentRecoveryTransaction,id:string){const state=readPlatformAction(await tx.read(id)),plan=readDeploymentRecoveryPlan(await tx.readDeploymentRecoveryPlan(id));if(compileDeploymentRecoveryPlatformPlan(plan).digest!==state.plan.digest)return fail();return {state,plan}}
 async function current(tx:DeploymentRecoveryTransaction,state:PlatformAction,plan:DeploymentRecoveryPlan,actor:PlatformPrincipal){
  async function people(){await authority.assertCurrent(tx,actor);await authority.assertCurrent(tx,state.requester);if(state.reviewer)await authority.assertCurrent(tx,state.reviewer)}
  await people();await source.assertCurrent(tx,plan);await people();const now=await tx.now();if(!Number.isSafeInteger(now)||now<state.updatedAt||now>=Date.parse(plan.expiresAt))return fail();return now;
 }
 async function original(tx:DeploymentRecoveryTransaction,plan:DeploymentRecoveryPlan){const reservation=await tx.readDeploymentTarget(plan.nativeKey),receipt=await tx.readDeploymentRecoveryReceipt(plan.nativeKey,plan.requestReceiptId);if(compileDeploymentRecoveryPlan({reservation,receipt,profileDigest:plan.profileDigest,expiresAt:plan.expiresAt}).digest!==plan.digest)return fail();return {reservation,receipt}}
 async function locked<T>(id:string,fn:(tx:DeploymentRecoveryTransaction,state:PlatformAction,plan:DeploymentRecoveryPlan)=>Promise<T>){platformActionId.parse(id);return repo.transaction(async tx=>{await tx.lock(id);const {state,plan}=await load(tx,id);await tx.lockDeploymentTarget(plan.nativeKey);return fn(tx,state,plan)})}
 return Object.freeze({
  async lookup(reference:string,principal:PlatformPrincipal){const actor=platformPrincipalSchema.parse(principal),id=preparationActionReference(reference,actor,'platform_deployment_recovery_preparation_v1');return repo.transaction(async tx=>{await tx.lock(id);await authority.assertCurrent(tx,actor);if(await tx.read(id)===null){await authority.assertCurrent(tx,actor);return {found:false as const}}const {state}=await load(tx,id);if(state.requester.userId!==actor.userId||state.requester.sessionId!==actor.sessionId)return fail();await authority.assertCurrent(tx,actor);return {found:true as const,actionId:id,planDigest:state.plan.digest,authority:'original_reference_only' as const,executionAuthorized:false as const}})},
  async preview(id:string,principal:PlatformPrincipal){const actor=platformPrincipalSchema.parse(principal);return locked(id,async(tx,state,plan)=>{if(state.status!=='proposed'&&state.status!=='approved')return fail();await current(tx,state,plan,actor);await original(tx,plan);await current(tx,state,plan,actor);return {actionId:id,planDigest:state.plan.digest,version:state.version,status:state.status,plan,requesterUserId:state.requester.userId,reviewerUserId:state.reviewer?.userId??null,authority:'review_preview_only' as const,sourceValidation:'checked_by_private_source' as const,executionAuthorized:false as const}})},
  async inspect(id:string,principal:PlatformPrincipal){const actor=platformPrincipalSchema.parse(principal);platformActionId.parse(id);return repo.transaction(async tx=>{
   await tx.lock(id);await authority.assertCurrent(tx,actor);const {state,plan}=await load(tx,id),observation=await tx.readDeploymentReleaseObservation(id),now=await tx.now();
   if(!Number.isSafeInteger(now)||now<state.updatedAt||(state.status==='confirmed')!==(observation!==null))return fail();
   if(observation){const e=deploymentTerminalObservationSchema.parse(observation);if(e.nativeKey!==plan.nativeKey||e.generation!==plan.generation||e.actionId!==plan.originalActionId||e.requestReceiptDigest!==plan.requestReceiptDigest||e.providerDeploymentId!==plan.providerDeploymentId||e.profileDigest!==plan.profileDigest||e.observedAt<state.createdAt||e.observedAt>state.updatedAt)return fail()}
   await authority.assertCurrent(tx,actor);return {actionId:id,planDigest:state.plan.digest,plan,version:state.version,status:state.status,attemptCount:state.attemptCount,requesterUserId:state.requester.userId,reviewerUserId:state.reviewer?.userId??null,observation,expired:now>=Date.parse(plan.expiresAt),authority:'history_only' as const,sourceValidation:'not_checked' as const,currentTargetChecked:false as const,deploymentReadyChecked:false as const,executionAuthorized:false as const};
  })},
  async prepare(raw:unknown,principal:PlatformPrincipal,reference:string){const actor=platformPrincipalSchema.parse(principal),selection=deploymentRecoverySelection.parse(raw),id=preparationActionReference(reference,actor,'platform_deployment_recovery_preparation_v1');return repo.transaction(async tx=>{
   await tx.lock(id);await authority.assertCurrent(tx,actor);const existing=await tx.read(id);
   if(existing){const saved=await load(tx,id);if(saved.state.requester.userId!==actor.userId||saved.state.requester.sessionId!==actor.sessionId||saved.plan.nativeKey!==selection.nativeKey||saved.plan.requestReceiptId!==selection.requestReceiptId||saved.plan.profileDigest!==selection.profileDigest||saved.plan.expiresAt!==selection.expiresAt)return fail();await authority.assertCurrent(tx,actor);return {actionId:id,planDigest:saved.state.plan.digest,historical:true as const}}
   await tx.lockDeploymentTarget(selection.nativeKey);const reservation=await tx.readDeploymentTarget(selection.nativeKey),receipt=await tx.readDeploymentRecoveryReceipt(selection.nativeKey,selection.requestReceiptId),plan=compileDeploymentRecoveryPlan({reservation,receipt,profileDigest:selection.profileDigest,expiresAt:selection.expiresAt}),state=createPlatformAction(compileDeploymentRecoveryPlatformPlan(plan),actor,await tx.now());
   await current(tx,state,plan,actor);await tx.insert(id,state);await tx.event({actionId:id,kind:'proposed',state,deploymentRecoveryPlan:plan});await current(tx,state,plan,actor);return {actionId:id,planDigest:state.plan.digest,historical:false as const};
  })},
  async review(id:string,version:number,planDigest:string,principal:PlatformPrincipal){const actor=platformPrincipalSchema.parse(principal);return locked(id,async(tx,state,plan)=>{if(state.version!==version||state.plan.digest!==planDigest)return fail();await original(tx,plan);const now=await current(tx,state,plan,actor),next=approvePlatformAction(state,{...actor,planDigest},now);await tx.replace(id,version,next);await tx.event({actionId:id,kind:'approved',state:next});await current(tx,next,plan,actor);return {actionId:id,planDigest:next.plan.digest,version:next.version,status:'approved' as const,reviewRecorded:true as const,executionAuthorized:false as const}})},
  async observe(id:string,version:number,principal:PlatformPrincipal,expectedPlanDigest?:string){const actor=platformPrincipalSchema.parse(principal);
   // This await is intentionally outside the catch: an uncertain claim commit
   // grants no lexical permission even to perform the observation.
   const claimed=await locked(id,async(tx,state,plan)=>{if(state.version!==version||expectedPlanDigest!==undefined&&state.plan.digest!==expectedPlanDigest)return fail();await original(tx,plan);const now=await current(tx,state,plan,actor),next=claimPlatformAction(state,actor,now);await tx.replace(id,version,next);await tx.event({actionId:id,kind:'claimed',state:next});await tx.writeEffect(id,0,null,'claimed');await tx.event({actionId:id,kind:'effect.claimed',state:next,effectIndex:0});await current(tx,next,plan,actor);return {state:next,plan}});
   const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
   try{
    const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('platform_deployment_recovery_unavailable'))},5000)});
    const raw=await Promise.race([source.readTerminal(claimed.plan,controller.signal),timeout]);if(controller.signal.aborted)return fail();
    const evidence=deploymentTerminalObservationSchema.parse(raw);if(evidence.observedAt<claimed.state.updatedAt)return fail();
    return await locked(id,async(tx,state,plan)=>{
     if(state.status!=='claimed'||state.version!==claimed.state.version||state.plan.digest!==claimed.state.plan.digest||await tx.readEffect(id,0)!=='claimed')return fail();
     const saved=await original(tx,plan);await source.assertEvidenceCurrent(tx,plan,evidence);const now=await current(tx,state,plan,actor),nextTarget=validateDeploymentRecoveryEvidence(plan,saved.reservation,saved.receipt,evidence,now);
     await tx.releaseDeploymentReservation(plan,evidence,nextTarget);await tx.writeEffect(id,0,'claimed','confirmed');const next=finishPlatformAction(state,'confirmed',await tx.now());await tx.replace(id,state.version,next);await tx.event({actionId:id,kind:'effect.observed',state:next,effectIndex:0,outcome:'confirmed',deploymentReleaseObservation:evidence});
     await source.assertEvidenceCurrent(tx,plan,evidence);const finalNow=await current(tx,next,plan,actor);validateDeploymentRecoveryEvidence(plan,saved.reservation,saved.receipt,evidence,finalNow);
     return {actionId:id,planDigest:next.plan.digest,version:next.version,status:'confirmed' as const,reservationReleased:true as const,providerWritePerformed:false as const,executionAuthorized:false as const};
    });
   }catch{
    // Never rewrite a committed confirmation after a lost final acknowledgement.
    try{await locked(id,async(tx,state)=>{if(state.status!=='claimed'||state.plan.digest!==claimed.state.plan.digest||await tx.readEffect(id,0)!=='claimed')return;await tx.writeEffect(id,0,'claimed','unknown');const next=finishPlatformAction(state,'unknown',await tx.now());await tx.replace(id,state.version,next);await tx.event({actionId:id,kind:'effect.observed',state:next,effectIndex:0,outcome:'unknown'})})}catch{/* Original uncertainty is preserved; never retry the native read. */}
    return fail();
   }finally{if(timer!==undefined)clearTimeout(timer);controller.abort()}
  },
 });
}
