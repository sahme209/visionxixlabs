import 'server-only';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {parseReleaseOperationPlan,type ReleaseOperationPlan} from '@/lib/tauri/releaseOperationPlanContract';
import {createReleaseProviderMergeExecutor} from '@/lib/tauri/releaseProviderMergeExecutor';
import {createReleaseProviderMergeTransport,type ProviderMergeTransportPorts} from '@/lib/tauri/releaseProviderMergeTransport';
import type {ProviderMergeScope,ReleaseProviderMergeStore} from '@/lib/tauri/releaseProviderMergeStore';
import type {GovernanceAdmissionContext,GovernanceAdmissionReceipt,createGovernanceAdmissionGuard} from './admissionGuard';
interface Ports {
 guard:ReturnType<typeof createGovernanceAdmissionGuard>;
 /** Trusted stored plan + server-owned scope mapping. Never accept request facts. */
 readBinding(scope:ProviderMergeScope,id:string,signal:AbortSignal):Promise<{context:GovernanceAdmissionContext;plan:ReleaseOperationPlan}>;
 transport:ProviderMergeTransportPorts;
}
/** Local executor composition. Not mounted, not a coverage registration, and
 * never replaces existing paired authority, approval consumption or policy.
 * One receipt is private to one run; the actual transport checks it again at
 * final authority immediately before the only merge PUT. */
export function createGovernedProviderMergeExecutor(store:ReleaseProviderMergeStore,ports:Ports){return{
 async run(scope:ProviderMergeScope,id:string,parent?:AbortSignal){
  const exactScope=structuredClone(scope),signal=AbortSignal.any([...(parent?[parent]:[]),AbortSignal.timeout(15000)]);
  signal.throwIfAborted();
  const binding=structuredClone(await withGithubAbort(ports.readBinding(exactScope,id,signal),signal));
  const context=binding.context,plan=parseReleaseOperationPlan(binding.plan);
  if(context.organizationId!==exactScope.organizationId||context.actorUserId!==exactScope.actorUserId||context.sessionId!==exactScope.sessionId||context.action!=='repository.merge'||plan.organizationId!==exactScope.organizationId||context.planDigest!==sha256ContentHash(plan))throw Error('governance_merge_binding_unavailable');
  let receipt:GovernanceAdmissionReceipt|undefined;
  const current=ports.transport.assertCurrent;
  const transport=createReleaseProviderMergeTransport({...ports.transport,assertCurrent:async(operationId,currentPlan,providerSignal)=>{
   if(!current||!receipt||operationId!==id||sha256ContentHash(currentPlan)!==context.planDigest)throw Error('governance_merge_binding_unavailable');
   const boundedSignal=AbortSignal.any([signal,providerSignal]);boundedSignal.throwIfAborted();
   await current(operationId,currentPlan,boundedSignal);
   await ports.guard.assert(context,'before_write',receipt,boundedSignal);
  }});
  const executor=createReleaseProviderMergeExecutor({...store,
   claim:async(s,executionId)=>{receipt=await ports.guard.assert(context,'before_claim',undefined,signal);signal.throwIfAborted();return store.claim(s,executionId)},
   beforeDispatch:async(s,executionId)=>{const stored=await store.beforeDispatch(s,executionId);if(sha256ContentHash(stored)!==context.planDigest)throw Error('governance_merge_binding_changed');return stored},
  },{kind:transport.kind,execute:input=>transport.execute({...input,signal:AbortSignal.any([signal,input.signal])})});
  return executor.run(exactScope,id);
 }
}};
