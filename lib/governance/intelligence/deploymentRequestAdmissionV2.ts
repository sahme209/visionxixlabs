import 'server-only';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {deploymentPlanSchema,type DeploymentPlan,type DeploymentScope} from '@/lib/tauri/releaseDeploymentExecutionContract';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {ReleaseDeploymentExecutionStore} from '@/lib/tauri/releaseDeploymentExecutionStore';
import type {createReleaseDeploymentApprovalStore} from '@/lib/tauri/releaseDeploymentApprovalStore';
import type {createGovernanceRequestService} from './requestService';
import type {GovernanceDeploymentBinding} from './deploymentBindingReader';
import {createGovernanceReleaseRequestAdmission} from './releaseRequestAdmission';
import {createScopeAwareGovernanceAdmission} from './scopeAwareAdmission';
import type {createDeploymentProviderPreflight} from './deploymentRequestAdmission';
import type {createDeploymentProviderEligibility} from './deploymentProviderEligibility';
type Service=Pick<ReturnType<typeof createGovernanceRequestService>,'readActiveEvidence'|'readScopeEnrollment'|'readScopeEnrollmentLocked'|'readExecutionCoverage'|'executionPolicies'>;
/** One exact existing deployment per composition; all authority ports are internal
 * server compositions. Positively absent enrollment preserves existing authority. */
export function createGovernanceDeploymentRequestAdmissionV2(scope:DeploymentScope,operationId:string,binding:GovernanceDeploymentBinding,repo:ReleaseOperationPlanRepo,store:Pick<ReleaseDeploymentExecutionStore,'beforeDispatch'>,approvals:Pick<ReturnType<typeof createReleaseDeploymentApprovalStore>,'readGovernanceDeploymentApproval'>,service:Service,ports:{readBinding:(scope:DeploymentScope,id:string,signal:AbortSignal)=>Promise<GovernanceDeploymentBinding>;provider:ReturnType<typeof createDeploymentProviderPreflight>;eligibility:ReturnType<typeof createDeploymentProviderEligibility>}){
 const context=structuredClone(binding.context),plan=structuredClone(binding.plan);let policyDigest:string|undefined,latestProviderFresh:(()=>void)|undefined,latestProviderPhase:'before_claim'|'before_write'|undefined;
 async function current(phase:'before_claim'|'before_write',signal:AbortSignal){
  const actual=phase==='before_claim'?(await withGithubAbort(ports.readBinding(scope,operationId,signal),signal)).plan:await withGithubAbort(store.beforeDispatch(scope,operationId),signal);
  if(sha256ContentHash(actual)!==context.planDigest||context.planDigest!==sha256ContentHash(plan))throw Error('governance_deployment_plan_changed');return actual;
 }
 const guard=createGovernanceReleaseRequestAdmission(scope,service,{
  async readCoverage(c,signal){signal.throwIfAborted();const coverage=await service.readExecutionCoverage(c.scope);if(coverage.enrolled!==true||!coverage.coveredActions.includes(c.action))throw Error('governance_execution_coverage_unavailable');return coverage},
  async readActionAuthority(c,baselineDigest,phase,signal){
   if(sha256ContentHash(c)!==sha256ContentHash(context))throw Error('governance_deployment_context_changed');const actual=await current(phase,signal);
   const limits=await withGithubAbort(service.executionPolicies.readAuthority(c.scope,c.action,policyDigest),signal);
   if(phase==='before_claim'){if(policyDigest!==undefined)throw Error('governance_deployment_admission_reused');policyDigest=limits.policyDigest}else if(!policyDigest||limits.policyDigest!==policyDigest)throw Error('governance_execution_policy_changed');
   const proof=phase==='before_claim'?await ports.eligibility.read(actual,signal):await ports.provider.read(actual,signal);
   // All provider reads finish outside locks. Approval consumption remains owned
   // by the existing executor claim, never this read-only authority transaction.
   const approved=await withGithubAbort(repo.$transaction(async tx=>{
    const operation=await tx.durableAgentWorkflow.findFirst({where:{id:operationId,organizationId:scope.organizationId,workflowKind:'release_deployment_execution_v1'}}),input=operation?.inputJson as {scope?:unknown;plan?:unknown;planDigest?:unknown}|undefined;
    if(!input||sha256ContentHash(input.scope)!==sha256ContentHash(scope)||sha256ContentHash(input.plan)!==c.planDigest||input.planDigest!==c.planDigest)throw Error('governance_deployment_binding_changed');
    const approval=await approvals.readGovernanceDeploymentApproval(tx,scope,actual,baselineDigest,phase==='before_write'?operationId:undefined),lockedLimits=await service.executionPolicies.readAuthority(c.scope,c.action,policyDigest,tx);
    if(lockedLimits.policyDigest!==limits.policyDigest||lockedLimits.autonomyLevel!==limits.autonomyLevel||approval.planDigest!==c.planDigest)throw Error('governance_deployment_authority_changed');return approval;
   }),signal);
   await current(phase,signal);const finalLimits=await withGithubAbort(service.executionPolicies.readAuthority(c.scope,c.action,policyDigest),signal);
   if(finalLimits.policyDigest!==limits.policyDigest||finalLimits.autonomyLevel!==limits.autonomyLevel)throw Error('governance_execution_policy_changed');
   const common={platformAllowed:sha256ContentHash(actual)===c.planDigest,autonomyLevel:limits.autonomyLevel,rollbackVerified:false,approval:approved};
   if(phase==='before_claim'){const consumed=ports.eligibility.consume(proof,actual);latestProviderFresh=consumed.assertFresh;latestProviderPhase=phase;return{...consumed.facts,...common,providerAuthority:consumed.authority}}
   const consumed=ports.provider.consume(proof,actual);latestProviderFresh=consumed.assertFresh;latestProviderPhase=phase;
   return{...consumed.facts,...common,providerAuthority:{kind:'release_provider_write_v1' as const,assertFresh:consumed.assertFresh}};
  },
 });
 const scoped=createScopeAwareGovernanceAdmission(scope,{guard,readEnrollment:(c,signal)=>{signal.throwIfAborted();return service.readScopeEnrollment(c.scope)}});
 const issued=new WeakMap<object,{digest:string;receiptDigest:string;policyDigest:string|undefined}>();
 async function assertLocked(tx:ReleaseOperationPlanTransaction,rawPlan:Readonly<DeploymentPlan>,receipt:import('./admissionGuard').GovernanceAdmissionReceipt,phase:'claim'|'dispatch'){
   const saved=issued.get(receipt),actual=deploymentPlanSchema.parse(rawPlan),started=Date.now(),providerFresh=latestProviderFresh;
   const fresh=()=>{const at=Date.now();if(!saved||!Number.isFinite(at)||at<receipt.checkedAt||at-receipt.checkedAt>15000||saved.receiptDigest!==sha256ContentHash(receipt)||receipt.contextDigest!==sha256ContentHash(context)||sha256ContentHash(actual)!==context.planDigest)throw Error('governance_deployment_final_unavailable');if(saved.digest!=='0'.repeat(64)){if(phase==='claim')guard.assertClaimFresh(receipt);else{if(!providerFresh||latestProviderPhase!=='before_write')throw Error('governance_deployment_provider_proof_unavailable');providerFresh()}}};fresh();
   const enrollment=await service.readScopeEnrollmentLocked(tx,context.scope);
   if(saved!.digest==='0'.repeat(64)){if(enrollment.enrolled!==false||saved!.policyDigest!==undefined)throw Error('governance_deployment_enrollment_changed');return fresh}
   if(enrollment.enrolled!==true||enrollment.baselineDigest!==saved!.digest||!saved!.policyDigest||saved!.policyDigest!==policyDigest)throw Error('governance_deployment_enrollment_changed');
   const limits=await service.executionPolicies.readAuthority(context.scope,context.action,saved!.policyDigest,tx);
   if(limits.policyDigest!==saved!.policyDigest||limits.autonomyLevel<4)throw Error('governance_execution_policy_changed');
   const approval=await approvals.readGovernanceDeploymentApproval(tx,scope,actual,saved!.digest,phase==='dispatch'?operationId:undefined);
   if(approval.baselineDigest!==saved!.digest||approval.planDigest!==context.planDigest)throw Error('governance_deployment_authority_changed');
   const policyExpiresAt=Date.parse(limits.expiresAt),approvalExpiresAt=Date.parse(approval.expiresAt);if(!Number.isFinite(policyExpiresAt)||!Number.isFinite(approvalExpiresAt)||!Number.isFinite(enrollment.evidenceExpiresAt))throw Error('governance_deployment_final_unavailable');
   return()=>{fresh();const at=Date.now();if(at<started||at>=enrollment.evidenceExpiresAt||at>=policyExpiresAt||at>=approvalExpiresAt)throw Error('governance_deployment_final_expired')};
 }
 return{
  async assert(...args:Parameters<typeof scoped.assert>){const receipt=await scoped.assert(...args);if(args[1]==='before_claim')issued.set(receipt,{digest:receipt.baselineDigest,receiptDigest:sha256ContentHash(receipt),policyDigest});return receipt},
  /** Mandatory DB-only pre-consumption check with this run's private receipt. */
  assertClaim:(tx:ReleaseOperationPlanTransaction,plan:Readonly<DeploymentPlan>,receipt:import('./admissionGuard').GovernanceAdmissionReceipt)=>assertLocked(tx,plan,receipt,'claim'),
  /** Final dispatch check permits only the same operation's consumed decision. */
  assertFinal:(tx:ReleaseOperationPlanTransaction,plan:Readonly<DeploymentPlan>,receipt:import('./admissionGuard').GovernanceAdmissionReceipt)=>assertLocked(tx,plan,receipt,'dispatch'),
 };
}
