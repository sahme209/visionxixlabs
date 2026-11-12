import 'server-only';
import {operationalCredentialState,type OperationalCredentialState} from './credentialContract';
import {operationalEvidenceId} from './contracts';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {operationalWorkloadBinding} from './workloadIdentity';
import {readOperationalManifest} from './kernel';
import {nativeEcsTargetKey,operationalNativeSnapshot,operationalNativeOutcome,operationalTargetReference,readOperationalTarget,readOperationalTargetReceipt,type OperationalTarget,type OperationalTargetBinding,type OperationalTargetTransaction,type OperationalTargetReceipt} from './reservationContract';
export {nativeEcsTargetKey} from './reservationContract';
interface Source{
 /** No default qualifies these read-only native snapshots/operation receipts.
  * Structural matches never establish provider/currentness/request provenance. */
 assertPriorCredentialClosed(tx:OperationalTargetTransaction,record:OperationalTarget,credential:Extract<OperationalCredentialState,{status:'issued'}>):Promise<string>;
 readSnapshot(tx:OperationalTargetTransaction,binding:OperationalTargetBinding):Promise<unknown>;
 assertSnapshotCurrent(tx:OperationalTargetTransaction,snapshotDigest:string,bindingDigest:string):Promise<void>;
 readOutcome(tx:OperationalTargetTransaction,record:OperationalTarget):Promise<unknown>;
 assertOutcomeCurrent(tx:OperationalTargetTransaction,lineageDigest:string,outcomeDigest:string):Promise<void>;
}
const fail=():never=>{throw Error('operational_target_unavailable')};
const same=(a:unknown,b:unknown)=>sha256ContentHash(a)===sha256ContentHash(b);
function binding(raw:OperationalTargetBinding){const actionId=operationalWorkloadBinding.shape.actionId.parse(raw.actionId),manifest=readOperationalManifest(raw.manifest);if(manifest.kind!=='deployment.ecs')return fail();return {actionId,manifest}}
function receipt(b:OperationalTargetBinding,key:string,generation:number,kind:OperationalTargetReceipt['kind'],detail:{receiptId:string},previousCredentialClosureReceiptId:string|null=null){const body={receiptId:detail.receiptId,nativeKey:key,generation,actionId:b.actionId,manifestDigest:b.manifest.digest,kind,previousCredentialClosureReceiptId,detail};return readOperationalTargetReceipt({...body,receiptDigest:sha256ContentHash(body)})}
/** Joins the outer current-human/workload claim transaction. This module has no
 * provider send, credential, reset, deletion or caller-supplied proof path. */
export function createOperationalTargetReservations(source:Source){
 async function load(tx:OperationalTargetTransaction,key:string){const raw=await tx.readOperationalTarget(key);if(!raw)return null;const state=readOperationalTarget(raw);if(state.nativeKey!==key)return fail();return state}
 return Object.freeze({
  async reserve(tx:OperationalTargetTransaction,raw:OperationalTargetBinding){
   const b=binding(raw),m=b.manifest,key=nativeEcsTargetKey(m.target);await tx.lockOperationalTarget(key);const previous=await load(tx,key);
   if(previous&&(!['stable','terminal_failure'].includes(previous.phase)||previous.actionId===b.actionId))return fail();
   if(m.operation==='rollback'){
    const c=m.condition;if(!previous||previous.phase!=='terminal_failure'||previous.generation!==c.generation||previous.actionId!==c.failedActionId||previous.lastReceiptId!==c.failureReceiptId||previous.priorDeploymentReceiptId!==c.priorDeploymentReceiptId||previous.target.taskDefinitionArn!==c.failedTaskDefinitionArn||m.target.taskDefinitionArn!==previous.priorTaskDefinitionArn)return fail();
   }
   if(previous){
    const prior=readOperationalTargetReceipt(await tx.readOperationalTargetReceipt(previous.lastReceiptId));
    if(prior.kind!==previous.phase||prior.nativeKey!==key||prior.generation!==previous.generation||prior.actionId!==previous.actionId||prior.manifestDigest!==previous.manifestDigest)return fail();
    const terminal=operationalNativeOutcome.parse(prior.detail);if(terminal.target.taskDefinitionArn!==previous.target.taskDefinitionArn||terminal.deploymentId!==previous.deploymentId)return fail();
    const lineage=sha256ContentHash({nativeKey:key,generation:previous.generation,actionId:previous.actionId,manifestDigest:previous.manifestDigest,snapshotDigest:previous.snapshotDigest});await source.assertOutcomeCurrent(tx,lineage,sha256ContentHash(terminal));
   }
   let previousCredentialClosureReceiptId:string|null=null;
   if(previous){const liability=operationalCredentialState.parse(await tx.readOperationalCredentialLiability(previous.actionId));if(liability.status==='pending'||liability.status==='unknown')return fail();if(liability.status==='issued')previousCredentialClosureReceiptId=operationalEvidenceId.parse(await source.assertPriorCredentialClosed(tx,previous,liability));}
   const snapshot=operationalNativeSnapshot.parse(await source.readSnapshot(tx,b));
   if(snapshot.receiptId!==m.sourceEvidenceId||nativeEcsTargetKey(snapshot.target)!==key||previous&&snapshot.target.taskDefinitionArn!==previous.target.taskDefinitionArn)return fail();
   const snapshotDigest=sha256ContentHash(snapshot),bindingDigest=sha256ContentHash(b);await source.assertSnapshotCurrent(tx,snapshotDigest,bindingDigest);
   const now=await tx.now();if(!Number.isSafeInteger(now)||now<0||Date.parse(snapshot.observedAt)>now||Date.parse(snapshot.expiresAt)<=now||Date.parse(snapshot.observedAt)>=Date.parse(snapshot.expiresAt)||now>=Date.parse(m.expiresAt)||Date.parse(m.expiresAt)>Date.parse(snapshot.expiresAt))return fail();
   const generation=(previous?.generation??0)+1,state=readOperationalTarget({nativeKey:key,actionId:b.actionId,manifestDigest:m.digest,target:m.target,generation,version:previous?previous.version+1:0,phase:'reserved',deploymentId:null,priorTaskDefinitionArn:snapshot.target.taskDefinitionArn,priorDeploymentId:snapshot.deploymentId,priorDeploymentReceiptId:snapshot.receiptId,lastReceiptId:snapshot.receiptId,snapshotDigest,bindingDigest,sourceExpiresAt:snapshot.expiresAt,previousCredentialClosureReceiptId,createdAt:now,updatedAt:now}),saved=receipt(b,key,generation,'snapshot',snapshot,previousCredentialClosureReceiptId);
   if(await tx.readOperationalTargetReceipt(saved.receiptId))return fail();
   if(previous)await tx.replaceOperationalTarget(key,previous.version,state);else await tx.insertOperationalTarget(key,state);await tx.insertOperationalTargetReceipt(saved);await source.assertSnapshotCurrent(tx,snapshotDigest,bindingDigest);
   const end=await tx.now();if(!Number.isSafeInteger(end)||end<now||end>=Date.parse(m.expiresAt)||end>=Date.parse(snapshot.expiresAt))return fail();return operationalTargetReference.parse({nativeKey:key,generation});
  },
  async assertHeld(tx:OperationalTargetTransaction,raw:OperationalTargetBinding,reference:unknown){
   const b=binding(raw),ref=operationalTargetReference.parse(reference),key=nativeEcsTargetKey(b.manifest.target);if(ref.nativeKey!==key)return fail();await tx.lockOperationalTarget(key);const state=await load(tx,key);
   if(!state||state.actionId!==b.actionId||state.manifestDigest!==b.manifest.digest||state.generation!==ref.generation||state.phase!=='reserved'||state.bindingDigest!==sha256ContentHash(b))return fail();
   await source.assertSnapshotCurrent(tx,state.snapshotDigest,state.bindingDigest);const now=await tx.now();if(!Number.isSafeInteger(now)||now<state.updatedAt||now>=Date.parse(state.sourceExpiresAt)||now>=Date.parse(b.manifest.expiresAt))return fail();
  },
  async observe(tx:OperationalTargetTransaction,raw:OperationalTargetBinding,generation:number){
   const b=binding(raw),key=nativeEcsTargetKey(b.manifest.target);await tx.lockOperationalTarget(key);const previous=await load(tx,key);
   if(!previous||previous.actionId!==b.actionId||previous.manifestDigest!==b.manifest.digest||previous.generation!==generation)return fail();
   if(['stable','terminal_failure'].includes(previous.phase))return previous;
   const outcome=operationalNativeOutcome.parse(await source.readOutcome(tx,previous));
   if(outcome.actionId!==b.actionId||outcome.manifestDigest!==b.manifest.digest||outcome.generation!==generation||nativeEcsTargetKey(outcome.target)!==key||outcome.target.taskDefinitionArn!==previous.target.taskDefinitionArn||previous.phase==='reserved'&&!['accepted','unknown'].includes(outcome.kind)||previous.phase==='unknown'&&previous.deploymentId===null&&outcome.kind!=='unknown'||previous.deploymentId!==null&&outcome.deploymentId!==null&&previous.deploymentId!==outcome.deploymentId)return fail();
   const lineageDigest=sha256ContentHash({nativeKey:key,generation,actionId:b.actionId,manifestDigest:b.manifest.digest,snapshotDigest:previous.snapshotDigest}),outcomeDigest=sha256ContentHash(outcome);await source.assertOutcomeCurrent(tx,lineageDigest,outcomeDigest);
   const now=await tx.now();if(!Number.isSafeInteger(now)||now<previous.updatedAt||Date.parse(outcome.observedAt)>now||Date.parse(outcome.observedAt)<previous.createdAt)return fail();
   const saved=receipt(b,key,generation,outcome.kind,outcome,previous.previousCredentialClosureReceiptId),existing=await tx.readOperationalTargetReceipt(saved.receiptId);if(existing){const checked=readOperationalTargetReceipt(existing);if(!same(checked,saved)||previous.lastReceiptId!==saved.receiptId)return fail();return previous}
   const state=readOperationalTarget({...previous,phase:outcome.kind,deploymentId:previous.deploymentId??outcome.deploymentId,lastReceiptId:outcome.receiptId,version:previous.version+1,updatedAt:now});await tx.replaceOperationalTarget(key,previous.version,state);await tx.insertOperationalTargetReceipt(saved);await source.assertOutcomeCurrent(tx,lineageDigest,outcomeDigest);return state;
  },
 });
}
export type OperationalTargetReservations=ReturnType<typeof createOperationalTargetReservations>;
