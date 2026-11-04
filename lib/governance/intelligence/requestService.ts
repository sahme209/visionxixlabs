import {createReleaseDeploymentAuthority} from '@/lib/desktop/releaseDeploymentAuthority';
import {deploymentPlanSchema,type DeploymentScope} from '@/lib/tauri/releaseDeploymentExecutionContract';
import {parseReleaseOperationPlanInput,RELEASE_OPERATION_PLAN_KIND} from '@/lib/tauri/releaseOperationPlanContract';
import {governanceContextFromReviewedDeployment} from './deploymentScope';
import {createGovernanceExecutionPolicyRequestService} from './executionPolicyRequestService';
import {GovernanceBaselineStale} from './errors';
import type {ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {NextRequest} from 'next/server';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {AwsConnectionReadRepo} from '@/lib/cloud/aws/enrollment/scopedConnection';
import {createGovernanceRequestAuthority} from './requestAuthority';
import type {RevisionScope} from './revisionStore';
import {createGithubGovernanceCollectionRequestService} from './githubCollectionRequestService';
import {createAwsGovernanceCollectionRequestService} from './awsCollectionRequestService';
import {createGovernanceRequestServiceCore} from './requestServiceCore';
export function createGovernanceRequestService(request:NextRequest,repo:ReleaseOperationPlanRepo&AwsConnectionReadRepo,scope:RevisionScope,isEnabled:()=>boolean){
 return createGovernanceRequestServiceCore(request,repo,scope,isEnabled,{authority:createGovernanceRequestAuthority(request),executionPolicies:createGovernanceExecutionPolicyRequestService(request,repo,scope,isEnabled),github:revalidationOnly=>createGithubGovernanceCollectionRequestService(request,repo,scope,isEnabled,{revalidationOnly}),aws:revalidationOnly=>createAwsGovernanceCollectionRequestService(request,repo,scope,isEnabled,{revalidationOnly}),assertSource:()=>{},now:Date.now,deployment:({store,activeProofs,bound})=>({
  async assertDeploymentApprovalBaseline(tx:ReleaseOperationPlanTransaction,rawScope:DeploymentScope,expectedDigest:string,rawPlan:unknown){
   bound(rawScope);const plan=deploymentPlanSchema.parse(rawPlan);
   if(!/^[a-f0-9]{64}$/.test(expectedDigest)||plan.organizationId!==scope.organizationId||!['github_protected_tag_v1','github_immutable_release_v1'].includes(plan.sourcePolicy))throw Error('governance_deployment_baseline_unavailable');
   const deploymentAuthority=createReleaseDeploymentAuthority(request,{isEnabled,sourcePolicy:plan.sourcePolicy as 'github_protected_tag_v1'|'github_immutable_release_v1',actorPurpose:scope.actorUserId===plan.executorUserId?'executor':'approver'});
   await deploymentAuthority.readCurrentPlan(tx,rawScope,plan);
   const rows=await tx.$queryRaw<Array<{id:string;organizationId:string;version:number;status:string;intakeJson:unknown}>>`SELECT "id","organizationId","version","status","intakeJson" FROM "TauriDeploymentRequest" WHERE "id"=${plan.releaseId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
   const parents=await tx.durableAgentWorkflow.findFirst({where:{id:plan.planId,organizationId:scope.organizationId,workflowKind:RELEASE_OPERATION_PLAN_KIND}});
   if(rows.length!==1||!parents)throw Error('governance_deployment_baseline_unavailable');
   const context=governanceContextFromReviewedDeployment({scope:rawScope,row:rows[0],plan,reviewedPlan:parseReleaseOperationPlanInput(parents.inputJson).plan});
   const baseline=await store.readActive(scope,context.scope,tx);
   if(baseline.digest!==expectedDigest)throw new GovernanceBaselineStale('baseline_changed');
   // The final awaited clock check also bounds authority/source lock waits.
   const clock=await tx.$queryRaw<Array<{live:boolean}>>`SELECT clock_timestamp() < ${new Date(plan.expiresAt)} AS "live"`;
   const proof=activeProofs.get(baseline.digest),now=Date.now();
   if(clock.length!==1||clock[0].live!==true||!Number.isFinite(now)||now>=Date.parse(plan.expiresAt))throw Error('governance_deployment_baseline_unavailable');
   if(!proof||proof.expiresAt<=now)throw new GovernanceBaselineStale('source_receipt_unavailable');bound(rawScope);
  },
})});
}
