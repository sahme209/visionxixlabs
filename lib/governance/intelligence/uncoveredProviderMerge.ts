import 'server-only';
import type {ProviderMergeScope,ReleaseProviderMergeStore} from '@/lib/tauri/releaseProviderMergeStore';
import type {ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {createReleaseProviderMergeExecutor} from '@/lib/tauri/releaseProviderMergeExecutor';
import {createReleaseProviderMergeTransport,type ProviderMergeTransportPorts} from '@/lib/tauri/releaseProviderMergeTransport';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash} from '@/lib/tauri/contentHash';

/** Legacy/custom scopes retain original authority, never invented enrollment.
 * Positive absence shares the real claim/final transaction's organization lock.
 * No network executes under that lock and no unknown metadata grants fallback. */
export function createUncoveredProviderMergeExecutor(store:ReleaseProviderMergeStore,ports:{
 assertUnenrolled(scope:ProviderMergeScope,signal:AbortSignal):Promise<void>;
 assertUnenrolledLocked(tx:ReleaseOperationPlanTransaction,scope:ProviderMergeScope,signal:AbortSignal):Promise<void>;
 transport:ProviderMergeTransportPorts;
}){return{async run(raw:ProviderMergeScope,id:string,parent?:AbortSignal){
 const scope=structuredClone(raw),signal=AbortSignal.any([...(parent?[parent]:[]),AbortSignal.timeout(15000)]),started=Date.now();
 const fresh=(currentSignal=signal)=>{currentSignal.throwIfAborted();signal.throwIfAborted();const at=Date.now();if(!Number.isFinite(started)||!Number.isFinite(at)||at<started||at>=started+15000)throw Error('governance_execution_coverage_unavailable')};
 const current=ports.transport.assertCurrent;
 const check=async(s:AbortSignal)=>{fresh(s);if(typeof current!=='function'||typeof ports.assertUnenrolled!=='function')throw Error('governance_execution_coverage_unavailable');await withGithubAbort(ports.assertUnenrolled(structuredClone(scope),s),s);fresh(s)};
 const locked=async(tx:ReleaseOperationPlanTransaction,s:AbortSignal)=>{fresh(s);if(typeof ports.assertUnenrolledLocked!=='function')throw Error('governance_execution_coverage_unavailable');await withGithubAbort(ports.assertUnenrolledLocked(tx,structuredClone(scope),s),s);fresh(s);return()=>fresh(s)};
 const transport=createReleaseProviderMergeTransport({...ports.transport,assertCurrent:async(operation,plan,providerSignal)=>{
  const bounded=AbortSignal.any([signal,providerSignal]);fresh(bounded);
  if(operation!==id||!current)throw Error('governance_execution_coverage_unavailable');
  await current(operation,plan,bounded);await check(bounded);
  const actual=await withGithubAbort(store.beforeDispatchWithAdmission(scope,id,tx=>locked(tx,bounded)),bounded);
  fresh(bounded);if(sha256ContentHash(actual)!==sha256ContentHash(plan))throw Error('governance_execution_coverage_unavailable');
 }});
 const executor=createReleaseProviderMergeExecutor({...store,claim:async(s,operation)=>{await check(signal);if(operation!==id||sha256ContentHash(s)!==sha256ContentHash(scope))throw Error('governance_execution_coverage_unavailable');return store.claimWithAdmission(s,operation,tx=>locked(tx,signal))}},{kind:transport.kind,execute:input=>transport.execute({...input,signal:AbortSignal.any([signal,input.signal])})});
 return executor.run(scope,id);
}}}
