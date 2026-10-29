import 'server-only';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {deploymentScopeSchema} from './releaseDeploymentExecutionContract';
import type {ReleaseDeploymentExecutionStore} from './releaseDeploymentExecutionStore';
import {createReleaseDeploymentEvidenceBridge} from './releaseDeploymentEvidenceBridge';
import {createReleaseWorkflowEvidenceStore,type ReleaseWorkflowEvidenceScope} from './releaseWorkflowEvidenceStore';
import {createReleaseWorkflowObservationGithub,type ReleaseWorkflowObservationGithubDependencies} from './releaseWorkflowObservationGithub';
import type {ReleaseWorkflowEvidenceBinding} from './releaseWorkflowEvidenceContract';
import {createTicketDeploymentEvidenceReader} from '@/lib/desktop/ticketDeploymentEvidence';
import {sha256ContentHash} from './contentHash';

export interface ReleaseEvidenceServiceDependencies {
 isEnabled?:()=>boolean;
 /** Use the supplied transaction for current session/membership checks; do not
  * open a second locking transaction while this transaction holds source rows. */
 assertCurrent?:(tx:ReleaseOperationPlanTransaction,scope:ReleaseWorkflowEvidenceScope)=>Promise<void>;
 deploymentStore?:Pick<ReleaseDeploymentExecutionStore,'readAcceptedEvidenceSource'>;
 readCredential?:ReleaseWorkflowObservationGithubDependencies['readCredential'];
 fetch?:typeof fetch;
 now?:()=>number;
}
/** Per-request, server-owned composition of existing audited stores/adapters.
 * No runtime default, credentials, dispatch/approval transport or provider writes.
 * The accepted ledger remains unavailable unless its genuine source-policy and
 * independent-approval checks are configured by the host. Never echo a run URL.
 */
export function createReleaseEvidenceServices(repo:ReleaseOperationPlanRepo,rawScope:ReleaseWorkflowEvidenceScope,deps:ReleaseEvidenceServiceDependencies={}) {
 const scope=Object.freeze(deploymentScopeSchema.parse(rawScope));
 const sameScope=(value:ReleaseWorkflowEvidenceScope)=>sha256ContentHash(deploymentScopeSchema.parse(value))===sha256ContentHash(scope);
 const available=()=>Boolean(deps.isEnabled?.()&&deps.assertCurrent&&deps.deploymentStore&&deps.readCredential&&deps.fetch);
 const ready=()=>{if(!available())throw Error('release_evidence_services_unavailable')};
 const identity=async(tx:ReleaseOperationPlanTransaction,currentScope:ReleaseWorkflowEvidenceScope)=>{
  if(!deps.assertCurrent||!sameScope(currentScope))throw Error('release_evidence_scope_changed');
  await deps.assertCurrent(tx,scope);
 };
 const authority=async(tx:ReleaseOperationPlanTransaction,currentScope:ReleaseWorkflowEvidenceScope)=>{
  ready();await identity(tx,currentScope);ready();
 };
 const bridge=createReleaseDeploymentEvidenceBridge(repo,{deploymentStore:deps.deploymentStore,now:deps.now});
 const readCurrentBinding=async(tx:ReleaseOperationPlanTransaction,currentScope:ReleaseWorkflowEvidenceScope,binding:Readonly<ReleaseWorkflowEvidenceBinding>)=>{
  await authority(tx,currentScope);const result=await bridge.readCurrentBinding(tx,scope,binding);await authority(tx,currentScope);return result;
 };
 const verifyObservation=createReleaseWorkflowObservationGithub({
  isEnabled:available,now:deps.now,fetch:deps.fetch,
  assertCurrent:async(binding,signal)=>{signal.throwIfAborted();if(binding.organizationId!==scope.organizationId)throw Error('release_evidence_scope_changed');await repo.$transaction(tx=>authority(tx,scope));signal.throwIfAborted()},
  readTrustedDispatchBinding:async(binding,signal)=>{signal.throwIfAborted();const current=await repo.$transaction(tx=>readCurrentBinding(tx,scope,binding));signal.throwIfAborted();return current},
  readCredential:deps.readCredential,
 });
 const store=createReleaseWorkflowEvidenceStore(repo,{assertCurrent:authority,readCurrentBinding,verifyObservation,now:deps.now?()=>new Date(deps.now!()):undefined});
 const history=createReleaseWorkflowEvidenceStore(repo,{assertCurrent:identity,now:deps.now?()=>new Date(deps.now!()):undefined});
 const ticketReader=createTicketDeploymentEvidenceReader({
  now:deps.now,
  assertCurrent:async(currentScope,signal)=>{signal.throwIfAborted();await repo.$transaction(tx=>authority(tx,currentScope));signal.throwIfAborted()},
  readEvidence:async(currentScope,id,signal)=>{ready();if(!sameScope(currentScope))throw Error('release_evidence_scope_changed');signal.throwIfAborted();const result=await store.get(scope,id);signal.throwIfAborted();return result},
  readCurrentBinding:async(currentScope,binding,signal)=>{signal.throwIfAborted();const result=await repo.$transaction(tx=>readCurrentBinding(tx,currentScope,binding));signal.throwIfAborted();return result},
 });
 return {
  available,
  /** Only a genuine accepted operation ID enters; the existing bridge rebuilds provenance. */
  async createFromAcceptedOperation(operationId:string){ready();await repo.$transaction(tx=>authority(tx,scope));const result=await bridge.createFromAcceptedOperation(scope,operationId,store);await repo.$transaction(tx=>authority(tx,scope));return result},
  async reconcile(input:{id:string;expectedVersion:number},signal:AbortSignal){ready();return store.reconcile(scope,input,signal)},
  async cancel(input:{id:string;expectedVersion:number}){return history.cancel(scope,input)},
  readTicketEvidence:ticketReader,
  /** Internal injection into the existing evidence HTTP factory, never request data. */
  workflowHttpPorts:{enabled:available,readCurrentBinding,verifyObservation},
 };
}
