import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from './contentHash';
import {deploymentScopeSchema,deploymentPlanSchema,deploymentApprovalSchema,type DeploymentPlan,type DeploymentScope,type DeploymentApproval} from './releaseDeploymentExecutionContract';
import {releaseDeploymentExecutionId} from './releaseDeploymentExecutionStore';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction as Tx,ReleaseOperationPlanRow as Row} from '@/lib/agent/workflows/releaseOperationPlanStore';
export const RELEASE_DEPLOYMENT_APPROVAL_KIND='release_deployment_approval_v1';
const stateSchema=z.discriminatedUnion('status',[z.object({status:z.literal('approved')}).strict(),z.object({status:z.literal('consumed'),operationId:z.string()}).strict(),z.object({status:z.literal('revoked')}).strict()]);
const bindingSchema=z.object({format:z.literal(1),plan:deploymentPlanSchema,approval:deploymentApprovalSchema,clientRequestId:z.string().uuid(),createdAt:z.string().datetime()}).strict();
const same=(a:unknown,b:unknown)=>sha256ContentHash(a)===sha256ContentHash(b);
const refuse=():never=>{throw Error('release_deployment_approval_unavailable')};
export interface ReleaseDeploymentApprovalDependencies {
 /** Must lock/revalidate actual caller and original reviewer/session/capabilities.
  * No client role flags or substitution of simulation/merge approvals. */
 assertCurrent?:(tx:Tx,scope:DeploymentScope,plan:Readonly<DeploymentPlan>,approval:Readonly<DeploymentApproval>|undefined,role:'approver'|'executor')=>Promise<void>;
 readCurrentPlan?:(tx:Tx,scope:DeploymentScope,plan:Readonly<DeploymentPlan>)=>Promise<unknown>;
 /** DB-only current baseline/source proof using this transaction; sources must
  * be warmed outside locks. A digest is never authority without this verifier. */
 assertGovernanceBaseline?:(tx:Tx,scope:DeploymentScope,baselineDigest:string,plan:Readonly<DeploymentPlan>)=>Promise<void>;
 now?:()=>Date;
}
export const releaseDeploymentApprovalId=(p:DeploymentPlan)=>'release_deploy_approval_'+sha256ContentHash({organizationId:p.organizationId,planDigest:sha256ContentHash(p),executorUserId:p.executorUserId});
/** Genuine separately issued deployment-purpose approval; no network or dispatch. */
export function createReleaseDeploymentApprovalStore(repo:ReleaseOperationPlanRepo,deps:ReleaseDeploymentApprovalDependencies={}){
 const now=()=>{const d=new Date((deps.now?.()??new Date()).getTime());if(!Number.isFinite(d.getTime()))refuse();return d};
 const ready=()=>{if(!deps.assertCurrent||!deps.readCurrentPlan)refuse()};
 const independent=(p:DeploymentPlan,a:DeploymentApproval)=>{if(a.kind!=='verified_release_deployment_approval_v1'||a.purpose!=='release_deployment'||a.organizationId!==p.organizationId||a.planDigest!==sha256ContentHash(p)||a.executorUserId!==p.executorUserId||a.sourcePolicy!==p.sourcePolicy||[p.creatorUserId,p.requesterUserId,p.executorUserId].includes(a.approverUserId)||a.id!==releaseDeploymentApprovalId(p)||Date.parse(a.expiresAt)>Date.parse(p.expiresAt))refuse()};
 async function authority(tx:Tx,s:DeploymentScope,p:DeploymentPlan,a:DeploymentApproval|undefined,role:'approver'|'executor'){
  ready();if(s.organizationId!==p.organizationId||role==='executor'&&s.actorUserId!==p.executorUserId||role==='approver'&&[p.creatorUserId,p.requesterUserId,p.executorUserId].includes(s.actorUserId))refuse();
  await deps.assertCurrent!(tx,structuredClone(s),structuredClone(p),a&&structuredClone(a),role);
 }
 async function baseline(tx:Tx,s:DeploymentScope,p:DeploymentPlan,a:DeploymentApproval){
  if(a.governanceBaselineDigest){if(!deps.assertGovernanceBaseline)refuse();await deps.assertGovernanceBaseline!(tx,structuredClone(s),a.governanceBaselineDigest,structuredClone(p))}
 }
 const auditDetail=(b:z.infer<typeof bindingSchema>)=>({planDigest:b.approval.planDigest,purpose:'release_deployment',...(b.approval.governanceBaselineDigest?{bindingDigest:sha256ContentHash(b)}:{})});
 async function current(tx:Tx,s:DeploymentScope,p:DeploymentPlan,a:DeploymentApproval,role:'approver'|'executor'){
  independent(p,a);await authority(tx,s,p,a,role);await baseline(tx,s,p,a);
  if(!same(deploymentPlanSchema.parse(await deps.readCurrentPlan!(tx,s,structuredClone(p))),p))refuse();
  const end=new Date(a.expiresAt);if(now()>=end)refuse();
  await authority(tx,s,p,a,role);await baseline(tx,s,p,a);
  // Authority/source locks can wait beyond expiry. The database clock must be
  // the final awaited check, with the application clock checked again after it.
  const clock=await tx.$queryRaw<Array<{live:boolean}>>`SELECT clock_timestamp() < ${end} AS "live"`;
  if(clock.length!==1||clock[0].live!==true||now()>=end)refuse();
 }
 function unpack(row:Row,s:DeploymentScope){
  const b=bindingSchema.parse(row.inputJson),state=stateSchema.parse(row.stateJson);independent(b.plan,b.approval);
  if(row.id!==b.approval.id||row.organizationId!==s.organizationId||row.workflowKind!==RELEASE_DEPLOYMENT_APPROVAL_KIND||row.requestedByUserId!==b.approval.approverUserId||row.attemptCount!==0||row.maxAttempts!==1||row.leaseOwner||row.leaseExpiresAt||row.approvalProposalId||row.currentStep!==state.status||row.version!==(state.status==='approved'?0:1)||row.status!==(state.status==='approved'?'paused_for_input':state.status==='revoked'?'cancelled':'completed')||row.createdAt.toISOString()!==b.createdAt||state.status==='consumed'&&state.operationId!==releaseDeploymentExecutionId(b.plan))refuse();
  return{b,state};
 }
 async function load(tx:Tx,s:DeploymentScope,id:string){
  if(!/^release_deploy_approval_[a-f0-9]{64}$/.test(id))refuse();
  const rows=await tx.$queryRaw<Row[]>`SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${id} AND "organizationId"=${s.organizationId} AND "workflowKind"=${RELEASE_DEPLOYMENT_APPROVAL_KIND} FOR UPDATE`;
  if(rows.length!==1)refuse();const row=rows[0],{b,state}=unpack(row,s);
  const events=await tx.durableAgentWorkflowEvent.findMany({where:{workflowRunId:id,organizationId:s.organizationId},orderBy:{sequence:'asc'},take:3});
  if(events.length!==row.version+1||events.some((e,n)=>e.workflowRunId!==id||e.organizationId!==s.organizationId||e.sequence!==n||e.actorKind!=='user'||e.actorId!==(n&&state.status==='consumed'?b.plan.executorUserId:b.approval.approverUserId)||e.eventType!=='release_deployment_approval.'+(n?state.status:'approved')||!same(e.detailJson,auditDetail(b))||!Number.isFinite(e.occurredAt.getTime())))refuse();
  return row;
 }
 async function event(tx:Tx,row:Row,actor:string){const {b}=unpack(row,{organizationId:row.organizationId,actorUserId:actor,sessionId:'event'});await tx.durableAgentWorkflowEvent.create({data:{workflowRunId:row.id,organizationId:row.organizationId,sequence:row.version,eventType:'release_deployment_approval.'+row.currentStep,actorKind:'user',actorId:actor,detailJson:auditDetail(b),occurredAt:now()}})}
 async function change(tx:Tx,row:Row,state:z.infer<typeof stateSchema>,actor:string){
  const data={version:{increment:1},status:state.status==='revoked'?'cancelled':'completed',currentStep:state.status,stateJson:state,updatedAt:now()};
  const result=await tx.durableAgentWorkflow.updateMany({where:{id:row.id,organizationId:row.organizationId,workflowKind:RELEASE_DEPLOYMENT_APPROVAL_KIND,version:0,status:'paused_for_input',currentStep:'approved',attemptCount:0,maxAttempts:1,inputJson:{equals:row.inputJson},leaseOwner:null,leaseExpiresAt:null,approvalProposalId:null},data});if(result.count!==1)refuse();
  const next={...row,...data,version:1};await event(tx,next,actor);return next;
 }
 return{
  async issue(rawScope:DeploymentScope,rawPlan:DeploymentPlan,clientRequestId:string,governanceBaselineDigest?:string){
   ready();const s=deploymentScopeSchema.parse(rawScope),p=deploymentPlanSchema.parse(rawPlan);z.string().uuid().parse(clientRequestId);if(governanceBaselineDigest!==undefined)z.string().regex(/^[a-f0-9]{64}$/).parse(governanceBaselineDigest);
   return repo.$transaction(async tx=>{
    await authority(tx,s,p,undefined,'approver');const at=now();
    const approval=deploymentApprovalSchema.parse({kind:'verified_release_deployment_approval_v1',purpose:'release_deployment',id:releaseDeploymentApprovalId(p),organizationId:s.organizationId,planDigest:sha256ContentHash(p),executorUserId:p.executorUserId,approverUserId:s.actorUserId,approverSessionId:s.sessionId,sourcePolicy:p.sourcePolicy,...(governanceBaselineDigest!==undefined?{governanceBaselineDigest}:{}),expiresAt:new Date(Math.min(Date.parse(p.expiresAt),at.getTime()+30*60000)).toISOString()});
    if(Date.parse(approval.expiresAt)<=Date.parse(p.windowStart))refuse();
    const existing=await tx.durableAgentWorkflow.findFirst({where:{id:approval.id,organizationId:s.organizationId,workflowKind:RELEASE_DEPLOYMENT_APPROVAL_KIND}});
    if(existing){const row=await load(tx,s,approval.id),{b,state}=unpack(row,s);if(b.approval.governanceBaselineDigest!==governanceBaselineDigest||b.clientRequestId!==clientRequestId||b.approval.approverUserId!==s.actorUserId||b.approval.approverSessionId!==s.sessionId||!same(b.plan,p)||state.status!=='approved')refuse();await current(tx,s,p,b.approval,'approver');return structuredClone(b.approval)}
    await current(tx,s,p,approval,'approver');const row=await tx.durableAgentWorkflow.create({data:{id:approval.id,organizationId:s.organizationId,workflowKind:RELEASE_DEPLOYMENT_APPROVAL_KIND,objective:'Independent exact deployment approval',requestedByUserId:s.actorUserId,status:'paused_for_input',autonomyLevel:'observe',currentStep:'approved',inputJson:{format:1,plan:p,approval,clientRequestId,createdAt:at.toISOString()},stateJson:{status:'approved'},attemptCount:0,maxAttempts:1,version:0,leaseOwner:null,leaseExpiresAt:null,approvalProposalId:null,createdAt:at,updatedAt:at}});
    await event(tx,row,s.actorUserId);await current(tx,s,p,approval,'approver');return structuredClone(approval);
   });
  },
  async readIndependentApproval(tx:Tx,rawScope:DeploymentScope,rawPlan:Readonly<DeploymentPlan>){
   const s=deploymentScopeSchema.parse(rawScope),p=deploymentPlanSchema.parse(rawPlan),row=await load(tx,s,releaseDeploymentApprovalId(p)),{b,state}=unpack(row,s);
   if(!same(b.plan,p)||state.status==='revoked')refuse();await current(tx,s,p,b.approval,'executor');return structuredClone(b.approval);
  },
  /** Exact baseline-bound human decision; a consumed decision is readable only
   * by its original operation. This does not renew or consume the decision. */
  async readGovernanceDeploymentApproval(tx:Tx,rawScope:DeploymentScope,rawPlan:Readonly<DeploymentPlan>,baselineDigest:string,operationId?:string){
   const s=deploymentScopeSchema.parse(rawScope),p=deploymentPlanSchema.parse(rawPlan);z.string().regex(/^[a-f0-9]{64}$/).parse(baselineDigest);
   const row=await load(tx,s,releaseDeploymentApprovalId(p)),{b,state}=unpack(row,s);
   if(!same(b.plan,p)||b.approval.governanceBaselineDigest!==baselineDigest||state.status==='revoked'||state.status==='consumed'&&(!operationId||state.operationId!==operationId||operationId!==releaseDeploymentExecutionId(p)))refuse();
   await current(tx,s,p,b.approval,'executor');
   return{organizationId:s.organizationId,baselineDigest,planDigest:b.approval.planDigest,requesterUserId:s.actorUserId,approverUserId:b.approval.approverUserId,currentAuthorityVerified:true as const,expiresAt:b.approval.expiresAt};
  },
  async consumeIndependentApproval(tx:Tx,rawScope:DeploymentScope,rawApproval:Readonly<DeploymentApproval>,operationId:string){
   const s=deploymentScopeSchema.parse(rawScope),a=deploymentApprovalSchema.parse(rawApproval),row=await load(tx,s,a.id),{b,state}=unpack(row,s);
   if(!same(a,b.approval)||operationId!==releaseDeploymentExecutionId(b.plan)||state.status==='revoked')refuse();await current(tx,s,b.plan,a,'executor');
   const operations=await tx.$queryRaw<Row[]>`SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${operationId} AND "organizationId"=${s.organizationId} AND "workflowKind"=${'release_deployment_execution_v1'} FOR UPDATE`;
   if(operations.length!==1)refuse();const op=operations[0],input=op.inputJson as Record<string,unknown>;
   if(op.workflowKind!=='release_deployment_execution_v1'||op.organizationId!==s.organizationId||op.id!==operationId||op.requestedByUserId!==s.actorUserId||op.currentStep!=='prepared'||op.status!=='paused_for_input'||op.attemptCount!==0||op.maxAttempts!==1||op.version!==0||op.leaseOwner||op.leaseExpiresAt||op.approvalProposalId||!input||input.format!==1||!same(input.scope,s)||!same(input.plan,b.plan)||input.planDigest!==a.planDigest||!same(input.approval,a))refuse();
   if(state.status==='consumed'){if(state.operationId!==operationId)refuse();return}
   await change(tx,row,{status:'consumed',operationId},s.actorUserId);await current(tx,s,b.plan,a,'executor');
  },
  async revoke(rawScope:DeploymentScope,id:string,expectedVersion:number){
   const s=deploymentScopeSchema.parse(rawScope);if(expectedVersion!==0)refuse();return repo.$transaction(async tx=>{const row=await load(tx,s,id),{b,state}=unpack(row,s);if(b.approval.approverUserId!==s.actorUserId||b.approval.approverSessionId!==s.sessionId||state.status!=='approved')refuse();await authority(tx,s,b.plan,b.approval,'approver');await change(tx,row,{status:'revoked'},s.actorUserId);await authority(tx,s,b.plan,b.approval,'approver')});
  }
 };
}
