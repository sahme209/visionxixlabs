import 'server-only';
import type {NextRequest} from 'next/server';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {AwsConnectionReadRepo} from '@/lib/cloud/aws/enrollment/scopedConnection';
import type {ProviderMergeApprovalHttpPorts} from '@/lib/desktop/releaseProviderMergeApprovalHttp';
import type {ProviderMergeScope} from '@/lib/tauri/releaseProviderMergeStore';
import {createGovernanceRequestService} from './requestService';
import {governanceContextFromReviewedRelease} from './releaseScope';
import {GovernanceBaselineStale} from './errors';
/** Provider-purpose approval composition only. Does not activate policy, grant
 * access or execute a merge. Actual paired source proof occurs outside locks. */
export function createGovernanceMergeApprovalHttpPorts(request:NextRequest,repo:ReleaseOperationPlanRepo&AwsConnectionReadRepo,isEnabled:()=>boolean):NonNullable<ProviderMergeApprovalHttpPorts['governance']>{
 let owner:ProviderMergeScope|undefined,service:ReturnType<typeof createGovernanceRequestService>|undefined;
 function bound(scope:ProviderMergeScope){if(owner&&sha256ContentHash(owner)!==sha256ContentHash(scope))throw Error('governance_approval_identity_changed');if(!service){owner=structuredClone(scope);service=createGovernanceRequestService(request,repo,owner,isEnabled)}return service}
 return{
  async readBaseline(scope,plan,rawRelease,signal){
   signal.throwIfAborted();const release=rawRelease as {id?:unknown;organizationId?:unknown;version?:unknown;status?:unknown;intakeJson?:unknown};if(!release||release.organizationId!==scope.organizationId||plan.organizationId!==scope.organizationId||release.id!==plan.requestId)throw Error('governance_approval_scope_changed');const current=bound(scope);
   if(!await withGithubAbort(current.hasAnyEnrollment(),signal)){signal.throwIfAborted();return undefined}
   const context=governanceContextFromReviewedRelease({scope,plan,row:{id:release.id,organizationId:release.organizationId,version:release.version,status:release.status,intakeJson:release.intakeJson}}),enrollment=await withGithubAbort(current.readScopeEnrollment(context.scope),signal);
   if(!enrollment.enrolled){signal.throwIfAborted();return undefined}
   const proof=await withGithubAbort(current.readActiveEvidence(context.scope),signal);signal.throwIfAborted();if(proof.baseline.digest!==enrollment.baselineDigest)throw new GovernanceBaselineStale('baseline_changed');return proof.baseline.digest;
  },
  async assertBaseline(tx,scope,digest,plan){return bound(scope).assertMergeApprovalBaseline(tx,scope,digest,plan)},
 };
}
