import 'server-only';
import {randomUUID,createHash} from 'node:crypto';
import {githubFileReviewFromArgs} from './proposalReview';
import {githubBranchReviewFromArgs} from '@/lib/tauri/agentGithubBranchReview';
import {githubPullRequestReviewFromArgs} from '@/lib/tauri/agentGithubPullRequestReview';
import {restartWorkflowSourceFromArgs} from '@/lib/tauri/agentRestartWorkflowSource';
import {AWS_ECS_DEPLOY_WORKFLOW_FILENAME} from '@/lib/releaseops/awsEcsDeployWorkflowTemplate';
import {ALL_ENVIRONMENT_TIERS} from '@/lib/releaseops/environmentCreateResponder';
import {matchesRestartTarget,type RestartTargetReview} from './restartTargetReview';
import {readAgentDeploymentAuthoritySnapshot,agentDeploymentAuthoritySnapshotDigest} from './agentDeploymentAuthoritySnapshot';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {hasDesktopCapability,isWorkspaceAdminRole,type DesktopCapability,type DesktopWorkspaceRole} from '@/lib/desktop/desktopAuthorization';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction as Tx,ReleaseOperationPlanRow as Row} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {agentExecutionConversationHistorySchema,AGENT_ACTION_EXECUTION_KIND as KIND,AGENT_EXECUTION_TOOLS,agentExecutionScopeSchema,agentExecutionBindingSchema,agentExecutionStateSchema,agentExecutionReceiptSchema,agentActionExecutionId,readApprovedAgentReview,type AgentExecutionScope,type AgentExecutionBinding,type AgentExecutionReceipt} from './agentActionExecutionContract';
export interface AgentExecutionPorts {
 /** Trusted request/commercial authentication only; DB-only while locked.
  * Persisted role/session/review/policy checks below cannot be replaced by this port. */
 assertCurrent(tx:Tx,scope:AgentExecutionScope,purpose:'reader'|'executor',toolName?:string):Promise<void>;
}
export interface AgentExecutionClaim {readonly operationId:string}
const opId=z.string().regex(/^agent_execution_[a-f0-9]{64}$/);
const detailSchema=z.object({inputDigest:z.string(),stateDigest:z.string(),previousStateDigest:z.string().nullable()}).strict();
const roles=['owner','admin','operator','security_reviewer','finance_viewer','read_only'];
const deny=():never=>{throw Error('agent_execution_unavailable')};
type State=z.infer<typeof agentExecutionStateSchema>;
function capability(tool:string):DesktopCapability|'workspace_admin'{
 if(['create_github_branch','commit_github_file','commit_github_files','open_github_pull_request'].includes(tool))return'github:write';
 if(tool==='trigger_aws_deploy')return'deploy:execute';
 if(['create_environment','configure_deployment_target'].includes(tool))return'policy:manage';
 if(tool==='connect_identity_provider')return'workspace_admin';return deny();
}
/** Local storage only. No provider adapter, automatic retry or enrollment issuer.
 * Unknown/dispatched history remains consumed even after lease expiry. */
export function createAgentActionExecutionStore(repo:ReleaseOperationPlanRepo,ports:AgentExecutionPorts){
 const claims=new WeakMap<AgentExecutionClaim,{id:string;lease:string;scope:AgentExecutionScope}>();
 async function time(tx:Tx){const rows=await tx.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() AS "now"`;if(rows.length!==1||!(rows[0].now instanceof Date)||!Number.isFinite(rows[0].now.getTime()))deny();return rows[0].now}
 async function transaction<T>(s:AgentExecutionScope,run:(tx:Tx)=>Promise<T>){
  try{return await repo.$transaction(async tx=>{await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(s.organizationId)}))`;return run(tx)},{timeout:10000,maxWait:5000})}catch{return deny()}
 }
 async function actor(tx:Tx,s:AgentExecutionScope,purpose:'reader'|'executor',tool?:string){
  const rows=await tx.$queryRaw<Array<{organizationId:string;userId:string;role:string;acceptedAt:Date|null;sessionId:string;expiresAt:Date;revokedAt:Date|null}>>`SELECT m."organizationId",m."userId",m."role",m."acceptedAt",s."id" AS "sessionId",s."expiresAt",s."revokedAt" FROM "OrgMembership" m JOIN "DesktopSessionRecord" s ON s."organizationId"=m."organizationId" AND s."userId"=m."userId" WHERE m."organizationId"=${s.organizationId} AND m."userId"=${s.actorUserId} AND s."id"=${s.sessionId} FOR SHARE OF m,s`;
  const r=rows[0];if(rows.length!==1||!r||r.organizationId!==s.organizationId||r.userId!==s.actorUserId||r.sessionId!==s.sessionId||!(r.acceptedAt instanceof Date)||!Number.isFinite(r.acceptedAt.getTime())||!roles.includes(r.role)||!(r.expiresAt instanceof Date)||!Number.isFinite(r.expiresAt.getTime())||r.revokedAt!==null)deny();
  const required=purpose==='reader'?'workspace:read':capability(tool!);
  if(required==='workspace_admin'?!isWorkspaceAdminRole(r.role as DesktopWorkspaceRole):!hasDesktopCapability(r.role as DesktopWorkspaceRole,required))deny();
  return r;
 }
 async function request(tx:Tx,s:AgentExecutionScope,purpose:'reader'|'executor',tool?:string){
  if(typeof ports?.assertCurrent!=='function')deny();await ports.assertCurrent(tx,structuredClone(s),purpose,tool);
 }
 async function readAuthority(tx:Tx,s:AgentExecutionScope,proposalId:string){
  const proposals=await tx.$queryRaw<Array<{id:string;organizationId:string;proposedByUserId:string;decidedByUserId:string|null;toolName:string;argsJson:unknown}>>`SELECT * FROM "AgentActionProposal" WHERE "id"=${proposalId} AND "organizationId"=${s.organizationId} FOR SHARE`;
  const p=proposals[0];if(proposals.length!==1||!p||p.id!==proposalId||p.organizationId!==s.organizationId||p.proposedByUserId!==s.actorUserId||!p.decidedByUserId||p.decidedByUserId===s.actorUserId||!AGENT_EXECUTION_TOOLS.includes(p.toolName as typeof AGENT_EXECUTION_TOOLS[number]))deny();
  const audits=await tx.$queryRaw<unknown[]>`SELECT * FROM "SecureAuditRecord" WHERE "organizationId"=${s.organizationId} AND "entityRef"=${'agent_action:'+proposalId} AND "action"='approval.grant' AND "detail"->>'decisionFormat'='agent_review_only_v1' ORDER BY "occurredAt" DESC,"id" DESC LIMIT 2 FOR SHARE`;
  if(audits.length!==1)deny();
  const reviewers=await tx.$queryRaw<Array<{organizationId:string;userId:string;role:string;acceptedAt:Date|null}>>`SELECT "organizationId","userId","role","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${s.organizationId} AND "userId"=${p.decidedByUserId} FOR SHARE`,r=reviewers[0];
  if(reviewers.length!==1||!r||r.organizationId!==s.organizationId||r.userId!==p.decidedByUserId||!(r.acceptedAt instanceof Date)||!Number.isFinite(r.acceptedAt.getTime())||!roles.includes(r.role)||!hasDesktopCapability(r.role as DesktopWorkspaceRole,'agent:approve'))deny();
  const current=await actor(tx,s,'executor',p.toolName);
  const policies=await tx.$queryRaw<Array<{organizationId:string;enabled:boolean;allowedTools:unknown}>>`SELECT "organizationId","enabled","allowedTools" FROM "WorkspaceAgentIdentity" WHERE "organizationId"=${s.organizationId} FOR SHARE`,policy=policies[0];
  if(policies.length!==1||policy.organizationId!==s.organizationId||policy.enabled!==true||!Array.isArray(policy.allowedTools)||policy.allowedTools.some(v=>typeof v!=='string')||!policy.allowedTools.includes(p.toolName))deny();
  const enrollment=await tx.$queryRaw<Array<{enrolled:boolean}>>`SELECT EXISTS (SELECT 1 FROM "DurableAgentWorkflow" WHERE "organizationId"=${s.organizationId} AND ("workflowKind"='governance_baseline_active_v1' OR left("id",18)='governance_active_')) AS "enrolled"`;
  // This new executor has no registered baseline admission yet. No flag, review
  // or default numeric limit can make an enrolled or unknown scope executable.
  if(enrollment.length!==1||enrollment[0].enrolled!==false)deny();
  await request(tx,s,'executor',p.toolName);const now=await time(tx);if(current.expiresAt<=now)deny();
  const review=readApprovedAgentReview(p,audits[0],now);return{review,args:structuredClone(p.argsJson),now,sessionExpiresAt:current.expiresAt};
 }
 function unpack(row:Row){
  const binding=agentExecutionBindingSchema.parse(row.inputJson),state=agentExecutionStateSchema.parse(row.stateJson);
  if(row.workflowKind!==KIND||row.organizationId!==binding.scope.organizationId||binding.review.organizationId!==row.organizationId||binding.scope.actorUserId!==binding.review.requesterUserId||binding.review.requesterUserId===binding.review.reviewerUserId||row.requestedByUserId!==binding.scope.actorUserId||row.id!==agentActionExecutionId(row.organizationId,binding.review.proposalId,binding.review.proposalDigest)||row.currentStep!==state.state||row.maxAttempts!==1||row.approvalProposalId!==null||(row as Row&{autonomyLevel?:unknown}).autonomyLevel!=='observe'||row.createdAt.toISOString()!==binding.createdAt||row.updatedAt<row.createdAt||Date.parse(binding.review.reviewedAt)>row.createdAt.getTime()||Date.parse(binding.review.expiresAt)<=row.createdAt.getTime())deny();
  const prepared=state.state==='prepared',cancelled=state.state==='cancelled',dispatching=state.state==='dispatching';
  if(row.version!==(prepared?0:cancelled||dispatching?1:2)||row.attemptCount!==(prepared||cancelled?0:1))deny();
  if(dispatching){if(!row.leaseOwner||!z.string().uuid().safeParse(row.leaseOwner).success||!(row.leaseExpiresAt instanceof Date)||!Number.isFinite(row.leaseExpiresAt.getTime())||row.leaseExpiresAt<=row.createdAt||row.leaseExpiresAt.getTime()>Date.parse(binding.review.expiresAt)||state.receipt||row.status!=='running')deny()}
  else if(row.leaseOwner!==null||row.leaseExpiresAt!==null)deny();
  const statuses={prepared:'paused_for_input',dispatching:'running',confirmed:'completed',refused:'failed',unknown:'paused_for_input',cancelled:'cancelled'};
  if(row.status!==statuses[state.state]||((prepared||cancelled)&&state.receipt)||(!prepared&&!cancelled&&!dispatching&&state.receipt?.code!==({confirmed:'action_completed',refused:'pre_dispatch_refused',unknown:'provider_outcome_unknown'}as const)[state.state as 'confirmed'|'refused'|'unknown']))deny();
  return{row,binding,state};
 }
 async function history(tx:Tx,row:Row){
  const events=await tx.durableAgentWorkflowEvent.findMany({where:{workflowRunId:row.id,organizationId:row.organizationId},orderBy:{sequence:'asc'},take:4});
  if(events.length!==row.version+1||events.length>3)deny();
  for(let i=0;i<events.length;i++){
   const e=events[i],d=detailSchema.parse(e.detailJson),last=i===row.version;
   const expectedState=i===0?{state:'prepared'}:i===1&&row.attemptCount===1?{state:'dispatching'}:row.stateJson;
   if(d.stateDigest!==sha256ContentHash(expectedState))deny();
   if(e.workflowRunId!==row.id||e.organizationId!==row.organizationId||e.sequence!==i||e.actorKind!=='user'||e.actorId!==row.requestedByUserId||d.inputDigest!==sha256ContentHash(row.inputJson)||d.previousStateDigest!==(i===0?null:detailSchema.parse(events[i-1].detailJson).stateDigest)||e.eventType!==(KIND+'.'+(i===0?'prepared':i===1&&row.attemptCount===1?'dispatching':row.currentStep))||e.occurredAt<row.createdAt||i>0&&e.occurredAt<events[i-1].occurredAt||last&&(d.stateDigest!==sha256ContentHash(row.stateJson)||e.occurredAt.getTime()!==row.updatedAt.getTime()))deny();
  }
 }
 async function load(tx:Tx,s:AgentExecutionScope,id:string){opId.parse(id);const rows=await tx.$queryRaw<Row[]>`SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${id} AND "organizationId"=${s.organizationId} AND "workflowKind"=${KIND} FOR UPDATE`;if(rows.length!==1||rows[0].id!==id||rows[0].organizationId!==s.organizationId)deny();const value=unpack(rows[0]);if(value.binding.scope.actorUserId!==s.actorUserId)deny();await history(tx,rows[0]);return value}
 async function event(tx:Tx,row:Row,previous:string|null){await tx.durableAgentWorkflowEvent.create({data:{workflowRunId:row.id,organizationId:row.organizationId,sequence:row.version,eventType:KIND+'.'+row.currentStep,actorKind:'user',actorId:row.requestedByUserId,detailJson:{inputDigest:sha256ContentHash(row.inputJson),stateDigest:sha256ContentHash(row.stateJson),previousStateDigest:previous},occurredAt:row.updatedAt}})}
 function dto(v:ReturnType<typeof unpack>,observedAt:Date){
  const recoveryState=v.state.state==='dispatching'?(v.row.leaseExpiresAt!<=observedAt?'lease_elapsed_unconfirmed':'dispatch_unconfirmed'):v.state.state==='prepared'?'not_started':v.state.state;
  return{recoveryState,observedAt:observedAt.toISOString(),id:v.row.id,proposalId:v.binding.review.proposalId,toolName:v.binding.review.toolName,state:v.state.state,version:v.row.version,attemptCount:v.row.attemptCount,createdAt:v.binding.createdAt,expiresAt:v.binding.review.expiresAt,...(v.state.receipt?{receipt:v.state.receipt}:{})}}
 async function update(tx:Tx,v:ReturnType<typeof unpack>,state:State,now:Date,lease?:string){
  const status={prepared:'paused_for_input',dispatching:'running',confirmed:'completed',refused:'failed',unknown:'paused_for_input',cancelled:'cancelled'}[state.state];
  const data={stateJson:state,currentStep:state.state,status,version:{increment:1},attemptCount:state.state==='dispatching'?1:v.row.attemptCount,leaseOwner:lease??null,leaseExpiresAt:lease?new Date(Math.min(now.getTime()+30000,Date.parse(v.binding.review.expiresAt))):null,updatedAt:now};
  const changed=await tx.durableAgentWorkflow.updateMany({where:{id:v.row.id,organizationId:v.row.organizationId,workflowKind:KIND,version:v.row.version,attemptCount:v.row.attemptCount,inputJson:{equals:v.row.inputJson},stateJson:{equals:v.row.stateJson},leaseOwner:v.row.leaseOwner},data});if(changed.count!==1)deny();
  const next={...v.row,...data,version:v.row.version+1};await event(tx,next,sha256ContentHash(v.row.stateJson));return unpack(next);
 }
 function privateClaim(proof:AgentExecutionClaim){const c=claims.get(proof);if(!c||proof.operationId!==c.id)return deny();return c}
 async function claimedDeploymentAuthorityLocked(tx:Tx,s:AgentExecutionScope,proof:AgentExecutionClaim,connection:{id:string;githubInstallationId:string;updatedAt:Date},input:{target:RestartTargetReview;policySnapshotDigest?:string;sourceCommitSha?:string}){
  const observedWall=Date.now();if(!Number.isFinite(observedWall))deny();
  const c=privateClaim(proof);if(sha256ContentHash(s)!==sha256ContentHash(c.scope))deny();
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(s.organizationId)}))`;
    const v=await load(tx,s,c.id);if(v.state.state!=='dispatching'||v.row.leaseOwner!==c.lease||v.binding.review.toolName!=='trigger_aws_deploy')deny();
    const current=await readAuthority(tx,s,v.binding.review.proposalId);
    if(sha256ContentHash(current.review)!==sha256ContentHash(v.binding.review))deny();
    const args=z.record(z.string(),z.unknown()).parse(current.args),environmentId=z.string().min(1).max(240).parse(args.environmentId);
    const targets=await tx.$queryRaw<Array<{environmentId:string;environmentOrganizationId:string;environmentTier:string;id:string;organizationId:string;provider:string;updatedAt:Date;roleArn:string;region:string;ecsCluster:string;ecsService:string}>>`SELECT e."id" AS "environmentId",e."organizationId" AS "environmentOrganizationId",e."tier" AS "environmentTier",t."id",t."organizationId",t."provider",t."updatedAt",t."roleArn",t."region",t."ecsCluster",t."ecsService" FROM "Environment" e JOIN "DeploymentTarget" t ON t."environmentId"=e."id" WHERE e."id"=${environmentId} AND e."organizationId"=${s.organizationId} FOR SHARE OF e,t`;
    const targetRow=targets[0];
    if(targets.length!==1||targetRow.environmentId!==environmentId||targetRow.environmentOrganizationId!==s.organizationId||targetRow.organizationId!==s.organizationId||targetRow.provider!=='aws'||!z.enum(ALL_ENVIRONMENT_TIERS).safeParse(targetRow.environmentTier).success||!(targetRow.updatedAt instanceof Date)||!Number.isFinite(targetRow.updatedAt.getTime()))deny();
    const target:RestartTargetReview={kind:'ecs_restart_target',organizationId:s.organizationId,environmentId,environmentTier:targetRow.environmentTier,targetId:targetRow.id,provider:'aws',targetUpdatedAt:targetRow.updatedAt.toISOString(),roleArn:targetRow.roleArn,region:targetRow.region,ecsCluster:targetRow.ecsCluster,ecsService:targetRow.ecsService};
    if(!matchesRestartTarget(args._review,target)||!matchesRestartTarget(input.target,target))deny();
    if(input.policySnapshotDigest!==undefined&&await readAgentDeploymentAuthoritySnapshot(tx,s.organizationId,environmentId)!==input.policySnapshotDigest)deny();
    if(input.policySnapshotDigest!==undefined){
    const reservations=await tx.$queryRaw<Array<{environmentId:string;repositoryFullName:string;sourceRef:string|null;sourceKind:string|null;sourceCommitSha:string|null;source:string;triggeredByUserId:string;status:string}>>`SELECT "environmentId","repositoryFullName","sourceRef","sourceKind","sourceCommitSha","source","triggeredByUserId","status" FROM "DeploymentExecution" WHERE "organizationId"=${s.organizationId} AND "idempotencyKey"=${c.id} FOR SHARE`;
    const reservation=reservations[0],sourceRef=typeof args.sourceRef==='string'?args.sourceRef.trim():'main',sourceKind=args.sourceKind===undefined?'branch':args.sourceKind;
    if(reservations.length!==1||reservation.environmentId!==environmentId||reservation.repositoryFullName!==args.repositoryFullName||reservation.sourceRef!==sourceRef||reservation.sourceKind!==sourceKind||reservation.sourceCommitSha!==input.sourceCommitSha||reservation.source!=='agent'||reservation.triggeredByUserId!==s.actorUserId||reservation.status!=='reserved')deny();
    }
    const rows=await tx.$queryRaw<Array<{id:string;githubInstallationId:string;updatedAt:Date;revokedAt:Date|null;suspendedAt:Date|null;status:string;now:Date;sessionLive:boolean;policySnapshot:unknown}>>`SELECT i."id",i."githubInstallationId",i."updatedAt",i."revokedAt",i."suspendedAt",i."status",jsonb_build_object('repositories',(SELECT COALESCE(jsonb_agg(to_jsonb(sr)),'[]'::jsonb) FROM (SELECT "id","organizationId","provider","remoteOwner","remoteName" FROM "Repository" WHERE "organizationId"=${s.organizationId} AND "provider"='github' ORDER BY "id" LIMIT 2001) sr),'policies',(SELECT COALESCE(jsonb_agg(to_jsonb(sp)),'[]'::jsonb) FROM (SELECT p."id",p."organizationId",p."repositoryId",p."environmentId",p."enabled",p."branchPattern",p."requireReleaseTag",p."requireCodeowners",p."requirePrLink",p."requireChangeTicket",p."requirePromotionFromEnvironmentId",p."requireTestsPassing",p."priority" FROM "BranchEnvironmentPolicy" p JOIN "Repository" r ON r."id"=p."repositoryId" AND r."organizationId"=p."organizationId" WHERE p."organizationId"=${s.organizationId} AND p."environmentId"=${environmentId} AND p."enabled"=true AND r."provider"='github' ORDER BY p."id" LIMIT 2001) sp)) AS "policySnapshot",clock_timestamp() AS "now",(s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp()) AS "sessionLive"
     FROM "GitHubInstallation" i JOIN "DesktopSessionRecord" s ON s."organizationId"=i."organizationId"
     WHERE i."organizationId"=${s.organizationId} AND i."id"=${connection.id} AND s."id"=${s.sessionId} AND s."userId"=${s.actorUserId}
     AND i."id"=(SELECT latest."id" FROM "GitHubInstallation" latest WHERE latest."organizationId"=${s.organizationId} AND latest."status"='active' ORDER BY latest."installedAt" DESC LIMIT 1) FOR SHARE OF i,s`;
    const row=rows[0];
    if(rows.length!==1||row.id!==connection.id||row.githubInstallationId!==connection.githubInstallationId||!(row.updatedAt instanceof Date)||row.updatedAt.getTime()!==connection.updatedAt.getTime()||row.status!=='active'||row.revokedAt!==null||row.suspendedAt!==null||row.sessionLive!==true||!(row.now instanceof Date)||!Number.isFinite(row.now.getTime())||!v.row.leaseExpiresAt||v.row.leaseExpiresAt<=row.now||Date.parse(current.review.expiresAt)<=row.now.getTime())deny();
    if(input.policySnapshotDigest!==undefined&&agentDeploymentAuthoritySnapshotDigest(s.organizationId,environmentId,row.policySnapshot)!==input.policySnapshotDigest)deny();
    const source={toolName:current.review.toolName,args:current.args,proposalDigest:current.review.proposalDigest,reviewId:current.review.reviewId};
    const remaining=Math.min(v.row.leaseExpiresAt!.getTime(),Date.parse(current.review.expiresAt),current.sessionExpiresAt.getTime())-row.now.getTime();
    const fresh=()=>{const elapsed=Date.now()-observedWall;if(claims.get(proof)!==c||!Number.isFinite(elapsed)||!Number.isFinite(remaining)||elapsed<0||elapsed>=remaining)deny()};fresh();
    return{source,fresh,review:current.review,lease:c.lease,attemptCount:v.row.attemptCount,target};
 }

 return{
  async conversationHistory(raw:AgentExecutionScope,conversationId:string){
   const s=agentExecutionScopeSchema.parse(raw),conversation=z.string().min(1).max(240).parse(conversationId);
   return transaction(s,async tx=>{
    const a=await actor(tx,s,'reader');await request(tx,s,'reader');
    const owners=await tx.$queryRaw<Array<{id:string;organizationId:string;userId:string}>>`SELECT "id","organizationId","userId" FROM "AgentConversation" WHERE "id"=${conversation} AND "organizationId"=${s.organizationId} AND "userId"=${s.actorUserId} FOR SHARE`;
    if(owners.length!==1||owners[0].id!==conversation||owners[0].organizationId!==s.organizationId||owners[0].userId!==s.actorUserId)deny();
    const rows=await tx.durableAgentWorkflow.findMany({where:{organizationId:s.organizationId,workflowKind:KIND,requestedByUserId:s.actorUserId,inputJson:{path:['review','conversationId'],equals:conversation}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:6});
    const values=[];for(const row of rows.slice(0,5)){const value=await load(tx,s,row.id);if(value.binding.review.conversationId!==conversation||value.binding.review.requesterUserId!==s.actorUserId)deny();values.push(value)}
    const now=await time(tx);if(a.expiresAt<=now)deny();
    return agentExecutionConversationHistorySchema.parse({operations:values.map(value=>dto(value,now)),truncated:rows.length>5,observedAt:now.toISOString()});
   });
  },
  async lookup(raw:AgentExecutionScope,proposalId:string){const s=agentExecutionScopeSchema.parse(raw);z.string().min(1).max(240).parse(proposalId);return transaction(s,async tx=>{
   const a=await actor(tx,s,'reader');await request(tx,s,'reader');
   const rows=await tx.durableAgentWorkflow.findMany({where:{organizationId:s.organizationId,workflowKind:KIND,requestedByUserId:s.actorUserId,inputJson:{path:['review','proposalId'],equals:proposalId}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:2});
   if(rows.length>1)deny();
   const value=rows.length?await load(tx,s,rows[0].id):null;
   if(value&&value.binding.review.proposalId!==proposalId)deny();
   const now=await time(tx);if(a.expiresAt<=now)deny();return value?dto(value,now):null;
  })},
  async prepare(raw:AgentExecutionScope,proposalId:string){const s=agentExecutionScopeSchema.parse(raw);return transaction(s,async tx=>{
   const authority=await readAuthority(tx,s,z.string().min(1).max(240).parse(proposalId)),id=agentActionExecutionId(s.organizationId,proposalId,authority.review.proposalDigest);
   const existing=await tx.durableAgentWorkflow.findFirst({where:{id,organizationId:s.organizationId,workflowKind:KIND}});
   if(existing){const v=await load(tx,s,id);if(v.binding.scope.sessionId!==s.sessionId||sha256ContentHash(v.binding.review)!==sha256ContentHash(authority.review))deny();return dto(v,authority.now)}
   const binding=agentExecutionBindingSchema.parse({format:1,scope:s,review:authority.review,createdAt:authority.now.toISOString()}),state={state:'prepared' as const};
   const row=await tx.durableAgentWorkflow.create({data:{id,organizationId:s.organizationId,workflowKind:KIND,objective:'One separately reviewed requester Agent action',status:'paused_for_input',autonomyLevel:'observe',currentStep:'prepared',inputJson:binding,stateJson:state,requestedByUserId:s.actorUserId,attemptCount:0,maxAttempts:1,version:0,leaseOwner:null,leaseExpiresAt:null,approvalProposalId:null,nextAttemptAt:null,createdAt:authority.now,updatedAt:authority.now}});
   await event(tx,row,null);return dto(unpack(row),authority.now);
  })},
  async get(raw:AgentExecutionScope,id:string){const s=agentExecutionScopeSchema.parse(raw);return transaction(s,async tx=>{const v=await load(tx,s,id),a=await actor(tx,s,'reader');await request(tx,s,'reader');const now=await time(tx);if(a.expiresAt<=now)deny();return dto(v,now)})},
  /** Advisory server metadata only; no preparation, claim or permission grant. */
  async readExecutionReadiness(raw:AgentExecutionScope,proposalId:string){const s=agentExecutionScopeSchema.parse(raw);return transaction(s,async tx=>{
   const current=await readAuthority(tx,s,z.string().min(1).max(240).parse(proposalId));
   const id=agentActionExecutionId(s.organizationId,proposalId,current.review.proposalDigest);
   const existing=await tx.durableAgentWorkflow.findFirst({where:{id,organizationId:s.organizationId,workflowKind:KIND}});
   const value=existing?await load(tx,s,id):null;
   if(value&&sha256ContentHash(value.binding.review)!==sha256ContentHash(current.review))deny();
   return{source:{toolName:current.review.toolName,args:structuredClone(current.args),proposalDigest:current.review.proposalDigest,reviewId:current.review.reviewId},expiresAt:current.review.expiresAt,operation:value?dto(value,current.now):null,sessionMatches:!value||value.binding.scope.sessionId===s.sessionId};
  })},
  async inspectForExecution(raw:AgentExecutionScope,id:string){const s=agentExecutionScopeSchema.parse(raw);return transaction(s,async tx=>{
   const v=await load(tx,s,id);if(v.state.state!=='prepared'||v.binding.scope.sessionId!==s.sessionId)deny();
   const current=await readAuthority(tx,s,v.binding.review.proposalId);
   if(sha256ContentHash(current.review)!==sha256ContentHash(v.binding.review))deny();
   return Object.freeze({toolName:current.review.toolName,args:structuredClone(current.args),proposalDigest:current.review.proposalDigest,reviewId:current.review.reviewId});
  })},
  async claim(raw:AgentExecutionScope,id:string){const s=agentExecutionScopeSchema.parse(raw);return transaction(s,async tx=>{
   const v=await load(tx,s,id);if(v.binding.scope.sessionId!==s.sessionId)deny();
   if(v.state.state!=='prepared'){const a=await actor(tx,s,'reader');await request(tx,s,'reader');const now=await time(tx);if(a.expiresAt<=now)deny();return{claimed:false as const,operation:dto(v,now)}}
   const current=await readAuthority(tx,s,v.binding.review.proposalId);if(sha256ContentHash(current.review)!==sha256ContentHash(v.binding.review))deny();
   const lease=randomUUID(),next=await update(tx,v,{state:'dispatching'},current.now,lease),proof=Object.freeze({operationId:id});claims.set(proof,{id,lease,scope:structuredClone(s)});
   return{claimed:true as const,operation:dto(next,current.now),claim:proof};
  })},
  async beforeDispatch(raw:AgentExecutionScope,proof:AgentExecutionClaim){const s=agentExecutionScopeSchema.parse(raw),c=privateClaim(proof);if(sha256ContentHash(s)!==sha256ContentHash(c.scope))deny();return transaction(s,async tx=>{
   const v=await load(tx,s,c.id);if(v.state.state!=='dispatching'||v.row.leaseOwner!==c.lease)deny();const current=await readAuthority(tx,s,v.binding.review.proposalId);
   if(sha256ContentHash(current.review)!==sha256ContentHash(v.binding.review)||!v.row.leaseExpiresAt||v.row.leaseExpiresAt<=current.now)deny();
   return{toolName:current.review.toolName,args:current.args,proposalDigest:current.review.proposalDigest,reviewId:current.review.reviewId};
  })},
  /** Last server authority await before a GitHub mutation. Source/reviewer/
   * requester/policy rows remain locked while the pinned installation is checked.
   * The external provider write is necessarily outside this transaction. */
  async beforeGithubDispatch(raw:AgentExecutionScope,proof:AgentExecutionClaim,rawConnection:{id:string;githubInstallationId:string;updatedAt:Date}){
   const s=agentExecutionScopeSchema.parse(raw),c=privateClaim(proof);
   const connection=z.object({id:z.string().min(1).max(240),githubInstallationId:z.string().regex(/^[1-9][0-9]*$/),updatedAt:z.date()}).strict().parse(rawConnection);
   if(sha256ContentHash(s)!==sha256ContentHash(c.scope))deny();
   return transaction(s,async tx=>{
    const v=await load(tx,s,c.id);
    if(v.state.state!=='dispatching'||v.row.leaseOwner!==c.lease||!['create_github_branch','commit_github_file','commit_github_files','open_github_pull_request'].includes(v.binding.review.toolName))deny();
    const current=await readAuthority(tx,s,v.binding.review.proposalId);
    if(sha256ContentHash(current.review)!==sha256ContentHash(v.binding.review))deny();
    const rows=await tx.$queryRaw<Array<{id:string;githubInstallationId:string;updatedAt:Date;revokedAt:Date|null;suspendedAt:Date|null;status:string;now:Date;sessionLive:boolean}>>`SELECT i."id",i."githubInstallationId",i."updatedAt",i."revokedAt",i."suspendedAt",i."status",clock_timestamp() AS "now",(s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp()) AS "sessionLive"
     FROM "GitHubInstallation" i JOIN "DesktopSessionRecord" s ON s."organizationId"=i."organizationId"
     WHERE i."organizationId"=${s.organizationId} AND i."id"=${connection.id} AND s."id"=${s.sessionId} AND s."userId"=${s.actorUserId}
     AND i."id"=(SELECT latest."id" FROM "GitHubInstallation" latest WHERE latest."organizationId"=${s.organizationId} AND latest."status"='active' ORDER BY latest."installedAt" DESC LIMIT 1) FOR SHARE OF i,s`;
    const row=rows[0];
    if(rows.length!==1||row.id!==connection.id||row.githubInstallationId!==connection.githubInstallationId||!(row.updatedAt instanceof Date)||row.updatedAt.getTime()!==connection.updatedAt.getTime()||row.status!=='active'||row.revokedAt!==null||row.suspendedAt!==null||row.sessionLive!==true||!(row.now instanceof Date)||!Number.isFinite(row.now.getTime())||!v.row.leaseExpiresAt||v.row.leaseExpiresAt<=row.now||Date.parse(current.review.expiresAt)<=row.now.getTime())deny();
    return{toolName:current.review.toolName,args:current.args,proposalDigest:current.review.proposalDigest,reviewId:current.review.reviewId};
   });
  },
  /** Exact source metadata for ONLY the single-effect branch, file and PR profiles.
   * The caller owns the existing org-first transaction; no provider I/O. */
  async readClaimedGithubOutboundLocked(tx:Tx,raw:AgentExecutionScope,proof:AgentExecutionClaim,input:{source:{toolName:string;args:unknown;proposalDigest:string;reviewId:string};connection:{id:string;githubInstallationId:string;updatedAt:Date}}){
   const wall=Date.now();if(!Number.isFinite(wall))deny();
   const s=agentExecutionScopeSchema.parse(raw),c=privateClaim(proof),connection=z.object({id:z.string().min(1).max(240),githubInstallationId:z.string().regex(/^[1-9][0-9]*$/),updatedAt:z.date()}).strict().parse(input.connection);
   if(sha256ContentHash(s)!==sha256ContentHash(c.scope))deny();
   await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(s.organizationId)}))`;
   const v=await load(tx,s,c.id);if(v.state.state!=='dispatching'||v.row.leaseOwner!==c.lease||!['create_github_branch','open_github_pull_request','commit_github_file'].includes(v.binding.review.toolName))deny();
   const current=await readAuthority(tx,s,v.binding.review.proposalId);if(sha256ContentHash(current.review)!==sha256ContentHash(v.binding.review))deny();
   const source={toolName:current.review.toolName,args:current.args,proposalDigest:current.review.proposalDigest,reviewId:current.review.reviewId};if(sha256ContentHash(source)!==sha256ContentHash(input.source))deny();
   const args=z.record(z.string(),z.unknown()).parse(current.args),repositoryFullName=z.string().min(1).max(240).parse(args.repositoryFullName);
   const branch=source.toolName==='create_github_branch'?githubBranchReviewFromArgs(args):null,pr=source.toolName==='open_github_pull_request'?githubPullRequestReviewFromArgs(args):null;
   const file=source.toolName==='commit_github_file'?githubFileReviewFromArgs(args):null;
   if(!branch&&!pr&&!file)deny();
   const target=file?{repositoryFullName,branch:z.string().min(1).max(240).parse(args.branch),path:z.string().min(1).max(240).parse(args.path),review:file,contentSha256:createHash('sha256').update(z.string().parse(args.content),'utf8').digest('hex'),messageDigest:sha256ContentHash(z.string().parse(args.message))}:branch?{repositoryFullName,review:branch}:{repositoryFullName,review:pr,title:z.string().min(1).max(10000).parse(args.title),bodyDigest:sha256ContentHash(typeof args.body==='string'?args.body:'')};
   const rows=await tx.$queryRaw<Array<{id:string;githubInstallationId:string;updatedAt:Date;revokedAt:Date|null;suspendedAt:Date|null;status:string;now:Date;sessionLive:boolean}>>`SELECT i."id",i."githubInstallationId",i."updatedAt",i."revokedAt",i."suspendedAt",i."status",clock_timestamp() AS "now",(s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp()) AS "sessionLive"
    FROM "GitHubInstallation" i JOIN "DesktopSessionRecord" s ON s."organizationId"=i."organizationId"
    WHERE i."organizationId"=${s.organizationId} AND i."id"=${connection.id} AND s."id"=${s.sessionId} AND s."userId"=${s.actorUserId}
    AND i."id"=(SELECT latest."id" FROM "GitHubInstallation" latest WHERE latest."organizationId"=${s.organizationId} AND latest."status"='active' ORDER BY latest."installedAt" DESC LIMIT 1) FOR SHARE OF i,s`;
   const row=rows[0];if(rows.length!==1||row.id!==connection.id||row.githubInstallationId!==connection.githubInstallationId||!(row.updatedAt instanceof Date)||row.updatedAt.getTime()!==connection.updatedAt.getTime()||row.status!=='active'||row.revokedAt!==null||row.suspendedAt!==null||row.sessionLive!==true||!(row.now instanceof Date)||!Number.isFinite(row.now.getTime())||!v.row.leaseExpiresAt||v.row.leaseExpiresAt<=row.now||Date.parse(current.review.expiresAt)<=row.now.getTime())deny();
   const remaining=Math.min(v.row.leaseExpiresAt!.getTime(),Date.parse(current.review.expiresAt),current.sessionExpiresAt.getTime())-row.now.getTime();
   const fresh=()=>{const elapsed=Date.now()-wall;if(claims.get(proof)!==c||!Number.isFinite(elapsed)||!Number.isFinite(remaining)||elapsed<0||elapsed>=remaining)deny()};fresh();
   return{fresh,profile:source.toolName==='create_github_branch'?'agent.github_create_branch.v1':source.toolName==='commit_github_file'?'agent.github_commit_file.v1':'agent.github_open_pull_request.v1',attemptId:'agent_execution_attempt_'+sha256ContentHash({operationId:proof.operationId,attemptCount:v.row.attemptCount,lease:c.lease}),sourceDigest:sha256ContentHash({review:current.review,args}),targetDigest:sha256ContentHash(target),connectionId:connection.id};
  },
  /** Final ECS authority: no provider reads in this transaction. The provider
   * reference is still symbolic; this is not immutable release admission. */
  async beforeDeploymentDispatch(raw:AgentExecutionScope,proof:AgentExecutionClaim,rawConnection:{id:string;githubInstallationId:string;updatedAt:Date},input:{target:RestartTargetReview;policySnapshotDigest:string;sourceCommitSha:string}){
   const s=agentExecutionScopeSchema.parse(raw),connection=z.object({id:z.string().min(1).max(240),githubInstallationId:z.string().regex(/^[1-9][0-9]*$/),updatedAt:z.date()}).strict().parse(rawConnection);
   z.string().regex(/^[a-f0-9]{64}$/).parse(input.policySnapshotDigest);z.string().regex(/^[a-f0-9]{40}$/).parse(input.sourceCommitSha);
   return transaction(s,async tx=>(await claimedDeploymentAuthorityLocked(tx,s,proof,connection,input)).source);
  },
  /** Caller already owns the org-first transaction. No nested transaction or
   * provider read; the private claim and original review remain mandatory. */
  async readClaimedDeploymentOutboundLocked(tx:Tx,raw:AgentExecutionScope,proof:AgentExecutionClaim,input:{source:{toolName:string;args:unknown;proposalDigest:string;reviewId:string};connection:{id:string;githubInstallationId:string;updatedAt:Date};target:RestartTargetReview;policySnapshotDigest?:string;sourceCommitSha?:string}){
   const s=agentExecutionScopeSchema.parse(raw),connection=z.object({id:z.string().min(1).max(240),githubInstallationId:z.string().regex(/^[1-9][0-9]*$/),updatedAt:z.date()}).strict().parse(input.connection);
   if(input.policySnapshotDigest!==undefined){z.string().regex(/^[a-f0-9]{64}$/).parse(input.policySnapshotDigest);z.string().regex(/^[a-f0-9]{40}$/).parse(input.sourceCommitSha)}
   const checked=await claimedDeploymentAuthorityLocked(tx,s,proof,connection,input);
   if(sha256ContentHash(checked.source)!==sha256ContentHash(input.source))deny();
   const args=z.record(z.string(),z.unknown()).parse(checked.source.args),reviewed=restartWorkflowSourceFromArgs(args);
   if(!reviewed)return deny();
   if(reviewed.repositoryFullName!==args.repositoryFullName||reviewed.workflowFile!==AWS_ECS_DEPLOY_WORKFLOW_FILENAME||input.sourceCommitSha!==undefined&&input.sourceCommitSha!==reviewed.sourceCommitSha)deny();
   return{fresh:checked.fresh,attemptId:'agent_execution_attempt_'+sha256ContentHash({operationId:proof.operationId,attemptCount:checked.attemptCount,lease:checked.lease}),sourceDigest:sha256ContentHash({review:checked.review,args}),targetDigest:sha256ContentHash({repositoryFullName:reviewed.repositoryFullName,workflowFile:reviewed.workflowFile,ref:reviewed.ref,inputs:{role_arn:checked.target.roleArn,region:checked.target.region,cluster:checked.target.ecsCluster,service:checked.target.ecsService},target:checked.target}),connectionId:connection.id};
  },
  /** Trusted DB-only fixed mutator. Never use a provider adapter in this callback.
   * Mutation and recorded outcome commit together; ambiguous transaction failures
   * leave the claimed operation consumed for read-only recovery, never retry. */
  async applyDatabase(proof:AgentExecutionClaim,write:(tx:Tx,source:{toolName:string;args:Record<string,unknown>})=>Promise<AgentExecutionReceipt>){
   const c=privateClaim(proof);
   // A database apply is itself single-use, including rollback or lost commit
   // responses. Do not let the worker replay a still-live in-memory proof.
   claims.delete(proof);
   const result=await transaction(c.scope,async tx=>{
    const v=await load(tx,c.scope,c.id);
    if(v.state.state!=='dispatching'||v.row.leaseOwner!==c.lease||!['create_environment','configure_deployment_target','connect_identity_provider'].includes(v.binding.review.toolName)||typeof write!=='function')deny();
    const current=await readAuthority(tx,c.scope,v.binding.review.proposalId);
    if(sha256ContentHash(current.review)!==sha256ContentHash(v.binding.review)||!v.row.leaseExpiresAt||v.row.leaseExpiresAt<=current.now)deny();
    const receipt=agentExecutionReceiptSchema.parse(await write(tx,{toolName:current.review.toolName,args:z.record(z.string(),z.unknown()).parse(structuredClone(current.args))}));
    if(receipt.code!=='action_completed')deny();
    const final=await readAuthority(tx,c.scope,v.binding.review.proposalId);
    if(sha256ContentHash(final.review)!==sha256ContentHash(v.binding.review)||!v.row.leaseExpiresAt||v.row.leaseExpiresAt<=final.now)deny();
    return dto(await update(tx,v,{state:'confirmed',receipt},final.now),final.now);
   });
   claims.delete(proof);return result;
  },
  async complete(proof:AgentExecutionClaim,outcome:'confirmed'|'refused'|'unknown',rawReceipt:AgentExecutionReceipt){
   const c=privateClaim(proof),receipt=agentExecutionReceiptSchema.parse(rawReceipt);if(!['confirmed','refused','unknown'].includes(outcome)||receipt.code!==({confirmed:'action_completed',refused:'pre_dispatch_refused',unknown:'provider_outcome_unknown'}as const)[outcome])deny();
   const result=await transaction(c.scope,async tx=>{const v=await load(tx,c.scope,c.id);if(v.state.state!=='dispatching'||v.row.leaseOwner!==c.lease)deny();const now=await time(tx);return dto(await update(tx,v,{state:outcome,receipt},now),now)});claims.delete(proof);return result;
  },
  async cancel(raw:AgentExecutionScope,id:string){const s=agentExecutionScopeSchema.parse(raw);return transaction(s,async tx=>{const v=await load(tx,s,id),a=await actor(tx,s,'reader');await request(tx,s,'reader');const now=await time(tx);if(a.expiresAt<=now||v.state.state!=='prepared')deny();return dto(await update(tx,v,{state:'cancelled'},now),now)})},
 };
}
