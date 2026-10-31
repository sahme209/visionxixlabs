import 'server-only';
import type {ProviderMergeScope,ReleaseProviderMergeStore} from '@/lib/tauri/releaseProviderMergeStore';
import {createReleaseProviderMergeExecutor} from '@/lib/tauri/releaseProviderMergeExecutor';
import {createReleaseProviderMergeTransport,type ProviderMergeTransportPorts} from '@/lib/tauri/releaseProviderMergeTransport';

/** Legacy merge retains all original authority. Absence of a configured policy
 * guard is NOT permission to bypass existing tenant enrollment. The trusted
 * metadata fence is repeated before claim and at transport authority checks. */
export function createUncoveredProviderMergeExecutor(store:ReleaseProviderMergeStore,ports:{
 assertUnenrolled(scope:ProviderMergeScope,signal:AbortSignal):Promise<void>;
 transport:ProviderMergeTransportPorts;
}){return{async run(raw:ProviderMergeScope,id:string,parent?:AbortSignal){
 const scope=structuredClone(raw),signal=AbortSignal.any([...(parent?[parent]:[]),AbortSignal.timeout(15000)]);
 const current=ports.transport.assertCurrent;
 const check=async(s:AbortSignal)=>{s.throwIfAborted();if(typeof current!=='function'||typeof ports.assertUnenrolled!=='function')throw Error('governance_execution_coverage_unavailable');await ports.assertUnenrolled(structuredClone(scope),s);s.throwIfAborted()};
 const transport=createReleaseProviderMergeTransport({...ports.transport,assertCurrent:async(operation,plan,providerSignal)=>{
  const bounded=AbortSignal.any([signal,providerSignal]);bounded.throwIfAborted();
  if(operation!==id||!current)throw Error('governance_execution_coverage_unavailable');
  await current(operation,plan,bounded);await check(bounded);
 }});
 const executor=createReleaseProviderMergeExecutor({...store,claim:async(s,operation)=>{await check(signal);return store.claim(s,operation)}},{kind:transport.kind,execute:input=>transport.execute({...input,signal:AbortSignal.any([signal,input.signal])})});
 return executor.run(scope,id);
}}}
