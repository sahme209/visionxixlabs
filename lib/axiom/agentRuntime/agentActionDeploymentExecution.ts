import 'server-only';
import {z} from 'zod';
import {ALL_ENVIRONMENT_TIERS} from '@/lib/releaseops/environmentCreateResponder';
import type {NextRequest} from 'next/server';
import type {DesktopRequestPrincipal} from '@/lib/desktop/resolveRequestDesktopSession';
import {createCurrentGithubWriteGuard} from '@/lib/desktop/currentGithubWriteAuthority';
import {parseRepositoryFullName} from '@/lib/connectors/github/resolveTenantScopedToken';
import {dispatchWorkflow} from '@/lib/connectors/github/githubWriteClient';
import {isDefiniteWorkflowDispatchRejection} from '@/lib/connectors/github/workflowDispatchOutcome';
import {AWS_ECS_DEPLOY_WORKFLOW_FILENAME} from '@/lib/releaseops/awsEcsDeployWorkflowTemplate';
import {evaluateDeploymentPolicy,type DeploymentPolicyRepo} from '@/lib/releaseops/deploymentPolicyGuard';
import {reserveDeploymentDispatch,releaseDeploymentDispatch,settleDeploymentDispatch,type DeploymentReservationRepo} from '@/lib/billing/deploymentDispatchReservation';
import {agentRestartWorkflowSourceSchema,restartWorkflowSourceFromArgs} from '@/lib/tauri/agentRestartWorkflowSource';
import {observeAgentRestartWorkflowSource,AGENT_RESTART_WORKFLOW_CONTENT_SHA256} from './agentRestartWorkflowSource';
import {captureRestartTarget,matchesRestartTarget,type RestartTargetRepo} from './restartTargetReview';
import {readAgentDeploymentAuthoritySnapshot} from './agentDeploymentAuthoritySnapshot';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import type {createAgentActionExecutionStore} from './agentActionExecutionStore';
import type {AgentExecutionScope} from './agentActionExecutionContract';
type Store=ReturnType<typeof createAgentActionExecutionStore>;
export type AgentDeploymentExecutionRepo=Parameters<typeof createCurrentGithubWriteGuard>[2]&RestartTargetRepo&DeploymentPolicyRepo&DeploymentReservationRepo;
const ref=z.string().min(1).max(240).refine(v=>!v.startsWith('/')&&!v.endsWith('/')&&!v.includes('..')&&!v.includes('@{')&&!/[\s~^:?*\[\]\\]/.test(v));
export const agentDeploymentArgsSchema=z.object({repositoryFullName:z.string().min(1).max(240),environmentId:z.string().min(1).max(240),sourceRef:ref.default('main'),sourceKind:z.enum(['branch','tag']).default('branch'),pullRequestNumber:z.number().int().positive().optional(),promotedFromExecutionId:z.never().optional(),_review:z.record(z.string(),z.unknown()),_restartSource:agentRestartWorkflowSourceSchema});
/** Server-only closed adapter. This is an ECS restart, never immutable artifact
 * promotion or baseline admission. The provider still dispatches a symbolic ref;
 * an explicitly reviewed immutable tag is required. Full baseline admission and
 * public execution qualification remain separate prerequisites. */
export async function executeStoredAgentDeployment(request:NextRequest,principal:DesktopRequestPrincipal,repo:AgentDeploymentExecutionRepo,store:Store,scope:AgentExecutionScope,id:string,saved:Awaited<ReturnType<Store['inspectForExecution']>>){
 if(principal.credentialKind!=='desktop_session'||principal.id!==scope.sessionId||principal.userId!==scope.actorUserId||principal.organizationId!==scope.organizationId)throw Error('agent_execution_scope_unavailable');
 const args=agentDeploymentArgsSchema.parse(saved.args),parsed=parseRepositoryFullName(args.repositoryFullName);
 const reviewedSource=restartWorkflowSourceFromArgs(args);
 if(saved.toolName!=='trigger_aws_deploy'||!parsed||!reviewedSource||reviewedSource.workflowContentSha256!==AGENT_RESTART_WORKFLOW_CONTENT_SHA256)throw Error('agent_execution_source_unavailable');
 const target=await captureRestartTarget(repo,scope.organizationId,args.environmentId);
 if(!target||!z.enum(ALL_ENVIRONMENT_TIERS).safeParse(target.environmentTier).success||!matchesRestartTarget(args._review,target))throw Error('agent_execution_target_unavailable');
 const guard=createCurrentGithubWriteGuard(request,principal,repo,'deployment_dispatch');
 await guard();
 const claimed=await store.claim(scope,id);if(!claimed.claimed)return claimed.operation;
 let outcome:'confirmed'|'refused'|'unknown'='refused',reservationId:string|undefined,dispatchPossible=false;
 try{
  const token=await guard.resolveToken(parsed);if(!token.ok)throw Error('agent_execution_credentials_unavailable');
  const observeSource=async()=>{
   const observed=await observeAgentRestartWorkflowSource({repositoryFullName:args.repositoryFullName,sourceKind:'tag',sourceRef:reviewedSource.tagName,installationToken:token.token,signal:request.signal});
   if(!observed||observed.expiresAt<=Date.now()||sha256ContentHash(observed.source)!==sha256ContentHash(reviewedSource))throw Error('agent_execution_workflow_source_changed');
   return observed;
  };
  await observeSource();
  const exact=async()=>{const current=await store.beforeDispatch(scope,claimed.claim);if(sha256ContentHash(current)!==sha256ContentHash(saved))throw Error('agent_execution_source_changed');request.signal.throwIfAborted()};
  const policyInput={requestedCapability:'legacy_ecs_restart' as const,organizationId:scope.organizationId,environmentId:args.environmentId,...parsed,sourceRef:args.sourceRef,sourceKind:args.sourceKind,...(args.pullRequestNumber?{pullRequestNumber:args.pullRequestNumber}:{}),...(target.environmentTier==='prod'?{requiredControlSet:'production' as const}:{}),installationToken:token.token};
  const policyRepo:DeploymentPolicyRepo={repository:{async findMany(input){return(await repo.repository.findMany(input)).sort((a,b)=>a.id.localeCompare(b.id))}},branchEnvironmentPolicy:{async findMany(input){return(await repo.branchEnvironmentPolicy.findMany(input)).sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id))}},deploymentExecution:repo.deploymentExecution};
  const policy=async()=>{
   const before=await readAgentDeploymentAuthoritySnapshot(repo,scope.organizationId,args.environmentId);
   const decision=await evaluateDeploymentPolicy(policyRepo,policyInput);
   const after=await readAgentDeploymentAuthoritySnapshot(repo,scope.organizationId,args.environmentId);
   if(before!==after||!decision.ok||decision.sourceCommitSha!==reviewedSource.sourceCommitSha)throw Error('agent_execution_deployment_policy_unavailable');
   return{decision,digest:after};
  };
  const admitted=await policy();await exact();
  const reservation=await reserveDeploymentDispatch(repo,{organizationId:scope.organizationId,idempotencyKey:id,environmentId:args.environmentId,repositoryFullName:args.repositoryFullName,sourceRef:args.sourceRef,sourceKind:args.sourceKind,sourceCommitSha:admitted.decision.sourceCommitSha,branchPolicyId:admitted.decision.policyId,promotedFromExecutionId:null,pullRequestUrl:admitted.decision.pullRequestUrl,source:'agent',triggeredByUserId:scope.actorUserId});
  if(!reservation.ok){if(reservation.error==='deployment_already_in_progress')outcome='unknown';else throw Error('agent_execution_reservation_unavailable')}
  else if(reservation.reused){outcome='unknown'}
  else{
   reservationId=reservation.reservation.id;
   const beforeWrite=async()=>{
    const currentTarget=await captureRestartTarget(repo,scope.organizationId,args.environmentId);
    if(!currentTarget||!matchesRestartTarget(args._review,currentTarget))throw Error('agent_execution_target_unavailable');
    const currentPolicy=await policy();
    if(currentPolicy.digest!==admitted.digest||sha256ContentHash(currentPolicy.decision)!==sha256ContentHash(admitted.decision))throw Error('agent_execution_deployment_policy_changed');
    await exact();await guard();
    const sourceReceipt=await observeSource();
    const final=await store.beforeDeploymentDispatch(scope,claimed.claim,guard.connectionBinding(),{target,policySnapshotDigest:admitted.digest,sourceCommitSha:admitted.decision.sourceCommitSha});
    if(sha256ContentHash(final)!==sha256ContentHash(saved))throw Error('agent_execution_source_changed');
    request.signal.throwIfAborted();
    if(sourceReceipt.expiresAt<=Date.now())throw Error('agent_execution_workflow_source_expired');
    dispatchPossible=true;
   };
   const result=await dispatchWorkflow({...parsed,workflowFile:AWS_ECS_DEPLOY_WORKFLOW_FILENAME,ref:reviewedSource.ref,inputs:{role_arn:target.roleArn,region:target.region,cluster:target.ecsCluster,service:target.ecsService},installationToken:token.token,beforeWrite});
   if(result.ok){
    outcome='confirmed';
    // Provider acceptance is already confirmed. Failed tracking persistence may
    // not erase it or cause a second dispatch; the existing hold remains held.
    await settleDeploymentDispatch(repo,scope.organizationId,reservationId,{workflowRunId:result.data.workflowRunId,workflowUrl:result.data.htmlUrl});
   }else outcome=isDefiniteWorkflowDispatchRejection(result.error)?'refused':dispatchPossible?'unknown':'refused';
  }
 }catch{outcome=dispatchPossible?'unknown':'refused'}
 if(outcome==='refused'&&reservationId)await releaseDeploymentDispatch(repo,scope.organizationId,reservationId);
 // Exactly one durable outcome call, outside dispatch catch. Lost completion
 // response cannot re-enter reservation, provider dispatch or completion.
 return store.complete(claimed.claim,outcome,{code:outcome==='confirmed'?'action_completed':outcome==='unknown'?'provider_outcome_unknown':'pre_dispatch_refused'});
}
