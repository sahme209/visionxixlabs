import 'server-only';
import type {NextRequest} from 'next/server';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {deploymentPlanSchema,deploymentScopeSchema,type DeploymentScope,type DeploymentPlan} from '@/lib/tauri/releaseDeploymentExecutionContract';
import {parseReleaseOperationPlanInput,RELEASE_OPERATION_PLAN_KIND} from '@/lib/tauri/releaseOperationPlanContract';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {AwsConnectionReadRepo} from '@/lib/cloud/aws/enrollment/scopedConnection';
import {createReleaseDeploymentAuthority} from '@/lib/desktop/releaseDeploymentAuthority';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {createGovernanceRequestService} from './requestService';
import {governanceContextFromReviewedDeployment} from './deploymentScope';
/** Server-owned review composition. A returned digest is a review target, never
 * execution authority. Source refresh happens outside the approval transaction. */
export function createGovernanceDeploymentApprovalComposition(request:NextRequest,repo:ReleaseOperationPlanRepo&AwsConnectionReadRepo,rawScope:DeploymentScope,isEnabled:()=>boolean){
 const scope=Object.freeze(deploymentScopeSchema.parse(rawScope));
 const service=createGovernanceRequestService(request,repo,scope,isEnabled);
 const ready=()=>{request.signal.throwIfAborted();if(!isEnabled())throw Error('governance_deployment_approval_unavailable')};
 function plan(raw:Readonly<DeploymentPlan>){const p=deploymentPlanSchema.parse(raw);if(p.organizationId!==scope.organizationId||!['github_protected_tag_v1','github_immutable_release_v1'].includes(p.sourcePolicy))throw Error('governance_deployment_approval_unavailable');return p}
 return{service,
  async readBaseline(raw:Readonly<DeploymentPlan>,parent:AbortSignal){
   ready();const p=plan(raw),signal=AbortSignal.any([request.signal,parent]);signal.throwIfAborted();
   const any=await withGithubAbort(service.hasAnyEnrollment(),signal);if(any===false){ready();return undefined}if(any!==true)throw Error('governance_deployment_enrollment_unavailable');
   const context=await withGithubAbort(repo.$transaction(async tx=>{
    const authority=createReleaseDeploymentAuthority(request,{isEnabled,sourcePolicy:p.sourcePolicy as 'github_protected_tag_v1'|'github_immutable_release_v1',actorPurpose:scope.actorUserId===p.executorUserId?'executor':'approver'});
    await authority.readCurrentPlan(tx,scope,p);
    const releases=await tx.$queryRaw<Array<{id:string;organizationId:string;version:number;status:string;intakeJson:unknown}>>`SELECT "id","organizationId","version","status","intakeJson" FROM "TauriDeploymentRequest" WHERE "id"=${p.releaseId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
    const parent=await tx.durableAgentWorkflow.findFirst({where:{id:p.planId,organizationId:scope.organizationId,workflowKind:RELEASE_OPERATION_PLAN_KIND}});
    if(releases.length!==1||!parent)throw Error('governance_deployment_approval_unavailable');
    return governanceContextFromReviewedDeployment({scope,row:releases[0],plan:p,reviewedPlan:parseReleaseOperationPlanInput(parent.inputJson).plan});
   }),signal);
   const enrollment=await withGithubAbort(service.readScopeEnrollment(context.scope),signal);
   if(enrollment.enrolled===false){ready();signal.throwIfAborted();return undefined}
   if(enrollment.enrolled!==true||!/^[a-f0-9]{64}$/.test(enrollment.baselineDigest))throw Error('governance_deployment_enrollment_unavailable');
   const proof=await withGithubAbort(service.readActiveEvidence(context.scope),signal);
   ready();signal.throwIfAborted();if(proof.baseline.digest!==enrollment.baselineDigest)throw Error('governance_deployment_baseline_changed');
   return proof.baseline.digest;
  },
  async assertBaseline(tx:ReleaseOperationPlanTransaction,raw:DeploymentScope,digest:string,p:Readonly<DeploymentPlan>){
   ready();const current=deploymentScopeSchema.parse(raw);if(sha256ContentHash(current)!==sha256ContentHash(scope)||!/^[a-f0-9]{64}$/.test(digest))throw Error('governance_deployment_identity_changed');
   await service.assertDeploymentApprovalBaseline(tx,current,digest,plan(p));ready();
  },
 };
}
