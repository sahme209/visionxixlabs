import 'server-only';
import {ProviderMergeUnavailable,type ProviderMergeScope,type ReleaseProviderMergeStore} from './releaseProviderMergeStore';
import type {ProviderMergeTransport} from './releaseProviderMergeTransport';
/** Provider-purpose only. No installed production caller or credential/approval adapter. */
export function createReleaseProviderMergeExecutor(store:ReleaseProviderMergeStore,transport?:ProviderMergeTransport){return {async run(scope:ProviderMergeScope,id:string){
 if(!transport||transport.kind!=='provider_merge_transport_v1')throw new ProviderMergeUnavailable('provider_transport_unavailable');
 const claim=await store.claim(scope,id);if(!claim.claimed)return store.recover(scope,id);
 const c=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 try{const plan=await store.beforeDispatch(scope,id);const remaining=Math.min(25000,claim.leaseExpiresAt.getTime()-Date.now());if(remaining<=0)throw Error('expired');
 const result=await Promise.race([Promise.resolve().then(()=>{c.signal.throwIfAborted();if(claim.leaseExpiresAt.getTime()<=Date.now())throw Error('expired');return transport.execute({operationId:id,plan:structuredClone(plan),signal:c.signal})}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{c.abort();reject(Error('timeout'))},remaining)})]);
 if(c.signal.aborted||claim.leaseExpiresAt.getTime()<=Date.now())throw Error('expired');
 return await store.finish(scope,id,result);
 }catch{return await store.finish(scope,id,{state:'unknown'})}finally{clearTimeout(timer);c.abort()}
}}}
