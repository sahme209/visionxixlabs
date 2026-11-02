import 'server-only';
import {governanceContextFromReviewedRelease} from './releaseScope';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {parseReleaseOperationPlan,type ReleaseOperationPlan} from '@/lib/tauri/releaseOperationPlanContract';
import {createReleaseProviderMergeExecutor} from '@/lib/tauri/releaseProviderMergeExecutor';
import {createReleaseProviderMergeTransport,type ProviderMergeTransportPorts} from '@/lib/tauri/releaseProviderMergeTransport';
import type {ProviderMergeScope,ReleaseProviderMergeStore} from '@/lib/tauri/releaseProviderMergeStore';
import type {GovernanceAdmissionContext,GovernanceAdmissionReceipt} from './admissionGuard';
import type {createGovernanceMergeRequestAdmission} from './mergeRequestAdmission';
interface Ports {
 guard:ReturnType<typeof createGovernanceMergeRequestAdmission>;
 /** Trusted stored plan + server-owned scope mapping. Never accept request facts. */
 readBinding(scope:ProviderMergeScope,id:string,signal:AbortSignal):Promise<{context:GovernanceAdmissionContext;plan:ReleaseOperationPlan;release:unknown}>;
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
  const plan=parseReleaseOperationPlan(binding.plan),context=governanceContextFromReviewedRelease({scope:exactScope,row:binding.release,plan});
  if(sha256ContentHash(context)!==sha256ContentHash(binding.context))throw Error('governance_merge_binding_unavailable');
  if(context.organizationId!==exactScope.organizationId||context.actorUserId!==exactScope.actorUserId||context.sessionId!==exactScope.sessionId||context.action!=='repository.merge'||plan.organizationId!==exactScope.organizationId||context.planDigest!==sha256ContentHash(plan))throw Error('governance_merge_binding_unavailable');
  let receipt:GovernanceAdmissionReceipt|undefined;
  const current=ports.transport.assertCurrent;
  const transport=createReleaseProviderMergeTransport({...ports.transport,assertCurrent:async(operationId,currentPlan,providerSignal)=>{
   if(!current||!receipt||operationId!==id||sha256ContentHash(currentPlan)!==context.planDigest)throw Error('governance_merge_binding_unavailable');
   const boundedSignal=AbortSignal.any([signal,providerSignal]);boundedSignal.throwIfAborted();
   const currentFresh=await current(operationId,currentPlan,boundedSignal);
   if(currentFresh!==undefined&&typeof currentFresh!=='function')throw Error('governance_merge_binding_unavailable');
   await ports.guard.assert(context,'before_write',receipt,boundedSignal);
   let finalFresh:(()=>void)|undefined;
   const exact=await withGithubAbort(store.beforeDispatchWithAdmission(exactScope,id,async(tx,p)=>{boundedSignal.throwIfAborted();const freshness=await ports.guard.assertFinal(tx,p,receipt!);boundedSignal.throwIfAborted();return()=>{boundedSignal.throwIfAborted();freshness();boundedSignal.throwIfAborted()}},fresh=>{if(typeof fresh!=='function')throw Error('governance_merge_binding_unavailable');finalFresh=fresh}),boundedSignal);
   if(sha256ContentHash(exact)!==context.planDigest)throw Error('governance_merge_binding_changed');
   if(typeof finalFresh!=='function')throw Error('governance_merge_binding_unavailable');
   return()=>{boundedSignal.throwIfAborted();if(typeof currentFresh==='function')currentFresh();finalFresh!();boundedSignal.throwIfAborted()};
  }});
  const executor=createReleaseProviderMergeExecutor({...store,
   claim:async(s,executionId)=>{if(executionId!==id||sha256ContentHash(s)!==sha256ContentHash(exactScope))throw Error('governance_merge_binding_changed');receipt=await ports.guard.assert(context,'before_claim',undefined,signal);signal.throwIfAborted();return store.claimWithAdmission(s,executionId,async(tx,p)=>{signal.throwIfAborted();const freshness=await ports.guard.assertClaim(tx,p,receipt!);signal.throwIfAborted();return()=>{signal.throwIfAborted();freshness();signal.throwIfAborted()}})},
   beforeDispatch:async(s,executionId)=>{const stored=await store.beforeDispatch(s,executionId);if(sha256ContentHash(stored)!==context.planDigest)throw Error('governance_merge_binding_changed');return stored},
  },{kind:transport.kind,execute:input=>transport.execute({...input,signal:AbortSignal.any([signal,input.signal])})});
  return executor.run(exactScope,id);
 }
}};
