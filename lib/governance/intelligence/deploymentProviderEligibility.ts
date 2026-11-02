import 'server-only';
import {z} from 'zod';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {consumeReleaseInstallationEligibility} from '@/lib/connectors/github/githubAppAuth';
import {deploymentPlanSchema,type DeploymentPlan} from '@/lib/tauri/releaseDeploymentExecutionContract';
import {verifiedDeploymentWorkflowSchema,type ReleaseDeploymentGithubDependencies} from '@/lib/tauri/releaseDeploymentTransportGithub';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
const policySchema=z.object({kind:z.literal('verified_release_deployment_source_policy_v1'),planDigest:z.string().regex(/^[a-f0-9]{64}$/),sourcePolicy:z.string()}).strict();
/** Claim-only composition deliberately never calls transport.readCredential. */
export function createDeploymentProviderEligibility(ports:{assertCurrent(plan:Readonly<DeploymentPlan>,signal:AbortSignal):Promise<void|(()=>void)>;readEligibility(plan:Readonly<DeploymentPlan>,signal:AbortSignal):Promise<object|null>;transport:ReleaseDeploymentGithubDependencies}){
 const proofs=new WeakMap<object,{digest:string;assertFresh:()=>void}>(),now=ports.transport.now??Date.now;
 return{
 async read(raw:Readonly<DeploymentPlan>,parent:AbortSignal){
  const plan=deploymentPlanSchema.parse(raw),digest=hash(plan),started=now(),signal=AbortSignal.any([parent,AbortSignal.timeout(15000)]);
  let currentFresh:(()=>void)|undefined;const ready=()=>{signal.throwIfAborted();currentFresh?.();const at=now();if(!ports.transport.isEnabled?.()||!ports.transport.readWorkflowContract||!ports.transport.verifySourcePolicy||!Number.isFinite(at)||at<started||at>=started+15000||plan.sourcePolicy==='github_immutable_release_v1'&&!ports.transport.allowImmutableTagDispatch?.())throw Error('governance_deployment_eligibility_unavailable')};
  const current=async()=>{ready();const fresh=await withGithubAbort(ports.assertCurrent(plan,signal),signal);if(fresh!==undefined&&typeof fresh!=='function')throw Error('release_eligibility_authority_unavailable');if(typeof fresh==='function'){const prior=currentFresh;currentFresh=()=>{prior?.();if(fresh()!==undefined)throw Error('release_eligibility_authority_unavailable')}}ready()};await current();
  const workflow=verifiedDeploymentWorkflowSchema.parse(await withGithubAbort(ports.transport.readWorkflowContract!(structuredClone(plan),signal),signal));
  if(workflow.planDigest!==digest||workflow.workflowPath!==plan.workflowPath||workflow.workflowBlobSha!==plan.workflowBlobSha||workflow.sourceCommitSha!==plan.sourceCommitSha||workflow.inputsDigest!==hash(plan.inputs))throw Error('governance_deployment_eligibility_unavailable');
  const policy=policySchema.parse(await withGithubAbort(ports.transport.verifySourcePolicy!(structuredClone(plan),signal),signal));if(policy.planDigest!==digest||policy.sourcePolicy!==plan.sourcePolicy)throw Error('governance_deployment_eligibility_unavailable');
  const metadata=await withGithubAbort(ports.readEligibility(structuredClone(plan),signal),signal);if(!metadata)throw Error('governance_deployment_eligibility_unavailable');
  await current();const issued=consumeReleaseInstallationEligibility(metadata,{organizationId:plan.organizationId,connectionId:plan.connectionId,connectionRevision:plan.connectionRevision,installationId:plan.installationId,repositoryFullName:plan.repositoryFullName,purpose:'dispatch',planDigest:digest}),observed=now();
  const fresh=()=>{ready();issued.assertFresh();if(now()<observed||now()>=observed+5000||now()>=Date.parse(plan.expiresAt))throw Error('governance_deployment_eligibility_unavailable')};fresh();const proof=Object.freeze({kind:'deployment_provider_eligibility_v1'});proofs.set(proof,{digest,assertFresh:fresh});return proof;
 },
 consume(proof:object,raw:Readonly<DeploymentPlan>){const saved=proofs.get(proof);proofs.delete(proof);if(!saved||saved.digest!==hash(deploymentPlanSchema.parse(raw)))throw Error('governance_deployment_eligibility_unavailable');saved.assertFresh();return{facts:{providerEligibilityVerified:true as const,verifiedEvidence:true},assertFresh:saved.assertFresh,authority:{kind:'release_provider_eligibility_v1' as const,assertFresh:saved.assertFresh}}},
 };
}
