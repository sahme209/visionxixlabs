import 'server-only';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {createReleaseProviderMergeApprovalStore} from '@/lib/tauri/releaseProviderMergeApprovalStore';
import type {ReleaseProviderMergeStore,ProviderMergeScope} from '@/lib/tauri/releaseProviderMergeStore';
import type {createGovernanceRequestService} from './requestService';
import type {GovernanceAdmissionContext} from './admissionGuard';
import type {ReleaseOperationPlan} from '@/lib/tauri/releaseOperationPlanContract';
import type {createMergeProviderPreflight} from './mergeProviderPreflight';
import {createGovernanceRequestAdmission} from './requestAdmission';
import {createScopeAwareGovernanceAdmission} from './scopeAwareAdmission';

type Service=Pick<ReturnType<typeof createGovernanceRequestService>,'readActiveEvidence'|'readScopeEnrollment'|'readExecutionCoverage'|'executionPolicies'>;
/** One trusted stored operation per composition; HTTP/model input supplies none
 * of these authority facts. Exact policy revision remains bound across phases. */
export function createGovernanceMergeRequestAdmission(scope:ProviderMergeScope,operationId:string,binding:{context:GovernanceAdmissionContext;plan:ReleaseOperationPlan},repo:ReleaseOperationPlanRepo,store:Pick<ReleaseProviderMergeStore,'validatePrepared'|'beforeDispatch'>,approvals:Pick<ReturnType<typeof createReleaseProviderMergeApprovalStore>,'readGovernanceProviderApproval'>,service:Service,provider:ReturnType<typeof createMergeProviderPreflight>){
 const context=structuredClone(binding.context),plan=structuredClone(binding.plan);
 let policyDigest:string|undefined;
 const planIdPattern=/^release_plan_[a-f0-9]{64}$/;
 // The plan identifier is recovered only from the exact stored operation below.
 async function current(phase:'before_claim'|'before_write',signal:AbortSignal){
  const actual=await withGithubAbort(phase==='before_claim'?store.validatePrepared(scope,operationId):store.beforeDispatch(scope,operationId),signal);
  if(sha256ContentHash(actual)!==context.planDigest||context.planDigest!==sha256ContentHash(plan))throw Error('governance_merge_plan_changed');
  return actual;
 }
 const guard=createGovernanceRequestAdmission(scope,service,{
  async readCoverage(c,signal){
   signal.throwIfAborted();const coverage=await service.readExecutionCoverage(c.scope);
   if(coverage.enrolled!==true||!coverage.coveredActions.includes(c.action))throw Error('governance_execution_coverage_unavailable');
   return coverage;
  },
  async readActionAuthority(c,baselineDigest,phase,signal){
   if(sha256ContentHash(c)!==sha256ContentHash(context))throw Error('governance_merge_context_changed');
   const actual=await current(phase,signal);
   const limits=await withGithubAbort(service.executionPolicies.readAuthority(c.scope,c.action,policyDigest),signal);
   if(phase==='before_claim'){if(policyDigest!==undefined)throw Error('governance_merge_admission_reused');policyDigest=limits.policyDigest;}
   else if(!policyDigest||limits.policyDigest!==policyDigest)throw Error('governance_execution_policy_changed');
   const proof=await provider.read(actual,signal);
   // All provider requests have completed before this DB-only transaction.
   const approved=await withGithubAbort(repo.$transaction(async tx=>{
    const operation=await tx.durableAgentWorkflow.findFirst({where:{id:operationId,organizationId:scope.organizationId,workflowKind:'release_provider_merge_v1'}});
    const input=operation?.inputJson as {scope?:unknown;planId?:unknown;planInput?:{plan?:unknown}}|undefined;
    if(!input||sha256ContentHash(input.scope)!==sha256ContentHash(scope)||typeof input.planId!=='string'||!planIdPattern.test(input.planId)||sha256ContentHash(input.planInput?.plan)!==c.planDigest)throw Error('governance_merge_binding_changed');
    const approval=await approvals.readGovernanceProviderApproval(tx,scope,input.planId,baselineDigest,phase==='before_write'?operationId:undefined);
    const currentLimits=await service.executionPolicies.readAuthority(c.scope,c.action,policyDigest,tx);
    if(currentLimits.policyDigest!==limits.policyDigest||currentLimits.autonomyLevel!==limits.autonomyLevel||approval.planDigest!==c.planDigest)throw Error('governance_merge_authority_changed');
    return approval;
   }),signal);
   await current(phase,signal);
   // Recheck policy after the final awaited operation authority as well.
   const finalLimits=await withGithubAbort(service.executionPolicies.readAuthority(c.scope,c.action,policyDigest),signal);
   if(finalLimits.policyDigest!==limits.policyDigest||finalLimits.autonomyLevel!==limits.autonomyLevel)throw Error('governance_execution_policy_changed');
   const facts=provider.facts(proof,actual);
   return{...facts,platformAllowed:sha256ContentHash(actual)===c.planDigest&&limits.policyDigest===policyDigest,autonomyLevel:limits.autonomyLevel,rollbackVerified:false,approval:approved};
  },
 });
 return createScopeAwareGovernanceAdmission(scope,{guard,readEnrollment:(c,signal)=>{signal.throwIfAborted();return service.readScopeEnrollment(c.scope);}});
}
