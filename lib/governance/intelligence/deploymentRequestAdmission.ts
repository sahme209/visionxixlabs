import 'server-only';
import {z} from 'zod';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {deploymentPlanSchema,type DeploymentPlan,type DeploymentScope} from '@/lib/tauri/releaseDeploymentExecutionContract';
import {releaseDeploymentCredentialSchema,verifiedDeploymentWorkflowSchema,type ReleaseDeploymentGithubDependencies} from '@/lib/tauri/releaseDeploymentTransportGithub';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {ReleaseDeploymentExecutionStore} from '@/lib/tauri/releaseDeploymentExecutionStore';
import type {createReleaseDeploymentApprovalStore} from '@/lib/tauri/releaseDeploymentApprovalStore';
import type {createGovernanceRequestService} from './requestService';
import type {GovernanceDeploymentBinding} from './deploymentBindingReader';
import {createGovernanceRequestAdmission} from './requestAdmission';
import {createScopeAwareGovernanceAdmission} from './scopeAwareAdmission';
const sourceProof=z.object({kind:z.literal('verified_release_deployment_source_policy_v1'),planDigest:z.string().regex(/^[a-f0-9]{64}$/),sourcePolicy:z.string()}).strict();
/** Server-only fixed-adapter composition. No token, serialized permission marker
 * or workflow filename is evidence. These fresh existing adapters must establish
 * the credential permissions, exact YAML/input contract and supported source policy.
 * Private proofs are single-use and never represent artifact/run/application health. */
export function createDeploymentProviderPreflight(ports:{assertCurrent(plan:Readonly<DeploymentPlan>,signal:AbortSignal):Promise<void>;transport:ReleaseDeploymentGithubDependencies}){
 const proofs=new WeakMap<object,{planDigest:string;observedAt:number;expiresAt:number}>(),now=ports.transport.now??Date.now;
 const ready=()=>{if(!ports.transport.isEnabled?.()||!ports.transport.readCredential||!ports.transport.readWorkflowContract||!ports.transport.verifySourcePolicy)throw Error('governance_deployment_provider_unavailable')};
 function consume(proof:object,raw:Readonly<DeploymentPlan>){
  const saved=proofs.get(proof),plan=deploymentPlanSchema.parse(raw);proofs.delete(proof);
  // This closure retains only the original private WeakMap evidence. Serialized
  // timestamps and copied descriptors can never renew or construct its window.
  const assertFresh=()=>{const at=now();ready();if(!saved||!Number.isFinite(at)||at<saved.observedAt||at>=saved.expiresAt||saved.planDigest!==sha256ContentHash(plan)||plan.sourcePolicy==='github_immutable_release_v1'&&!ports.transport.allowImmutableTagDispatch?.())throw Error('governance_deployment_provider_proof_unavailable')};
  assertFresh();return Object.freeze({facts:Object.freeze({providerAccessVerified:true as const,verifiedEvidence:true as const}),assertFresh});
 }
 return{
  async read(raw:Readonly<DeploymentPlan>,parent:AbortSignal){
   const plan=deploymentPlanSchema.parse(raw),digest=sha256ContentHash(plan),signal=AbortSignal.any([parent,AbortSignal.timeout(15000)]);ready();
   const current=async()=>{signal.throwIfAborted();ready();if(plan.sourcePolicy==='github_immutable_release_v1'&&!ports.transport.allowImmutableTagDispatch?.())throw Error('governance_deployment_provider_unavailable');await withGithubAbort(ports.assertCurrent(plan,signal),signal);signal.throwIfAborted();ready()};
   await current();const credential=releaseDeploymentCredentialSchema.parse(await withGithubAbort(ports.transport.readCredential!(structuredClone(plan),signal),signal));
   if(credential.organizationId!==plan.organizationId||credential.connectionId!==plan.connectionId||credential.connectionRevision!==plan.connectionRevision||credential.repositoryFullName!==plan.repositoryFullName||credential.installationId!==plan.installationId||credential.expiresAt<=now()+20000)throw Error('governance_deployment_provider_unavailable');
   const workflow=verifiedDeploymentWorkflowSchema.parse(await withGithubAbort(ports.transport.readWorkflowContract!(structuredClone(plan),signal),signal));
   if(workflow.planDigest!==digest||workflow.workflowPath!==plan.workflowPath||workflow.workflowBlobSha!==plan.workflowBlobSha||workflow.sourceCommitSha!==plan.sourceCommitSha||workflow.inputsDigest!==sha256ContentHash(plan.inputs))throw Error('governance_deployment_provider_unavailable');
   const policy=sourceProof.parse(await withGithubAbort(ports.transport.verifySourcePolicy!(structuredClone(plan),signal),signal));
   if(policy.planDigest!==digest||policy.sourcePolicy!==plan.sourcePolicy)throw Error('governance_deployment_provider_unavailable');await current();
   const at=now();if(!Number.isFinite(at)||credential.expiresAt<=at+20000||at>=Date.parse(plan.expiresAt))throw Error('governance_deployment_provider_unavailable');
   const proof=Object.freeze({planDigest:digest,observedAt:at,expiresAt:Math.min(at+5000,credential.expiresAt-20000,Date.parse(plan.expiresAt))});proofs.set(proof,proof);return proof;
  },
  facts:(proof:object,raw:Readonly<DeploymentPlan>)=>consume(proof,raw).facts,
  consume,

 };
}
type Service=Pick<ReturnType<typeof createGovernanceRequestService>,'readActiveEvidence'|'readScopeEnrollment'|'readScopeEnrollmentLocked'|'readExecutionCoverage'|'executionPolicies'>;
/** One exact existing deployment per composition; all authority ports are internal
 * server compositions. Positively absent enrollment preserves existing authority. */
export function createGovernanceDeploymentRequestAdmission(scope:DeploymentScope,operationId:string,binding:GovernanceDeploymentBinding,repo:ReleaseOperationPlanRepo,store:Pick<ReleaseDeploymentExecutionStore,'beforeDispatch'>,approvals:Pick<ReturnType<typeof createReleaseDeploymentApprovalStore>,'readGovernanceDeploymentApproval'>,service:Service,ports:{readBinding:(scope:DeploymentScope,id:string,signal:AbortSignal)=>Promise<GovernanceDeploymentBinding>;provider:ReturnType<typeof createDeploymentProviderPreflight>}){
 const context=structuredClone(binding.context),plan=structuredClone(binding.plan);let policyDigest:string|undefined,latestProviderFresh:(()=>void)|undefined;
 async function current(phase:'before_claim'|'before_write',signal:AbortSignal){
  const actual=phase==='before_claim'?(await withGithubAbort(ports.readBinding(scope,operationId,signal),signal)).plan:await withGithubAbort(store.beforeDispatch(scope,operationId),signal);
  if(sha256ContentHash(actual)!==context.planDigest||context.planDigest!==sha256ContentHash(plan))throw Error('governance_deployment_plan_changed');return actual;
 }
 const guard=createGovernanceRequestAdmission(scope,service,{
  async readCoverage(c,signal){signal.throwIfAborted();const coverage=await service.readExecutionCoverage(c.scope);if(coverage.enrolled!==true||!coverage.coveredActions.includes(c.action))throw Error('governance_execution_coverage_unavailable');return coverage},
  async readActionAuthority(c,baselineDigest,phase,signal){
   if(sha256ContentHash(c)!==sha256ContentHash(context))throw Error('governance_deployment_context_changed');const actual=await current(phase,signal);
   const limits=await withGithubAbort(service.executionPolicies.readAuthority(c.scope,c.action,policyDigest),signal);
   if(phase==='before_claim'){if(policyDigest!==undefined)throw Error('governance_deployment_admission_reused');policyDigest=limits.policyDigest}else if(!policyDigest||limits.policyDigest!==policyDigest)throw Error('governance_execution_policy_changed');
   const proof=await ports.provider.read(actual,signal);
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
   const consumed=ports.provider.consume(proof,actual);latestProviderFresh=consumed.assertFresh;
   return{...consumed.facts,platformAllowed:sha256ContentHash(actual)===c.planDigest,autonomyLevel:limits.autonomyLevel,rollbackVerified:false,approval:approved};
  },
 });
 const scoped=createScopeAwareGovernanceAdmission(scope,{guard,readEnrollment:(c,signal)=>{signal.throwIfAborted();return service.readScopeEnrollment(c.scope)}});
 const issued=new WeakMap<object,{digest:string;receiptDigest:string;policyDigest:string|undefined}>();
 async function assertLocked(tx:ReleaseOperationPlanTransaction,rawPlan:Readonly<DeploymentPlan>,receipt:import('./admissionGuard').GovernanceAdmissionReceipt,phase:'claim'|'dispatch'){
   const saved=issued.get(receipt),actual=deploymentPlanSchema.parse(rawPlan),started=Date.now(),providerFresh=latestProviderFresh;
   const fresh=()=>{const at=Date.now();if(!saved||!Number.isFinite(at)||at<receipt.checkedAt||at-receipt.checkedAt>15000||saved.receiptDigest!==sha256ContentHash(receipt)||receipt.contextDigest!==sha256ContentHash(context)||sha256ContentHash(actual)!==context.planDigest)throw Error('governance_deployment_final_unavailable');if(saved.digest!=='0'.repeat(64)){if(!providerFresh)throw Error('governance_deployment_provider_proof_unavailable');providerFresh()}};fresh();
   const enrollment=await service.readScopeEnrollmentLocked(tx,context.scope);
   if(saved!.digest==='0'.repeat(64)){if(enrollment.enrolled!==false||saved!.policyDigest!==undefined)throw Error('governance_deployment_enrollment_changed');return fresh}
   if(enrollment.enrolled!==true||enrollment.baselineDigest!==saved!.digest||!saved!.policyDigest||saved!.policyDigest!==policyDigest)throw Error('governance_deployment_enrollment_changed');
   const limits=await service.executionPolicies.readAuthority(context.scope,context.action,saved!.policyDigest,tx);
   if(limits.policyDigest!==saved!.policyDigest||limits.autonomyLevel<4)throw Error('governance_execution_policy_changed');
   const approval=await approvals.readGovernanceDeploymentApproval(tx,scope,actual,saved!.digest,phase==='dispatch'?operationId:undefined);
   if(approval.baselineDigest!==saved!.digest||approval.planDigest!==context.planDigest)throw Error('governance_deployment_authority_changed');
   return()=>{fresh();const at=Date.now();if(at<started||at>=enrollment.evidenceExpiresAt||at>=Date.parse(approval.expiresAt))throw Error('governance_deployment_final_expired')};
 }
 return{
  async assert(...args:Parameters<typeof scoped.assert>){const receipt=await scoped.assert(...args);if(args[1]==='before_claim')issued.set(receipt,{digest:receipt.baselineDigest,receiptDigest:sha256ContentHash(receipt),policyDigest});return receipt},
  /** Mandatory DB-only pre-consumption check with this run's private receipt. */
  assertClaim:(tx:ReleaseOperationPlanTransaction,plan:Readonly<DeploymentPlan>,receipt:import('./admissionGuard').GovernanceAdmissionReceipt)=>assertLocked(tx,plan,receipt,'claim'),
  /** Final dispatch check permits only the same operation's consumed decision. */
  assertFinal:(tx:ReleaseOperationPlanTransaction,plan:Readonly<DeploymentPlan>,receipt:import('./admissionGuard').GovernanceAdmissionReceipt)=>assertLocked(tx,plan,receipt,'dispatch'),
 };
}
