import 'server-only';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {deploymentPlanSchema,type DeploymentPlan,type DeploymentScope} from '@/lib/tauri/releaseDeploymentExecutionContract';
import {releaseDeploymentExecutionId,type ReleaseDeploymentExecutionStore} from '@/lib/tauri/releaseDeploymentExecutionStore';
import {parseReleaseOperationPlanInput,RELEASE_OPERATION_PLAN_KIND} from '@/lib/tauri/releaseOperationPlanContract';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {governanceContextFromReviewedDeployment} from './deploymentScope';
/** Server-only prepared-operation lookup. Existing authority must recheck the
 * actual reviewed parent/history and all current participants in this transaction.
 * Neither a request scope nor this mapping supplies provider execution permission. */
export function createGovernanceDeploymentBindingReader(repo:ReleaseOperationPlanRepo,store:Pick<ReleaseDeploymentExecutionStore,'get'>,authority:{
 assertCurrent(scope:DeploymentScope,signal:AbortSignal):Promise<void>;
 readCurrentPlan(tx:ReleaseOperationPlanTransaction,scope:DeploymentScope,plan:Readonly<DeploymentPlan>):Promise<unknown>;
}){return async(rawScope:DeploymentScope,id:string,signal:AbortSignal)=>{
 const scope=structuredClone(rawScope),refuse=():never=>{throw Error('governance_deployment_binding_unavailable')};
 signal.throwIfAborted();if(!/^release_deployment_[a-f0-9]{64}$/.test(id))refuse();
 await withGithubAbort(authority.assertCurrent(scope,signal),signal);
 const state=await withGithubAbort(store.get(scope,id),signal);if(state.state!=='prepared'||state.attemptCount!==0||state.version!==0)refuse();
 const result=await withGithubAbort(repo.$transaction(async tx=>{
  const row=await tx.durableAgentWorkflow.findFirst({where:{id,organizationId:scope.organizationId,workflowKind:'release_deployment_execution_v1'}}),binding=row?.inputJson as Record<string,unknown>|undefined;
  if(!row||row.id!==id||row.organizationId!==scope.organizationId||row.workflowKind!=='release_deployment_execution_v1'||row.version!==0||row.attemptCount!==0||row.currentStep!=='prepared'||row.status!=='paused_for_input'||row.maxAttempts!==1||row.leaseOwner||row.leaseExpiresAt||!binding||binding.format!==1||sha256ContentHash(binding.scope)!==sha256ContentHash(scope))refuse();
  if(!binding)throw Error('governance_deployment_binding_unavailable');
  const plan=deploymentPlanSchema.parse(binding.plan);if(releaseDeploymentExecutionId(plan)!==id||binding.planDigest!==sha256ContentHash(plan))refuse();
  const current=deploymentPlanSchema.parse(await authority.readCurrentPlan(tx,scope,plan));if(sha256ContentHash(current)!==sha256ContentHash(plan))refuse();
  const parent=await tx.durableAgentWorkflow.findFirst({where:{id:plan.planId,organizationId:scope.organizationId,workflowKind:RELEASE_OPERATION_PLAN_KIND}});
  if(!parent||parent.id!==plan.planId||parent.organizationId!==scope.organizationId||parent.workflowKind!==RELEASE_OPERATION_PLAN_KIND||parent.version!==1||parent.status!=='completed'||parent.currentStep!=='reviewed')refuse();
  if(!parent)throw Error('governance_deployment_binding_unavailable');
  const input=parseReleaseOperationPlanInput(parent.inputJson);if(input.planDigest!==sha256ContentHash(input.plan))refuse();
  const rows=await tx.$queryRaw<Array<{id:string;organizationId:string;version:number;status:string;intakeJson:unknown}>>`SELECT "id","organizationId","version","status","intakeJson" FROM "TauriDeploymentRequest" WHERE "id"=${plan.releaseId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
  if(rows.length!==1)refuse();const release=rows[0],reviewedPlan=input.plan,context=governanceContextFromReviewedDeployment({scope,row:release,plan,reviewedPlan});
  return{context,plan,release,reviewedPlan};
 }),signal);
 await withGithubAbort(authority.assertCurrent(scope,signal),signal);signal.throwIfAborted();return structuredClone(result);
}}
export type GovernanceDeploymentBinding=Awaited<ReturnType<ReturnType<typeof createGovernanceDeploymentBindingReader>>>;
