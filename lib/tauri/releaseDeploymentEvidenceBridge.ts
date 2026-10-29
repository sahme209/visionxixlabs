import 'server-only';
import {sha256ContentHash} from './contentHash';
import {parseReleaseOperationPlanInput,RELEASE_OPERATION_PLAN_KIND} from './releaseOperationPlanContract';
import {releaseOperationPlanId,type ReleaseOperationPlanTransaction,type ReleaseOperationPlanRepo,type ReleaseOperationPlanRow} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {releaseWorkflowEvidenceBindingSchema,type ReleaseWorkflowEvidenceBinding} from './releaseWorkflowEvidenceContract';
import type {ReleaseWorkflowEvidenceScope,createReleaseWorkflowEvidenceStore} from './releaseWorkflowEvidenceStore';
import type {ReleaseDeploymentExecutionStore} from './releaseDeploymentExecutionStore';
export interface ReleaseDeploymentEvidenceBridgeDependencies{
 deploymentStore?:Pick<ReleaseDeploymentExecutionStore,'readAcceptedEvidenceSource'>;
 historicalDeploymentStore?:Pick<ReleaseDeploymentExecutionStore,'readHistoricalAcceptedSource'>;
 now?:()=>number;
}
/** No global WorkflowRunRecord, copied URL, deploymentPlanDigest substitution or default verifier.
 * The deployment plan must explicitly reference a genuine reviewed merge-plan ID. A deployment-only
 * plan ID without that proven linkage is unavailable, not silently reinterpreted. */
export function createReleaseDeploymentEvidenceBridge(repo:ReleaseOperationPlanRepo,deps:ReleaseDeploymentEvidenceBridgeDependencies={}){
 const fail=():never=>{throw Error('release_dispatch_provenance_unavailable')};
 const now=deps.now??Date.now;
 async function binding(tx:ReleaseOperationPlanTransaction,scope:ReleaseWorkflowEvidenceScope,operationId:string,expiresAt?:string,historical=false){
  const read=historical?deps.historicalDeploymentStore?.readHistoricalAcceptedSource:deps.deploymentStore?.readAcceptedEvidenceSource;if(!read)fail();const accepted=await read!(scope,operationId,tx),p=accepted.plan;
  if(accepted.operationId!==operationId||!/^release_plan_[a-f0-9]{64}$/.test(p.planId))fail();
  const plans=await tx.$queryRaw<ReleaseOperationPlanRow[]>`SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${p.planId} AND "organizationId"=${scope.organizationId} AND "workflowKind"=${RELEASE_OPERATION_PLAN_KIND} FOR SHARE`;
  if(plans.length!==1)fail();const row=plans[0],stored=parseReleaseOperationPlanInput(row.inputJson),m=stored.plan;
  if(row.id!==p.planId||row.organizationId!==scope.organizationId||row.workflowKind!==RELEASE_OPERATION_PLAN_KIND||row.status!=='completed'||row.currentStep!=='reviewed'||row.version!==1||row.attemptCount!==0||row.maxAttempts!==1||row.leaseOwner||row.leaseExpiresAt||row.approvalProposalId||m.organizationId!==p.organizationId||p.organizationId!==scope.organizationId||m.requestId!==p.releaseId||m.requestVersion!==p.releaseVersion||m.intakeDigest!==p.intakeDigest||m.connectionId!==p.connectionId||m.connectionRevision!==p.connectionRevision||m.pullRequest.repositoryFullName!==p.repositoryFullName||stored.planDigest!==sha256ContentHash(m)||row.id!==releaseOperationPlanId(scope.organizationId,p.releaseId,p.releaseVersion,stored.planDigest)||stored.releaseRequesterUserId!==p.requesterUserId)fail();
  const history=await tx.durableAgentWorkflowEvent.findMany({where:{workflowRunId:row.id,organizationId:scope.organizationId},orderBy:{sequence:'asc'},take:3});
  if(history.length!==2||history.some((e,i)=>e.workflowRunId!==row.id||e.organizationId!==scope.organizationId||e.sequence!==i||e.actorKind!=='user'||!Number.isFinite(e.occurredAt.getTime())||e.eventType!==(i?'release_plan.reviewed':'release_plan.created'))||history[0].actorId!==row.requestedByUserId||!history[1].actorId||[row.requestedByUserId,stored.releaseRequesterUserId].includes(history[1].actorId))fail();
  // This is a fresh read lease; the original execution approval remains historical.
  if(!Number.isFinite(Date.parse(accepted.acceptedAt))||!Number.isFinite(Date.parse(accepted.expiresAt))||Date.parse(accepted.acceptedAt)>now()||Date.parse(accepted.acceptedAt)>=Date.parse(accepted.expiresAt))fail();
  const end=expiresAt??new Date(now()+900000).toISOString();if(!Number.isFinite(now())||!Number.isFinite(Date.parse(end))||!historical&&(Date.parse(end)<=now()||Date.parse(end)>now()+900000))fail();
  const result=releaseWorkflowEvidenceBindingSchema.parse({organizationId:scope.organizationId,releaseId:p.releaseId,releaseVersion:p.releaseVersion,intakeDigest:p.intakeDigest,planId:p.planId,planDigest:stored.planDigest,connectionId:p.connectionId,connectionRevision:p.connectionRevision,repositoryFullName:p.repositoryFullName,workflowPath:p.workflowPath,dispatchedRef:p.ref,sourceCommit:p.sourceCommitSha,runId:accepted.receipt.runId,runAttempt:accepted.receipt.runAttempt,dispatchEvidenceDigest:accepted.dispatchEvidenceDigest,expiresAt:end});
  const final=await read!(scope,operationId,tx);if(sha256ContentHash(final)!==sha256ContentHash(accepted)||!historical&&Date.parse(result.expiresAt)<=now())fail();return result;
 }
 return{
 /** Current-reader historical provenance only; original evidence lease is preserved. */
 async readHistoricalBinding(tx:ReleaseOperationPlanTransaction,reader:ReleaseWorkflowEvidenceScope,expected:Readonly<ReleaseWorkflowEvidenceBinding>){const b=releaseWorkflowEvidenceBindingSchema.parse(expected);if(b.organizationId!==reader.organizationId)fail();const operationId='release_deployment_'+sha256ContentHash({organizationId:b.organizationId,releaseId:b.releaseId,releaseVersion:b.releaseVersion,planId:b.planId}),rebuilt=await binding(tx,reader,operationId,b.expiresAt,true);if(sha256ContentHash(rebuilt)!==sha256ContentHash(b))fail();return rebuilt},
 /** Trusted server caller supplies only an operation ID; binding is rebuilt from the validated ledger. */
 async readAcceptedBinding(scope:ReleaseWorkflowEvidenceScope,operationId:string){if(!/^release_deployment_[a-f0-9]{64}$/.test(operationId))fail();return repo.$transaction(tx=>binding(tx,scope,operationId))},
 async createFromAcceptedOperation(scope:ReleaseWorkflowEvidenceScope,operationId:string,evidenceStore?:Pick<ReturnType<typeof createReleaseWorkflowEvidenceStore>,'create'>){if(!evidenceStore)fail();const fresh=await repo.$transaction(tx=>binding(tx,scope,operationId));return evidenceStore!.create(scope,fresh)},
 async readCurrentBinding(tx:ReleaseOperationPlanTransaction,scope:ReleaseWorkflowEvidenceScope,expected:Readonly<ReleaseWorkflowEvidenceBinding>){const b=releaseWorkflowEvidenceBindingSchema.parse(expected),operationId='release_deployment_'+sha256ContentHash({organizationId:b.organizationId,releaseId:b.releaseId,releaseVersion:b.releaseVersion,planId:b.planId});const fresh=await binding(tx,scope,operationId,b.expiresAt);if(sha256ContentHash(fresh)!==sha256ContentHash(b))fail();return fresh}
 };
}
