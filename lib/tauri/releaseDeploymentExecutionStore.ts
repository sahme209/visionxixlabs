import 'server-only';
import type {Prisma} from '@/lib/prismaClient';
import {z} from 'zod';
import {sha256ContentHash} from './contentHash';
import {RELEASE_DEPLOYMENT_EXECUTION_KIND,deploymentScopeSchema,deploymentPlanSchema,deploymentApprovalSchema,deploymentResultSchema,type DeploymentScope,type DeploymentPlan,type DeploymentApproval,type DeploymentDto,type DeploymentState,type DeploymentResult} from './releaseDeploymentExecutionContract';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction as Tx,ReleaseOperationPlanRow as Row} from '@/lib/agent/workflows/releaseOperationPlanStore';
export class ReleaseDeploymentUnavailable extends Error{constructor(){super('release_deployment_unavailable')}}
const refuse=():never=>{throw new ReleaseDeploymentUnavailable()};
const same=(a:unknown,b:unknown)=>sha256ContentHash(a)===sha256ContentHash(b);
const inputSchema=z.object({format:z.literal(1),scope:deploymentScopeSchema,plan:deploymentPlanSchema,planDigest:z.string().regex(/^[a-f0-9]{64}$/),approval:deploymentApprovalSchema}).strict();
const stateSchema=z.object({state:z.enum(['prepared','dispatching','accepted','unknown','refused','cancelled']),receipt:deploymentResultSchema.options[0].shape.receipt.optional()}).strict();
export interface ReleaseDeploymentDependencies{
 /** Current reader authority plus locked current connection/head and historical plan validation.
  * This port must not authenticate as the stored executor or confer execution rights. */
 assertHistoricalReader?:(tx:Tx,reader:DeploymentScope,plan:Readonly<DeploymentPlan>,approval:Readonly<DeploymentApproval>)=>Promise<void>;
 now?:()=>Date;
 /** Trusted server authority must check current paired executor AND original independent
  * approver/session/capabilities under transaction locks; no client booleans. */
 assertCurrent?:(tx:Tx,scope:DeploymentScope,plan?:Readonly<DeploymentPlan>,approval?:Readonly<DeploymentApproval>)=>Promise<void>;
 /** Mandatory only for coherent claim/final methods: actual current paired
  * executor, original audited approver and their locked session expiry window. */
 assertCurrentForAdmission?:(tx:Tx,scope:DeploymentScope,plan:Readonly<DeploymentPlan>,approval:Readonly<DeploymentApproval>)=>Promise<()=>void>;
 /** Must lock/rebuild the current submitted release, intake and installation revision. */
 readCurrentPlan?:(tx:Tx,scope:DeploymentScope,plan:Readonly<DeploymentPlan>)=>Promise<unknown>;
 /** Mandatory independently supported source guarantee. A preflight GET or a
  * caller expectedSHA is NOT proof GitHub atomically binds mutable ref dispatch. */
 verifySupportedSourcePolicy?:(tx:Tx,scope:DeploymentScope,plan:Readonly<DeploymentPlan>)=>Promise<unknown>;
 readIndependentApproval?:(tx:Tx,scope:DeploymentScope,plan:Readonly<DeploymentPlan>)=>Promise<unknown>;
 /** Must atomically consume the genuine purpose-bound approval in this same tx,
  * verify the exact prepared operation and never authorize an invented ID. */
 consumeIndependentApproval?:(tx:Tx,scope:DeploymentScope,approval:Readonly<DeploymentApproval>,operationId:string)=>Promise<void>;
}
export const releaseDeploymentExecutionId=(p:DeploymentPlan)=>'release_deployment_'+sha256ContentHash({organizationId:p.organizationId,releaseId:p.releaseId,releaseVersion:p.releaseVersion,planId:p.planId});
export function createReleaseDeploymentExecutionStore(repo:ReleaseOperationPlanRepo,deps:ReleaseDeploymentDependencies={}){
 const now=()=>{const n=new Date((deps.now?.()??new Date()).getTime());if(!Number.isFinite(n.getTime()))refuse();return n};
 const ready=()=>{if(!deps.assertCurrent||!deps.readCurrentPlan||!deps.verifySupportedSourcePolicy||!deps.readIndependentApproval||!deps.consumeIndependentApproval)refuse()};
 async function authority(tx:Tx,s:DeploymentScope,p?:DeploymentPlan,a?:DeploymentApproval){if(!deps.assertCurrent)refuse();await deps.assertCurrent!(tx,structuredClone(s),p&&structuredClone(p),a&&structuredClone(a))}
 async function admissionAuthority(tx:Tx,s:DeploymentScope,p:DeploymentPlan,a:DeploymentApproval){
  ready();if(typeof deps.assertCurrentForAdmission!=='function')refuse();
  // Never adopt a session identifier from unvalidated execution JSON: the real
  // approval reader verifies its original immutable decision/history first.
  const original=deploymentApprovalSchema.parse(await deps.readIndependentApproval!(tx,s,structuredClone(p)));if(!same(original,a))refuse();
  const fresh=await deps.assertCurrentForAdmission!(tx,structuredClone(s),structuredClone(p),structuredClone(original));if(typeof fresh!=='function')refuse();fresh();return fresh;
 }
 function approvalBinding(s:DeploymentScope,p:DeploymentPlan,a:DeploymentApproval){if(p.organizationId!==s.organizationId||p.executorUserId!==s.actorUserId||a.organizationId!==s.organizationId||a.planDigest!==sha256ContentHash(p)||a.executorUserId!==s.actorUserId||a.sourcePolicy!==p.sourcePolicy||[p.creatorUserId,p.requesterUserId,p.executorUserId].includes(a.approverUserId))refuse()}
 async function live(tx:Tx,p:DeploymentPlan,a:DeploymentApproval,lease?:Date){const end=new Date(Math.min(Date.parse(p.expiresAt),Date.parse(a.expiresAt),lease?.getTime()??Infinity)),start=new Date(p.windowStart);if(now()<start||now()>=end)refuse();const rows=await tx.$queryRaw<Array<{live:boolean}>>`SELECT clock_timestamp() < ${end} AND clock_timestamp() >= ${start} AS "live"`;if(rows.length!==1||rows[0].live!==true)refuse()}
 async function current(tx:Tx,s:DeploymentScope,p:DeploymentPlan,a:DeploymentApproval,lease?:Date){ready();approvalBinding(s,p,a);await authority(tx,s,p,a);if(!same(deploymentPlanSchema.parse(await deps.readCurrentPlan!(tx,s,structuredClone(p))),p))refuse();const policy=z.object({kind:z.literal('verified_release_deployment_source_policy_v1'),planDigest:z.string(),sourcePolicy:z.string()}).strict().parse(await deps.verifySupportedSourcePolicy!(tx,s,structuredClone(p)));if(policy.planDigest!==sha256ContentHash(p)||policy.sourcePolicy!==p.sourcePolicy)refuse();await authority(tx,s,p,a);await live(tx,p,a,lease)}
 /** Accepted provenance is historical. Execution still uses current()/live(). */
 async function acceptedReadCurrent(tx:Tx,s:DeploymentScope,p:DeploymentPlan,a:DeploymentApproval,row:Row){
  ready();approvalBinding(s,p,a);await authority(tx,s,p,a);
  const acceptedAt=row.updatedAt.getTime(),start=Date.parse(p.windowStart),end=Math.min(Date.parse(p.expiresAt),Date.parse(a.expiresAt));
  if(!Number.isFinite(acceptedAt)||acceptedAt<start||acceptedAt>=end||acceptedAt>now().getTime())refuse();
  const events=await tx.durableAgentWorkflowEvent.findMany({where:{workflowRunId:row.id,organizationId:s.organizationId},orderBy:{sequence:'asc'},take:4});
  if(events.length!==3||events[0].occurredAt.getTime()<row.createdAt.getTime()||events[1].occurredAt.getTime()>acceptedAt||events[2].occurredAt.getTime()<acceptedAt||events.some((event,index)=>event.occurredAt.getTime()<start||event.occurredAt.getTime()>=end||event.occurredAt.getTime()>now().getTime()||index>0&&event.occurredAt.getTime()<events[index-1].occurredAt.getTime()))refuse();
  if(!same(deploymentPlanSchema.parse(await deps.readCurrentPlan!(tx,s,structuredClone(p))),p))refuse();
  const policy=z.object({kind:z.literal('verified_release_deployment_source_policy_v1'),planDigest:z.string(),sourcePolicy:z.string()}).strict().parse(await deps.verifySupportedSourcePolicy!(tx,s,structuredClone(p)));
  if(policy.planDigest!==sha256ContentHash(p)||policy.sourcePolicy!==p.sourcePolicy)refuse();
  await authority(tx,s,p,a);
 }
 function unpack(r:Row,s:DeploymentScope){const i=inputSchema.parse(r.inputJson),v=stateSchema.parse(r.stateJson);const zero=v.state==='prepared'||v.state==='cancelled',version=v.state==='prepared'?0:['dispatching','cancelled'].includes(v.state)?1:2;if(!same(i.scope,s)||i.planDigest!==sha256ContentHash(i.plan)||r.id!==releaseDeploymentExecutionId(i.plan)||r.organizationId!==s.organizationId||r.workflowKind!==RELEASE_DEPLOYMENT_EXECUTION_KIND||r.requestedByUserId!==s.actorUserId||r.currentStep!==v.state||r.version!==version||r.attemptCount!==(zero?0:1)||r.maxAttempts!==1||r.approvalProposalId||r.status!==(v.state==='prepared'?'paused_for_input':v.state==='dispatching'?'running':v.state==='cancelled'?'cancelled':'completed')||Boolean(v.receipt)!==(v.state==='accepted')||(v.state==='dispatching'?r.leaseOwner!==s.sessionId||!r.leaseExpiresAt:r.leaseOwner!==null||r.leaseExpiresAt!==null))refuse();approvalBinding(s,i.plan,i.approval);if(v.receipt)receiptBinding(i.plan,v.receipt);return{i,v}}
 function receiptBinding(p:DeploymentPlan,r:NonNullable<DeploymentDto['receipt']>){if(r.repositoryFullName!==p.repositoryFullName||r.workflowPath!==p.workflowPath||r.headSha!==p.sourceCommitSha||r.ref!==p.ref||r.runAttempt!==1)refuse()}
 function dto(r:Row,s:DeploymentScope):DeploymentDto{const{v,i}=unpack(r,s);const p=i.plan;return{action:{repositoryFullName:p.repositoryFullName,workflowPath:p.workflowPath,workflowBlobSha:p.workflowBlobSha,sourceCommitSha:p.sourceCommitSha,refKind:p.refKind,ref:p.ref,inputs:p.inputs,sourcePolicy:p.sourcePolicy,windowStart:p.windowStart,expiresAt:p.expiresAt,planDigest:i.planDigest},id:r.id,state:v.state,version:r.version,attemptCount:r.attemptCount,...(v.receipt?{receipt:v.receipt}:{}),deploymentSucceeded:false,artifactVerified:false,applicationHealthVerified:false,executionAvailable:false}}
 async function load(tx:Tx,s:DeploymentScope,id:string,shared=false){if(!/^release_deployment_[a-f0-9]{64}$/.test(id))refuse();const rows=shared?await tx.$queryRaw<Row[]>`SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${id} AND "organizationId"=${s.organizationId} AND "workflowKind"=${RELEASE_DEPLOYMENT_EXECUTION_KIND} FOR SHARE`:await tx.$queryRaw<Row[]>`SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${id} AND "organizationId"=${s.organizationId} AND "workflowKind"=${RELEASE_DEPLOYMENT_EXECUTION_KIND} FOR UPDATE`;if(rows.length!==1)refuse();const r=rows[0];unpack(r,s);const events=await tx.durableAgentWorkflowEvent.findMany({where:{workflowRunId:id,organizationId:s.organizationId},orderBy:{sequence:'asc'},take:4});if(events.length!==r.version+1||events.some((e,n)=>e.workflowRunId!==id||e.organizationId!==s.organizationId||e.sequence!==n||e.actorId!==s.actorUserId||e.actorKind!=='user'||e.eventType!=='release_deployment.'+(n===0?'prepared':n===1&&r.currentStep!=='cancelled'?'dispatching':r.currentStep)||!same(e.detailJson,{planDigest:inputSchema.parse(r.inputJson).planDigest})||!Number.isFinite(e.occurredAt.getTime())))refuse();return r}
 async function event(tx:Tx,r:Row){await tx.durableAgentWorkflowEvent.create({data:{workflowRunId:r.id,organizationId:r.organizationId,sequence:r.version,eventType:'release_deployment.'+r.currentStep,actorKind:'user',actorId:r.requestedByUserId,detailJson:{planDigest:inputSchema.parse(r.inputJson).planDigest},occurredAt:now()}})}
 async function change(tx:Tx,r:Row,state:DeploymentState,receipt?:DeploymentDto['receipt']){const data={version:{increment:1},status:state==='dispatching'?'running':state==='cancelled'?'cancelled':'completed',currentStep:state,stateJson:{state,...(receipt?{receipt}:{})},attemptCount:state==='cancelled'?0:1,leaseOwner:state==='dispatching'?inputSchema.parse(r.inputJson).scope.sessionId:null,leaseExpiresAt:state==='dispatching'?new Date(Math.min(now().getTime()+30000,Date.parse(inputSchema.parse(r.inputJson).plan.expiresAt),Date.parse(inputSchema.parse(r.inputJson).approval.expiresAt))):null,updatedAt:now()};const changed=await tx.durableAgentWorkflow.updateMany({where:{id:r.id,organizationId:r.organizationId,workflowKind:RELEASE_DEPLOYMENT_EXECUTION_KIND,version:r.version,inputJson:{equals:r.inputJson},stateJson:{equals:r.stateJson},attemptCount:r.attemptCount},data});if(changed.count!==1)refuse();const updated={...r,...data,version:r.version+1};await event(tx,updated);return updated}
 async function claimedOutboundAuthority(tx:Tx,rawScope:DeploymentScope,rawPlan:Readonly<DeploymentPlan>){
  const s=deploymentScopeSchema.parse(rawScope),p=deploymentPlanSchema.parse(rawPlan);
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(s.organizationId)}))`;
  const r=await load(tx,s,releaseDeploymentExecutionId(p),true),{i,v}=unpack(r,s);
  if(v.state!=='dispatching'||!same(i.plan,p)||i.planDigest!==sha256ContentHash(p))refuse();
  const participantFresh=await admissionAuthority(tx,s,i.plan,i.approval);await current(tx,s,i.plan,i.approval,r.leaseExpiresAt!);
  const start=Date.parse(p.windowStart),end=Math.min(Date.parse(p.expiresAt),Date.parse(i.approval.expiresAt),r.leaseExpiresAt!.getTime());
  const fresh=()=>{participantFresh();const at=now().getTime();if(at<start||at>=end)refuse()};fresh();return {fresh,attemptId:'release_deployment_attempt_'+sha256ContentHash({operationId:r.id,attemptCount:r.attemptCount}),targetDigest:sha256ContentHash({repositoryFullName:p.repositoryFullName,workflowPath:p.workflowPath,refKind:p.refKind,ref:p.ref,inputsDigest:sha256ContentHash(p.inputs)}),sourceDigest:sha256ContentHash(p),connectionId:p.connectionId};
 }

 return{
 async prepare(rawScope:DeploymentScope,rawPlan:DeploymentPlan){ready();const s=deploymentScopeSchema.parse(rawScope),p=deploymentPlanSchema.parse(structuredClone(rawPlan));return repo.$transaction(async tx=>{const a=deploymentApprovalSchema.parse(await deps.readIndependentApproval!(tx,s,structuredClone(p)));await current(tx,s,p,a);const id=releaseDeploymentExecutionId(p),rows=await tx.$queryRaw<Row[]>`SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${id} AND "organizationId"=${s.organizationId} FOR UPDATE`;if(rows.length){const r=await load(tx,s,id);if(!same(inputSchema.parse(r.inputJson),{format:1,scope:s,plan:p,planDigest:sha256ContentHash(p),approval:a}))refuse();await current(tx,s,p,a);return dto(r,s)}const at=now();const r=await tx.durableAgentWorkflow.create({data:{id,organizationId:s.organizationId,workflowKind:RELEASE_DEPLOYMENT_EXECUTION_KIND,objective:'Execute one exact independently approved deployment',autonomyLevel:'observe',requestedByUserId:s.actorUserId,status:'paused_for_input',currentStep:'prepared',inputJson:{format:1,scope:s,plan:p,planDigest:sha256ContentHash(p),approval:a},stateJson:{state:'prepared'},attemptCount:0,maxAttempts:1,version:0,leaseOwner:null,leaseExpiresAt:null,approvalProposalId:null,createdAt:at,updatedAt:at} satisfies Prisma.DurableAgentWorkflowUncheckedCreateInput});await event(tx,r);await current(tx,s,p,a);return dto(r,s)})},
 async claim(rawScope:DeploymentScope,id:string){const s=deploymentScopeSchema.parse(rawScope);return repo.$transaction(async tx=>{const r=await load(tx,s,id),{i,v}=unpack(r,s);await authority(tx,s,i.plan,i.approval);if(v.state!=='prepared')return{claimed:false as const};await current(tx,s,i.plan,i.approval);await deps.consumeIndependentApproval!(tx,s,structuredClone(i.approval),id);await current(tx,s,i.plan,i.approval);const updated=await change(tx,r,'dispatching');await current(tx,s,i.plan,i.approval,updated.leaseExpiresAt!);return{claimed:true as const,leaseExpiresAt:updated.leaseExpiresAt!,plan:structuredClone(i.plan)}})},
 /** Internal governed claim. Admission and the original independent decision
  * share these actual transaction locks; a later source/receipt expiry rolls
  * approval consumption, attempt CAS and audit events back together. */
 async claimWithAdmission(rawScope:DeploymentScope,id:string,verifyLocked:(tx:Tx,plan:Readonly<DeploymentPlan>)=>Promise<()=>void>){
  const s=deploymentScopeSchema.parse(rawScope);if(typeof verifyLocked!=='function')refuse();
  let finalFresh:(()=>void)|undefined;const claimed=await repo.$transaction(async tx=>{
   await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(s.organizationId)}))`;
   const r=await load(tx,s,id),{i,v}=unpack(r,s);await authority(tx,s,i.plan,i.approval);if(v.state!=='prepared')return{claimed:false as const};
   await current(tx,s,i.plan,i.approval);const authorityFresh=await admissionAuthority(tx,s,i.plan,i.approval);
   const assertFresh=await verifyLocked(tx,structuredClone(i.plan));if(typeof assertFresh!=='function')refuse();authorityFresh();assertFresh();
   await deps.consumeIndependentApproval!(tx,s,structuredClone(i.approval),id);await current(tx,s,i.plan,i.approval);authorityFresh();assertFresh();
   const updated=await change(tx,r,'dispatching');await current(tx,s,i.plan,i.approval,updated.leaseExpiresAt!);const start=Date.parse(i.plan.windowStart),end=Math.min(Date.parse(i.plan.expiresAt),Date.parse(i.approval.expiresAt),updated.leaseExpiresAt!.getTime());finalFresh=()=>{authorityFresh();assertFresh();const at=now().getTime();if(at<start||at>=end)refuse()};finalFresh();
   return{claimed:true as const,leaseExpiresAt:updated.leaseExpiresAt!,plan:structuredClone(i.plan)};
  });if(claimed.claimed){if(!finalFresh)refuse();finalFresh!()}return claimed;
 },
 /** DB-only credential boundary. Reuses canonical operation/history, original
  * independent approval/current participants and live lease; never claims or
  * consumes. Caller retains this private closure through issuer awaits. */
 async assertClaimedCredentialAuthority(tx:Tx,rawScope:DeploymentScope,rawPlan:Readonly<DeploymentPlan>){return (await claimedOutboundAuthority(tx,rawScope,rawPlan)).fresh},
 /** Exact actual claimed attempt metadata in the caller's existing org-first transaction. */
 async readClaimedOutboundLocked(tx:Tx,rawScope:DeploymentScope,id:string,rawPlan:Readonly<DeploymentPlan>){
  const p=deploymentPlanSchema.parse(rawPlan);if(id!==releaseDeploymentExecutionId(p))refuse();
  return claimedOutboundAuthority(tx,rawScope,p);
 },
 async beforeDispatch(rawScope:DeploymentScope,id:string){const s=deploymentScopeSchema.parse(rawScope);return repo.$transaction(async tx=>{const r=await load(tx,s,id),{i,v}=unpack(r,s);if(v.state!=='dispatching')refuse();await current(tx,s,i.plan,i.approval,r.leaseExpiresAt!);return structuredClone(i.plan)})},
 /** Internal final dispatch boundary. The verifier must fuse DB-only policy
  * checks into these SAME participant/installation/operation locks, returning
  * a synchronous private proof/receipt expiry check for after the lease clock.
  * No provider I/O is allowed in this callback. */
 async beforeDispatchWithAdmission(rawScope:DeploymentScope,id:string,verifyLocked:(tx:Tx,plan:Readonly<DeploymentPlan>)=>Promise<()=>void>,publishFreshness?:(assertFresh:()=>void)=>void){
  const s=deploymentScopeSchema.parse(rawScope);if(typeof verifyLocked!=='function')refuse();
  let finalFresh:(()=>void)|undefined;
  const plan=await repo.$transaction(async tx=>{
   // Match baseline activation's lock order before any participant/source/pointer
   // lock can be acquired by existing current-authority composition.
   await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(s.organizationId)}))`;
   const r=await load(tx,s,id),{i,v}=unpack(r,s);if(v.state!=='dispatching')refuse();
   await current(tx,s,i.plan,i.approval,r.leaseExpiresAt!);const authorityFresh=await admissionAuthority(tx,s,i.plan,i.approval);
   const assertFresh=await verifyLocked(tx,structuredClone(i.plan));if(typeof assertFresh!=='function')refuse();
   const start=Date.parse(i.plan.windowStart),end=Math.min(Date.parse(i.plan.expiresAt),Date.parse(i.approval.expiresAt),r.leaseExpiresAt!.getTime());
   finalFresh=()=>{authorityFresh();assertFresh();const at=now().getTime();if(at<start||at>=end)refuse()};
   await live(tx,i.plan,i.approval,r.leaseExpiresAt!);finalFresh();return structuredClone(i.plan);
  });
  // A delayed COMMIT/result must not renew the original private proof window.
  if(!finalFresh)refuse();finalFresh!();publishFreshness?.(finalFresh!);return plan;
 },
 async finish(rawScope:DeploymentScope,id:string,rawResult:DeploymentResult){const s=deploymentScopeSchema.parse(rawScope),result=deploymentResultSchema.parse(rawResult);return repo.$transaction(async tx=>{const r=await load(tx,s,id),{i,v}=unpack(r,s);await authority(tx,s,i.plan,i.approval);if(v.state!=='dispatching')return dto(r,s);if(result.state==='accepted')receiptBinding(i.plan,result.receipt);if(result.state!=='unknown')await current(tx,s,i.plan,i.approval,r.leaseExpiresAt!);const updated=await change(tx,r,result.state,result.state==='accepted'?result.receipt:undefined);if(result.state!=='unknown')await current(tx,s,i.plan,i.approval,r.leaseExpiresAt!);else await authority(tx,s,i.plan,i.approval);return dto(updated,s)})},
 /** Server-only provenance reader. Never claims, consumes approval or dispatches. */
 async readAcceptedEvidenceSource(rawScope:DeploymentScope,id:string,transaction?:Tx){const s=deploymentScopeSchema.parse(rawScope);const read=async(tx:Tx)=>{const r=await load(tx,s,id),{i,v}=unpack(r,s);if(v.state!=='accepted'||!v.receipt)refuse();await acceptedReadCurrent(tx,s,i.plan,i.approval,r);const source={operationId:r.id,plan:structuredClone(i.plan),deploymentPlanDigest:i.planDigest,receipt:structuredClone(v.receipt!),acceptedAt:r.updatedAt.toISOString(),expiresAt:new Date(Math.min(Date.parse(i.plan.expiresAt),Date.parse(i.approval.expiresAt))).toISOString(),dispatchEvidenceDigest:sha256ContentHash({operationId:r.id,planDigest:i.planDigest,approvalId:i.approval.id,receipt:v.receipt,acceptedAt:r.updatedAt.toISOString()})};await acceptedReadCurrent(tx,s,i.plan,i.approval,r);return source};return transaction?read(transaction):repo.$transaction(read)},
 /** Read-only audit projection for independently reviewed later ticket association. */
 async readHistoricalAcceptedSource(rawScope:DeploymentScope,id:string,transaction?:Tx){
  const reader=deploymentScopeSchema.parse(rawScope);if(!deps.assertHistoricalReader||!/^release_deployment_[a-f0-9]{64}$/.test(id))refuse();
  const read=async(tx:Tx)=>{
   const rows=await tx.$queryRaw<Row[]>`SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${id} AND "organizationId"=${reader.organizationId} AND "workflowKind"=${RELEASE_DEPLOYMENT_EXECUTION_KIND} FOR SHARE`;
   if(rows.length!==1)refuse();const original=inputSchema.parse(rows[0].inputJson);
   if(original.scope.organizationId!==reader.organizationId||original.plan.organizationId!==reader.organizationId)refuse();
   await deps.assertHistoricalReader!(tx,reader,structuredClone(original.plan),structuredClone(original.approval));
   const row=await load(tx,original.scope,id,true),{i,v}=unpack(row,original.scope);
   if(v.state!=='accepted'||!v.receipt||!same(row.inputJson,rows[0].inputJson))refuse();
   const acceptedAt=row.updatedAt.getTime(),start=Date.parse(i.plan.windowStart),end=Math.min(Date.parse(i.plan.expiresAt),Date.parse(i.approval.expiresAt));
   if(!Number.isFinite(acceptedAt)||acceptedAt<start||acceptedAt>=end||acceptedAt>now().getTime())refuse();
   const events=await tx.durableAgentWorkflowEvent.findMany({where:{workflowRunId:id,organizationId:reader.organizationId},orderBy:{sequence:'asc'},take:4});
   if(events.length!==3||events[0].occurredAt<row.createdAt||events[1].occurredAt.getTime()>acceptedAt||events[2].occurredAt.getTime()<acceptedAt||events.some((e,n)=>e.occurredAt.getTime()<start||e.occurredAt.getTime()>=end||e.occurredAt.getTime()>now().getTime()||n>0&&e.occurredAt<events[n-1].occurredAt))refuse();
   await deps.assertHistoricalReader!(tx,reader,structuredClone(i.plan),structuredClone(i.approval));
   return{operationId:row.id,plan:structuredClone(i.plan),deploymentPlanDigest:i.planDigest,receipt:structuredClone(v.receipt!),acceptedAt:row.updatedAt.toISOString(),expiresAt:new Date(end).toISOString(),dispatchEvidenceDigest:sha256ContentHash({operationId:row.id,planDigest:i.planDigest,approvalId:i.approval.id,receipt:v.receipt,acceptedAt:row.updatedAt.toISOString()})};
  };return transaction?read(transaction):repo.$transaction(read);
 },
 async get(rawScope:DeploymentScope,id:string){const s=deploymentScopeSchema.parse(rawScope);return repo.$transaction(async tx=>{const r=await load(tx,s,id);await authority(tx,s);return dto(r,s)})},
 async recover(rawScope:DeploymentScope,id:string,expectedVersion?:number){const s=deploymentScopeSchema.parse(rawScope);return repo.$transaction(async tx=>{const r=await load(tx,s,id);await authority(tx,s);if(expectedVersion!==undefined&&(!Number.isInteger(expectedVersion)||r.version!==expectedVersion))refuse();const updated=r.currentStep==='dispatching'&&r.leaseExpiresAt!.getTime()<=now().getTime()?await change(tx,r,'unknown'):r;await authority(tx,s);return dto(updated,s)})},
 async cancel(rawScope:DeploymentScope,id:string,expectedVersion?:number){const s=deploymentScopeSchema.parse(rawScope);return repo.$transaction(async tx=>{const r=await load(tx,s,id);await authority(tx,s);if(expectedVersion!==undefined&&(!Number.isInteger(expectedVersion)||r.version!==expectedVersion))refuse();const updated=r.currentStep==='prepared'?await change(tx,r,'cancelled'):r;await authority(tx,s);return dto(updated,s)})}
 }
}
export type ReleaseDeploymentExecutionStore=ReturnType<typeof createReleaseDeploymentExecutionStore>;
