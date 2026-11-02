import 'server-only';
import {parseDeploymentIntake} from '@/lib/tauri/deploymentIntakeSchema';
import {deploymentPlanSchema} from '@/lib/tauri/releaseDeploymentExecutionContract';
import {parseReleaseOperationPlan} from '@/lib/tauri/releaseOperationPlanContract';
import {releaseOperationPlanId} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {governanceContextFromReviewedRelease} from './releaseScope';
import type {GovernanceAdmissionContext} from './admissionGuard';
/** Pure mapping of already-authorized stored records. The caller must verify
 * the parent's review history, current participants and installation authority.
 * A source commit in this plan is not itself provider provenance or permission. */
export function governanceContextFromReviewedDeployment(input:{scope:unknown;row:unknown;reviewedPlan:unknown;plan:unknown}):GovernanceAdmissionContext{
 try{
  const parent=parseReleaseOperationPlan(input.reviewedPlan),p=deploymentPlanSchema.parse(input.plan);
  const context=governanceContextFromReviewedRelease({scope:input.scope,row:input.row,plan:parent});
  const row=input.row as {intakeJson:unknown},parsed=parseDeploymentIntake(row.intakeJson);if(!parsed.ok)throw Error();
  const intake=parsed.intake,source=intake.workflowSource;
  if(!source||p.organizationId!==context.organizationId||p.releaseId!==parent.requestId||p.releaseVersion!==parent.requestVersion||p.intakeDigest!==parent.intakeDigest
   ||p.planId!==releaseOperationPlanId(context.organizationId,parent.requestId,parent.requestVersion,sha256ContentHash(parent))
   ||p.repositoryFullName!==parent.pullRequest.repositoryFullName||p.connectionId!==parent.connectionId||p.connectionRevision!==parent.connectionRevision
   ||source.repositoryFullName!==p.repositoryFullName||source.ref!==p.ref||source.path!==p.workflowPath||source.blobSha!==p.workflowBlobSha||p.refKind!=='tag'
   ||sha256ContentHash(intake.workflowInputs)!==sha256ContentHash(p.inputs)||Date.parse(p.windowStart)<Date.parse(intake.windowStartUtc)||Date.parse(p.expiresAt)>Date.parse(intake.windowEndUtc)
   ||!['github_protected_tag_v1','github_immutable_release_v1'].includes(p.sourcePolicy))throw Error();
  return{...context,action:'deployment.dispatch',planDigest:sha256ContentHash(p)};
 }catch{throw Error('governance_deployment_scope_unavailable')}
}
