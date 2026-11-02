import 'server-only';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {deploymentPlanSchema,type DeploymentScope} from '@/lib/tauri/releaseDeploymentExecutionContract';
import {createReleaseDeploymentExecutor} from '@/lib/tauri/releaseDeploymentExecutionExecutor';
import {createReleaseDeploymentGithubTransport,type ReleaseDeploymentGithubDependencies} from '@/lib/tauri/releaseDeploymentTransportGithub';
import type {ReleaseDeploymentExecutionStore} from '@/lib/tauri/releaseDeploymentExecutionStore';
import type {GovernanceAdmissionReceipt} from './admissionGuard';
import type {createGovernanceDeploymentRequestAdmission} from './deploymentRequestAdmission';
import type {GovernanceDeploymentBinding} from './deploymentBindingReader';
import {governanceContextFromReviewedDeployment} from './deploymentScope';
interface Ports{
 guard:ReturnType<typeof createGovernanceDeploymentRequestAdmission>;
 readBinding(scope:DeploymentScope,id:string,signal:AbortSignal):Promise<GovernanceDeploymentBinding>;
 transport:ReleaseDeploymentGithubDependencies;
}
/** Existing durable executor + actual fixed GitHub transport. One private claim
 * receipt is checked after the transport's existing authority callback at every
 * boundary, including immediately after all preflight awaits before dispatch.
 * This composition neither enrolls a scope nor grants coverage or retries. */
export function createGovernedReleaseDeploymentExecutor(store:ReleaseDeploymentExecutionStore,ports:Ports){return{
 async run(rawScope:DeploymentScope,id:string,parent?:AbortSignal){
  const scope=structuredClone(rawScope),signal=AbortSignal.any([...(parent?[parent]:[]),AbortSignal.timeout(15000)]);signal.throwIfAborted();
  const binding=structuredClone(await withGithubAbort(ports.readBinding(scope,id,signal),signal)),plan=deploymentPlanSchema.parse(binding.plan),context=governanceContextFromReviewedDeployment({scope,row:binding.release,reviewedPlan:binding.reviewedPlan,plan});
  if(sha256ContentHash(context)!==sha256ContentHash(binding.context)||context.action!=='deployment.dispatch'||context.planDigest!==sha256ContentHash(plan))throw Error('governance_deployment_binding_unavailable');
  let receipt:GovernanceAdmissionReceipt|undefined;
  const transport=createReleaseDeploymentGithubTransport(ports.transport);
  const executor=createReleaseDeploymentExecutor({...store,
   claim:async(s,operationId)=>{if(sha256ContentHash(s)!==sha256ContentHash(scope)||operationId!==id)throw Error('governance_deployment_binding_changed');receipt=await ports.guard.assert(context,'before_claim',undefined,signal);signal.throwIfAborted();return store.claimWithAdmission(s,operationId,async(tx,currentPlan)=>{
    signal.throwIfAborted();const freshness=await ports.guard.assertClaim(tx,currentPlan,receipt!);signal.throwIfAborted();
    return()=>{signal.throwIfAborted();freshness();signal.throwIfAborted()};
   })},
   beforeDispatch:async(s,operationId)=>{const current=await store.beforeDispatch(s,operationId);if(operationId!==id||sha256ContentHash(current)!==context.planDigest)throw Error('governance_deployment_binding_changed');return current},
  },{kind:transport.kind,execute:input=>transport.execute({...input,signal:AbortSignal.any([signal,input.signal]),assertCurrent:async()=>{
   if(!receipt||input.operationId!==id||sha256ContentHash(input.plan)!==context.planDigest)throw Error('governance_deployment_binding_changed');
   const authoritySignal=AbortSignal.any([signal,input.signal]);authoritySignal.throwIfAborted();const underlyingFresh=await withGithubAbort(input.assertCurrent(),authoritySignal);if(underlyingFresh!==undefined&&typeof underlyingFresh!=='function')throw Error('governance_deployment_authority_unavailable');await ports.guard.assert(context,'before_write',receipt,authoritySignal);
   let privateFresh:(()=>void)|undefined;
   const exact=await withGithubAbort(store.beforeDispatchWithAdmission(scope,id,(tx,currentPlan)=>ports.guard.assertFinal(tx,currentPlan,receipt!),proof=>{privateFresh=proof}),authoritySignal);
   if(typeof privateFresh!=='function')throw Error('governance_deployment_authority_unavailable');
   const assertFresh=()=>{authoritySignal.throwIfAborted();if(typeof underlyingFresh==='function')underlyingFresh();privateFresh!();if(sha256ContentHash(exact)!==context.planDigest||sha256ContentHash(input.plan)!==context.planDigest)throw Error('governance_deployment_binding_changed')};assertFresh();return assertFresh;
  }})});
  return executor.run(scope,id);
 }
}};
