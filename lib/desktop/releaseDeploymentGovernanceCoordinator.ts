import 'server-only';
import type {NextRequest} from 'next/server';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {deploymentScopeSchema,type DeploymentPlan,type DeploymentScope} from '@/lib/tauri/releaseDeploymentExecutionContract';
import type {ReleaseDeploymentExecutionStore} from '@/lib/tauri/releaseDeploymentExecutionStore';
import {createReleaseDeploymentExecutor} from '@/lib/tauri/releaseDeploymentExecutionExecutor';
import {createReleaseDeploymentGithubTransport,type ReleaseDeploymentGithubDependencies} from '@/lib/tauri/releaseDeploymentTransportGithub';
import type {createReleaseDeploymentApprovalStore} from '@/lib/tauri/releaseDeploymentApprovalStore';
import type {createReleaseDeploymentAuthority} from './releaseDeploymentAuthority';
import type {createGovernanceRequestService} from '@/lib/governance/intelligence/requestService';
import {assertNoUncoveredGovernanceExecution} from '@/lib/governance/intelligence/uncoveredExecution';
import {fenceUncoveredMutationStore} from '@/lib/governance/intelligence/uncoveredMutationStore';
import {createGovernanceDeploymentBindingReader} from '@/lib/governance/intelligence/deploymentBindingReader';
import {createDeploymentProviderPreflight,createGovernanceDeploymentRequestAdmission} from '@/lib/governance/intelligence/deploymentRequestAdmission';
import {createGovernedReleaseDeploymentExecutor} from '@/lib/governance/intelligence/governedReleaseDeployment';
type Authority=ReturnType<typeof createReleaseDeploymentAuthority>;
type Approvals=ReturnType<typeof createReleaseDeploymentApprovalStore>;
type Service=ReturnType<typeof createGovernanceRequestService>;
/** Actual request-bound profile selection; none of these server ports or policy
 * facts are accepted from HTTP input. Positive organization absence retains the
 * existing custom-environment executor, with a fused final absence check. */
export function createReleaseDeploymentGovernanceCoordinator(request:NextRequest,repo:ReleaseOperationPlanRepo,rawScope:DeploymentScope,ports:{enabled():boolean;authority:Pick<Authority,'assertCurrent'|'readCurrentPlan'>;approvals:Pick<Approvals,'readGovernanceDeploymentApproval'>;service:Service;transport:ReleaseDeploymentGithubDependencies;current(plan:Readonly<DeploymentPlan>,signal:AbortSignal):Promise<void>}){
 const scope=Object.freeze(deploymentScopeSchema.parse(rawScope));
 const ready=(signal:AbortSignal)=>{signal.throwIfAborted();if(!ports.enabled())throw Error('release_deployment_governance_unavailable')};
 async function any(signal:AbortSignal){ready(signal);const value=await withGithubAbort(ports.service.hasAnyEnrollment(),signal);ready(signal);if(value!==true&&value!==false)throw Error('governance_enrollment_unavailable');return value}
 const fence=(store:ReleaseDeploymentExecutionStore,signal:AbortSignal)=>fenceUncoveredMutationStore(store,()=>assertNoUncoveredGovernanceExecution(request,repo,scope,signal));
 return{
  async prepare(store:ReleaseDeploymentExecutionStore,plan:Readonly<DeploymentPlan>,parent:AbortSignal){
   const signal=AbortSignal.any([request.signal,parent]);ready(signal);
   const enrolled=await any(signal);return withGithubAbort((enrolled?store:fence(store,signal)).prepare(scope,plan),signal);
  },
  async run(store:ReleaseDeploymentExecutionStore,id:string,parent:AbortSignal){
   const signal=AbortSignal.any([request.signal,parent,AbortSignal.timeout(25000)]),started=Date.now();ready(signal);
   if(await any(signal)){
    const readBinding=createGovernanceDeploymentBindingReader(repo,store,{readCurrentPlan:ports.authority.readCurrentPlan,assertCurrent:async(s,sig)=>{ready(sig);if(sha256ContentHash(s)!==sha256ContentHash(scope))throw Error('governance_deployment_identity_changed');await withGithubAbort(repo.$transaction(tx=>ports.authority.assertCurrent(tx,s,undefined)),sig);ready(sig)}});
    const binding=await readBinding(scope,id,signal),provider=createDeploymentProviderPreflight({assertCurrent:ports.current,transport:ports.transport});
    const guard=createGovernanceDeploymentRequestAdmission(scope,id,binding,repo,store,ports.approvals,ports.service,{readBinding,provider});
    return withGithubAbort(createGovernedReleaseDeploymentExecutor(store,{guard,readBinding,transport:ports.transport}).run(scope,id,signal),signal);
   }
   const transport=createReleaseDeploymentGithubTransport(ports.transport);
   const freshLegacy=()=>{ready(signal);const at=Date.now();if(!Number.isFinite(at)||at<started||at>=started+25000)throw Error('governance_deployment_deadline')};
   const legacy={...fence(store,signal),claim:async(s:DeploymentScope,operationId:string)=>{
    freshLegacy();if(sha256ContentHash(s)!==sha256ContentHash(scope)||operationId!==id)throw Error('governance_deployment_identity_changed');
    return withGithubAbort(store.claimWithAdmission(scope,id,async tx=>{freshLegacy();if(await ports.service.readAnyEnrollmentLocked(tx)!==false)throw Error('governance_enrollment_changed');return freshLegacy}),signal);
   }};
   const executor=createReleaseDeploymentExecutor(legacy,{kind:transport.kind,execute:input=>transport.execute({...input,signal:AbortSignal.any([signal,input.signal]),assertCurrent:async()=>{
    const bounded=AbortSignal.any([signal,input.signal]);ready(bounded);await withGithubAbort(input.assertCurrent(),bounded);
    const checked=await withGithubAbort(store.beforeDispatchWithAdmission(scope,id,async(tx,p)=>{
     ready(bounded);if(sha256ContentHash(p)!==sha256ContentHash(input.plan)||await ports.service.readAnyEnrollmentLocked(tx)!==false)throw Error('governance_enrollment_changed');
     return()=>{ready(bounded);const now=Date.now();if(!Number.isFinite(now)||now<started||now>=started+25000)throw Error('governance_deployment_deadline')};
    }),bounded);
    if(sha256ContentHash(checked)!==sha256ContentHash(input.plan))throw Error('governance_deployment_binding_changed');
   }})});
   return withGithubAbort(executor.run(scope,id),signal);
  },
 };
}
