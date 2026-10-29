import 'server-only';
import {ReleaseDeploymentUnavailable,type ReleaseDeploymentExecutionStore} from './releaseDeploymentExecutionStore';
import type {DeploymentScope,DeploymentPlan,DeploymentResult} from './releaseDeploymentExecutionContract';
export interface ReleaseDeploymentTransport{kind:'release_deployment_transport_v1';execute(input:{operationId:string;plan:DeploymentPlan;signal:AbortSignal;assertCurrent:()=>Promise<void>}):Promise<DeploymentResult>}
/** No installed transport or route. A successful acknowledgement is not deployment success. */
export function createReleaseDeploymentExecutor(store:ReleaseDeploymentExecutionStore,transport?:ReleaseDeploymentTransport,now:()=>Date=()=>new Date()) {return{async run(scope:DeploymentScope,id:string){
 if(!transport||transport.kind!=='release_deployment_transport_v1')throw new ReleaseDeploymentUnavailable();
 const claim=await store.claim(scope,id);if(!claim.claimed)return store.recover(scope,id);
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 try{const plan=await store.beforeDispatch(scope,id),remaining=Math.min(25000,claim.leaseExpiresAt.getTime()-now().getTime());if(!Number.isFinite(remaining)||remaining<=0)throw Error('expired');
 const result=await Promise.race([Promise.resolve().then(()=>{controller.signal.throwIfAborted();if(now().getTime()>=claim.leaseExpiresAt.getTime())throw Error('expired');return transport.execute({operationId:id,plan:structuredClone(plan),signal:controller.signal,assertCurrent:async()=>{controller.signal.throwIfAborted();await store.beforeDispatch(scope,id);controller.signal.throwIfAborted();if(now().getTime()>=claim.leaseExpiresAt.getTime())throw Error('expired')}})}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('timeout'))},remaining)})]);if(controller.signal.aborted||now().getTime()>=claim.leaseExpiresAt.getTime())throw Error('expired');return await store.finish(scope,id,result);
 }catch{return store.finish(scope,id,{state:'unknown'})}finally{clearTimeout(timer);controller.abort()}
}}}
