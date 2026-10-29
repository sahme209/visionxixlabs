import 'server-only';
import {z} from 'zod';
import type {NextRequest} from 'next/server';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import {hasDesktopCapability,type DesktopWorkspaceRole} from './desktopAuthorization';
import {parseDeploymentIntake} from '@/lib/tauri/deploymentIntakeSchema';
import {validateIntake} from '@/lib/tauri/deploymentOperations';
import {buildReleaseMergePlan} from '@/lib/tauri/releaseMergePlan';
import {parseReleaseOperationPlanInput,RELEASE_OPERATION_PLAN_KIND} from '@/lib/tauri/releaseOperationPlanContract';
import {releaseOperationPlanId,type ReleaseOperationPlanTransaction as Tx,type ReleaseOperationPlanRow as Row} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {deploymentPlanSchema,type DeploymentPlan,type DeploymentScope,type DeploymentApproval} from '@/lib/tauri/releaseDeploymentExecutionContract';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {PROTECTED_TAG_POLICY} from '@/lib/tauri/releaseProtectedTagPolicy';
const refuse=():never=>{throw Error('release_deployment_authority_unavailable')};
const roles=new Set(['owner','admin','operator','security_reviewer','finance_viewer','read_only']);
/** Request-bound server checks under the caller's existing transaction. No client authority flags. */
export function createReleaseDeploymentAuthority(request:NextRequest,options:{sourcePolicy?:'github_protected_tag_v1'|'github_immutable_release_v1';isEnabled?:()=>boolean;actorPurpose?:'approver'|'executor';memoizeReadOnlyTransactionPlans?:boolean}={}){
 // Observation-only reconstruction cache: every source row is held FOR SHARE
 // in this transaction. Never reuse across transactions or for execution. Live
 // caller/session authority is still checked before and after every lookup.
 const readPlans=new WeakMap<Tx,Map<string,DeploymentPlan>>();
 const guard=()=>{request.signal.throwIfAborted();if(!options.isEnabled?.())refuse()};
 async function principal(s:DeploymentScope,purpose:'approver'|'executor'){
  const capability=purpose==='approver'?'agent:approve':'deploy:execute';
  guard();const p=await resolveRequestDesktopSession(request,{requiredScope:purpose==='approver'?'pipeline:read':'pipeline:trigger',requiredCapability:capability,requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'release deployment authority'});guard();
  if(!p||p.credentialKind!=='desktop_session'||p.id!==s.sessionId||p.userId!==s.actorUserId||p.organizationId!==s.organizationId||!p.capabilities.includes(capability)||!p.capabilities.includes('github:read'))refuse();
 }
 async function actor(tx:Tx,s:DeploymentScope,userId:string,sessionId?:string,purpose:'reader'|'approver'|'executor'='executor'){
  const members=await tx.$queryRaw<Array<{organizationId:string;userId:string;role:string;acceptedAt:Date|null}>>`SELECT "organizationId","userId","role","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${s.organizationId} AND "userId"=${userId} FOR SHARE`;
  const m=members[0];if(members.length!==1||m.organizationId!==s.organizationId||m.userId!==userId||!m.acceptedAt||!roles.has(m.role)||!hasDesktopCapability(m.role as DesktopWorkspaceRole,'github:read')||purpose!=='reader'&&!hasDesktopCapability(m.role as DesktopWorkspaceRole,purpose==='approver'?'agent:approve':'deploy:execute'))refuse();
  if(sessionId){const sessions=await tx.$queryRaw<Array<{id:string;organizationId:string;userId:string;live:boolean}>>`SELECT "id","organizationId","userId",("revokedAt" IS NULL AND "expiresAt" > clock_timestamp()) AS "live" FROM "DesktopSessionRecord" WHERE "id"=${sessionId} AND "organizationId"=${s.organizationId} AND "userId"=${userId} FOR SHARE`;const v=sessions[0];if(sessions.length!==1||v.id!==sessionId||v.organizationId!==s.organizationId||v.userId!==userId||v.live!==true)refuse()}
  guard();
 }
 const assertCurrent=async(tx:Tx,s:DeploymentScope,p:Readonly<DeploymentPlan>|undefined,a?:Readonly<DeploymentApproval>,purpose:'approver'|'executor'=options.actorPurpose??'executor')=>{
  await principal(s,purpose);await actor(tx,s,s.actorUserId,s.sessionId,purpose);if(!p)return;if(p.organizationId!==s.organizationId)refuse();await actor(tx,s,p.executorUserId);
  if(a){if(a.organizationId!==s.organizationId||a.executorUserId!==p.executorUserId||a.planDigest!==sha256ContentHash(p)||a.sourcePolicy!==p.sourcePolicy||[p.creatorUserId,p.requesterUserId,p.executorUserId].includes(a.approverUserId))refuse();await actor(tx,s,a.approverUserId,a.approverSessionId,'approver')}
  await principal(s,purpose);
 };
 const readCurrentPlan=async(tx:Tx,s:DeploymentScope,raw:Readonly<DeploymentPlan>)=>{
  const p=deploymentPlanSchema.parse(raw);await assertCurrent(tx,s,p);
  const cacheKey=sha256ContentHash({scope:s,plan:p}),cached=options.memoizeReadOnlyTransactionPlans?readPlans.get(tx)?.get(cacheKey):undefined;
  if(cached){await assertCurrent(tx,s,p);return structuredClone(cached)}
  const releases=await tx.$queryRaw<Array<{id:string;organizationId:string;requesterUserId:string;version:number;status:string;intakeJson:unknown}>>`SELECT "id","organizationId","requesterUserId","version","status","intakeJson" FROM "TauriDeploymentRequest" WHERE "id"=${p.releaseId} AND "organizationId"=${s.organizationId} FOR SHARE`;
  const parents=await tx.$queryRaw<Row[]>`SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${p.planId} AND "organizationId"=${s.organizationId} AND "workflowKind"=${RELEASE_OPERATION_PLAN_KIND} FOR SHARE`;
  const connections=await tx.$queryRaw<Array<{id:string;organizationId:string;status:string;githubInstallationId:string;updatedAt:Date;revokedAt:Date|null;suspendedAt:Date|null}>>`SELECT "id","organizationId","status","githubInstallationId","updatedAt","revokedAt","suspendedAt" FROM "GitHubInstallation" WHERE "id"=${p.connectionId} AND "organizationId"=${s.organizationId} FOR SHARE`;
  if(releases.length!==1||parents.length!==1||connections.length!==1)refuse();
  const release=releases[0],parent=parents[0],connection=connections[0],original=parseReleaseOperationPlanInput(parent.inputJson),review=parent.stateJson as {reviewStatus?:unknown}|null;
  if(release.id!==p.releaseId||release.organizationId!==s.organizationId||release.status!=='submitted'||release.version!==p.releaseVersion||release.requesterUserId!==p.requesterUserId||sha256ContentHash({requestVersion:release.version,intake:release.intakeJson})!==p.intakeDigest||parent.id!==p.planId||parent.organizationId!==s.organizationId||parent.workflowKind!==RELEASE_OPERATION_PLAN_KIND||parent.version!==1||parent.currentStep!=='reviewed'||parent.status!=='completed'||review?.reviewStatus!=='reviewed'||parent.requestedByUserId!==p.creatorUserId||original.releaseRequesterUserId!==p.requesterUserId||original.planDigest!==sha256ContentHash(original.plan)||releaseOperationPlanId(s.organizationId,p.releaseId,p.releaseVersion,original.planDigest)!==p.planId)refuse();
  if(parent.attemptCount!==0||parent.maxAttempts!==1||parent.leaseOwner||parent.leaseExpiresAt||parent.approvalProposalId||parent.createdAt.toISOString()!==new Date(original.createdAt).toISOString())refuse();
  const history=await tx.durableAgentWorkflowEvent.findMany({where:{workflowRunId:parent.id,organizationId:s.organizationId},orderBy:{sequence:'asc'},take:3});
  if(history.length!==2||history.some((e,n)=>e.workflowRunId!==parent.id||e.organizationId!==s.organizationId||e.sequence!==n||e.actorKind!=='user'||e.eventType!==(n?'release_plan.reviewed':'release_plan.created')||!Number.isFinite(e.occurredAt.getTime()))||history[0].actorId!==p.creatorUserId||!history[1].actorId||[p.creatorUserId,p.requesterUserId].includes(history[1].actorId)||sha256ContentHash(history[0].detailJson)!==sha256ContentHash({planDigest:original.planDigest}))refuse();
  const reviewed=z.object({actionId:z.string().uuid(),expectedVersion:z.literal(0),requestedDecision:z.literal('reviewed').optional()}).strict().safeParse(history[1].detailJson);
  if(!reviewed.success||history[1].occurredAt.getTime()<parent.createdAt.getTime()||history[1].occurredAt.getTime()>=Date.parse(original.deadlineAt))refuse();
  await actor(tx,s,history[1].actorId!,undefined,'approver');
  const merge=original.plan;
  const rebuilt=buildReleaseMergePlan(release,{organizationId:s.organizationId,requestId:p.releaseId,expectedVersion:p.releaseVersion,expectedDigest:p.intakeDigest,method:merge.method,observation:{connectionId:merge.connectionId,connectionRevision:merge.connectionRevision,repositoryFullName:merge.pullRequest.repositoryFullName,number:merge.pullRequest.number,headRepositoryFullName:merge.pullRequest.repositoryFullName,headRef:merge.pullRequest.headRef,headSha:merge.pullRequest.headSha,baseRef:merge.pullRequest.baseRef,baseSha:merge.pullRequest.baseSha,state:'open',draft:false,merged:false}});
  if(!rebuilt.ok||rebuilt.digest!==original.planDigest||merge.connectionId!==p.connectionId||merge.connectionRevision!==p.connectionRevision||merge.pullRequest.repositoryFullName!==p.repositoryFullName||connection.id!==p.connectionId||connection.organizationId!==s.organizationId||connection.status!=='active'||connection.revokedAt||connection.suspendedAt||connection.githubInstallationId!==p.installationId||connection.updatedAt.toISOString()!==p.connectionRevision)refuse();
  const parsed=parseDeploymentIntake(release.intakeJson);if(!parsed.ok) return refuse();const intake=parsed.intake,source=intake.workflowSource;if(validateIntake(intake).length)refuse();
  if(!source||source.repositoryFullName!==p.repositoryFullName||source.ref!==p.ref||source.path!==p.workflowPath||source.blobSha!==p.workflowBlobSha||!sameInputs(intake.workflowInputs,p.inputs)||p.sourcePolicy!==(options.sourcePolicy??PROTECTED_TAG_POLICY)||p.refKind!=='tag'||Date.parse(p.windowStart)<Date.parse(intake.windowStartUtc)||Date.parse(p.expiresAt)>Date.parse(intake.windowEndUtc))refuse();
  await actor(tx,s,p.creatorUserId,undefined,'reader');await actor(tx,s,p.requesterUserId,undefined,'reader');await assertCurrent(tx,s,p);if(options.memoizeReadOnlyTransactionPlans){let entries=readPlans.get(tx);if(!entries){entries=new Map();readPlans.set(tx,entries)}entries.set(cacheKey,structuredClone(p))}return structuredClone(p);
 };
 return{assertCurrent,readCurrentPlan};
}
function sameInputs(a:unknown,b:unknown){return sha256ContentHash(a)===sha256ContentHash(b)}
