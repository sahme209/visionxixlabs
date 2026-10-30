import 'server-only';
import {TICKET_ASSOCIATION_WINDOW_MS,TICKET_PROVIDER_ACTION_WINDOW_MS} from './ticketReviewWindows';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction,ReleaseOperationPlanRow} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {TICKET_GOVERNANCE_REVIEW_KIND,ticketGovernanceBindingSchema,ticketReviewScopeSchema,type TicketGovernanceBinding,type TicketReviewScope} from './ticketGovernanceReviewContract';
export interface TicketReviewPorts {
 now?:()=>Date;
 assertCurrent?:(tx:ReleaseOperationPlanTransaction,input:{scope:TicketReviewScope;actorUserId:string;role:'reader'|'requester'|'policy_admin'|'approver'|'user';binding:Readonly<TicketGovernanceBinding>})=>Promise<void>;
 /** Trusted server composition only. Rebuild from locked source rows and bounded
  * read-only preflight receipts; never echo a client body or do provider writes. */
 readCurrentBinding?:(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,binding:Readonly<TicketGovernanceBinding>)=>Promise<unknown>;
}
const hash=z.string().regex(/^[a-f0-9]{64}$/),identity=z.string().min(1).max(240),uuid=z.string().uuid();
const reviewId=z.string().regex(/^ticket_review_[a-f0-9]{64}$/);
const action=z.object({id:reviewId,expectedVersion:z.number().int().min(0).max(2),clientRequestId:uuid}).strict();
const inputSchema=z.object({format:z.literal(1),binding:ticketGovernanceBindingSchema,bindingDigest:hash,requesterSessionId:identity,clientRequestId:uuid,createdAt:z.string().datetime()}).strict();
const approvalSchema=z.object({actorUserId:identity,sessionId:identity,clientRequestId:uuid,approvedAt:z.string().datetime()}).strict();
const stateSchema=z.object({status:z.enum(['requested','approved','cancelled','revoked']),approval:approvalSchema.nullable()}).strict();
type State=z.infer<typeof stateSchema>;
type Row=ReleaseOperationPlanRow;
type Role=Parameters<NonNullable<TicketReviewPorts['assertCurrent']>>[1]['role'];
export class TicketGovernanceReviewConflict extends Error{constructor(){super('ticket_review_unavailable');this.name='TicketGovernanceReviewConflict'}}
class TicketReviewSourceChanged extends TicketGovernanceReviewConflict{}
const refuse=():never=>{throw new TicketGovernanceReviewConflict()};
const idFor=(organizationId:string,bindingDigest:string)=>'ticket_review_'+sha256ContentHash({organizationId,bindingDigest});
const rowStatus=(status:State['status'])=>status==='requested'?'paused_for_input':status==='approved'?'completed':'cancelled';
function unpack(row:Row,org:string){
 const input=inputSchema.parse(row.inputJson),state=stateSchema.parse(row.stateJson),c=input.binding;
 const expectedVersion=state.status==='requested'?0:state.status==='revoked'?2:1;
 if(row.organizationId!==org||c.organizationId!==org||row.workflowKind!==TICKET_GOVERNANCE_REVIEW_KIND||row.id!==idFor(org,input.bindingDigest)||input.bindingDigest!==sha256ContentHash(c)||row.requestedByUserId!==c.requesterUserId||c.executorUserId!==c.requesterUserId||row.attemptCount!==0||row.maxAttempts!==1||row.leaseOwner||row.leaseExpiresAt||row.approvalProposalId||row.version!==expectedVersion||row.currentStep!==state.status||row.status!==rowStatus(state.status)||row.createdAt.toISOString()!==input.createdAt||Boolean(state.approval)!==['approved','revoked'].includes(state.status)||state.approval&&[c.requesterUserId,c.executorUserId].includes(state.approval.actorUserId))refuse();
 return{input,state,c};
}
export function createTicketGovernanceReviewStore(repo:ReleaseOperationPlanRepo,ports:TicketReviewPorts={}){
 const now=()=>{const at=new Date((ports.now?.()??new Date()).getTime());if(!Number.isFinite(at.getTime()))refuse();return at};
 async function authority(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,actorUserId:string,role:Role,c:TicketGovernanceBinding){
  if(!ports.assertCurrent)refuse();
  const members=await tx.$queryRaw<Array<{organizationId:string;userId:string;acceptedAt:Date|null}>>`SELECT "organizationId","userId","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${scope.organizationId} AND "userId"=${actorUserId} FOR SHARE`;
  if(members.length!==1||members[0].organizationId!==scope.organizationId||members[0].userId!==actorUserId||!members[0].acceptedAt)refuse();
  await ports.assertCurrent!(tx,{scope:structuredClone(scope),actorUserId,role,binding:structuredClone(c)});
 }
 async function clock(tx:ReleaseOperationPlanTransaction,c:TicketGovernanceBinding){
  if(now().getTime()>=Date.parse(c.expiresAt))throw new TicketReviewSourceChanged();
  const result=await tx.$queryRaw<Array<{live:boolean}>>`SELECT clock_timestamp() < ${new Date(c.expiresAt)} AS "live"`;
  if(result.length!==1||result[0].live!==true||now().getTime()>=Date.parse(c.expiresAt))throw new TicketReviewSourceChanged();
 }
 async function source(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,c:TicketGovernanceBinding){
  if(!ports.readCurrentBinding)refuse();
  const current=ticketGovernanceBindingSchema.parse(await ports.readCurrentBinding!(tx,scope,Object.freeze(structuredClone(c))));
  if(sha256ContentHash(current)!==sha256ContentHash(c))throw new TicketReviewSourceChanged();
  await clock(tx,c);
 }
 async function principals(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,row:Row){
  const {c,state}=unpack(row,scope.organizationId);
  await authority(tx,scope,scope.actorUserId,'reader',c);
  await authority(tx,scope,c.requesterUserId,c.kind==='servicenow_terminal_policy'?'policy_admin':'requester',c);
  if(c.executorUserId!==c.requesterUserId)await authority(tx,scope,c.executorUserId,'user',c);
  if(state.approval)await authority(tx,scope,state.approval.actorUserId,'approver',c);
 }
 async function history(tx:ReleaseOperationPlanTransaction,row:Row){
  const {input,c,state}=unpack(row,row.organizationId);
  const events=await tx.durableAgentWorkflowEvent.findMany({where:{organizationId:row.organizationId,workflowRunId:row.id},orderBy:{sequence:'asc'},take:4});
  if(events.length!==row.version+1||events.length>3)refuse();
  for(let i=0;i<events.length;i++){
   const e=events[i],d=z.object({bindingDigest:hash,clientRequestId:uuid,expectedVersion:z.number().int().min(0).max(1).nullable()}).strict().parse(e.detailJson);
   const type=i===0?'requested':i===1&&state.approval?'approved':state.status;
   const actor=i===0?c.requesterUserId:type==='approved'?state.approval?.actorUserId:e.actorId;
   if(e.workflowRunId!==row.id||e.organizationId!==row.organizationId||e.sequence!==i||e.actorKind!=='user'||!e.actorId||e.actorId!==actor||e.eventType!=='ticket_governance_review.'+type||d.bindingDigest!==input.bindingDigest||d.expectedVersion!==(i?i-1:null)||!Number.isFinite(e.occurredAt.getTime())||e.occurredAt<row.createdAt||i>0&&e.occurredAt<events[i-1].occurredAt)refuse();
   if(i===0&&(d.clientRequestId!==input.clientRequestId||e.occurredAt.toISOString()!==input.createdAt)||type==='approved'&&(d.clientRequestId!==state.approval?.clientRequestId||e.occurredAt.toISOString()!==state.approval.approvedAt)||['cancelled','revoked'].includes(type)&&![c.requesterUserId,state.approval?.actorUserId].includes(e.actorId??''))refuse();
  }
  if(events.at(-1)!.occurredAt.getTime()!==row.updatedAt.getTime())refuse();
  return events;
 }
 async function load(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,id:string){
  reviewId.parse(id);const rows=await tx.$queryRaw<Row[]>`SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${id} AND "organizationId"=${scope.organizationId} FOR UPDATE`;
  if(rows.length!==1)refuse();unpack(rows[0],scope.organizationId);await history(tx,rows[0]);return rows[0];
 }
 async function event(tx:ReleaseOperationPlanTransaction,row:Row,actorUserId:string,clientRequestId:string,expectedVersion:number|null){
  const {input,state}=unpack(row,row.organizationId);
  await tx.durableAgentWorkflowEvent.create({data:{workflowRunId:row.id,organizationId:row.organizationId,sequence:row.version,eventType:'ticket_governance_review.'+state.status,actorKind:'user',actorId:actorUserId,detailJson:{bindingDigest:input.bindingDigest,clientRequestId,expectedVersion},occurredAt:row.updatedAt}});
 }
 function view(row:Row,actorUserId:string,live=true,approvalAllowed=false){const{input,c,state}=unpack(row,row.organizationId);return{id:row.id,version:row.version,status:state.status,binding:structuredClone(c),bindingDigest:input.bindingDigest,approval:state.approval,canApprove:approvalAllowed&&live&&state.status==='requested'&&![c.requesterUserId,c.executorUserId].includes(actorUserId),canCancel:['requested','approved'].includes(state.status)&&[c.requesterUserId,state.approval?.actorUserId].includes(actorUserId),current:live,providerExecutionAvailable:false as const}}
 async function change(tx:ReleaseOperationPlanTransaction,row:Row,state:State,actorUserId:string,clientRequestId:string,expectedVersion:number){
  const at=now();if(state.status==='approved'&&state.approval)state={...state,approval:{...state.approval,approvedAt:at.toISOString()}};const changed=await tx.durableAgentWorkflow.updateMany({where:{id:row.id,organizationId:row.organizationId,workflowKind:TICKET_GOVERNANCE_REVIEW_KIND,version:expectedVersion,currentStep:row.currentStep,status:row.status,attemptCount:0,maxAttempts:1,leaseOwner:null,leaseExpiresAt:null,approvalProposalId:null,inputJson:{equals:row.inputJson},stateJson:{equals:row.stateJson}},data:{version:{increment:1},status:rowStatus(state.status),currentStep:state.status,stateJson:state,updatedAt:at,completedAt:at,...(state.status==='cancelled'||state.status==='revoked'?{cancelRequestedAt:at,cancelledAt:at}:{})}});
  if(changed.count!==1)refuse();const next={...row,version:row.version+1,status:rowStatus(state.status),currentStep:state.status,stateJson:state,updatedAt:at};await event(tx,next,actorUserId,clientRequestId,expectedVersion);await history(tx,next);return next;
 }
 return{
  async prepare(rawScope:TicketReviewScope,rawBinding:unknown,clientRequestId:string){
   const scope=ticketReviewScopeSchema.parse(rawScope),c=ticketGovernanceBindingSchema.parse(rawBinding);uuid.parse(clientRequestId);
   if(c.organizationId!==scope.organizationId||c.requesterUserId!==scope.actorUserId||c.executorUserId!==scope.actorUserId||Date.parse(c.expiresAt)>now().getTime()+(c.kind==='ticket_release_association'?TICKET_ASSOCIATION_WINDOW_MS:TICKET_PROVIDER_ACTION_WINDOW_MS))refuse();
   return repo.$transaction(async tx=>{
    const role=c.kind==='servicenow_terminal_policy'?'policy_admin':'requester';await authority(tx,scope,scope.actorUserId,role,c);await source(tx,scope,c);
    const digest=sha256ContentHash(c),id=idFor(scope.organizationId,digest),prior=await tx.durableAgentWorkflow.findFirst({where:{id,organizationId:scope.organizationId,workflowKind:TICKET_GOVERNANCE_REVIEW_KIND}});
    if(prior){const{input}=unpack(prior,scope.organizationId);if(input.clientRequestId!==clientRequestId||input.requesterSessionId!==scope.sessionId)refuse();await history(tx,prior);await principals(tx,scope,prior);return view(prior,scope.actorUserId)}
    const at=now(),input=inputSchema.parse({format:1,binding:c,bindingDigest:digest,requesterSessionId:scope.sessionId,clientRequestId,createdAt:at.toISOString()});
    const row=await tx.durableAgentWorkflow.create({data:{id,organizationId:scope.organizationId,workflowKind:TICKET_GOVERNANCE_REVIEW_KIND,objective:c.kind==='ticket_release_association'?'Review later ticket-to-deployment association; no provider action':c.kind==='servicenow_terminal_policy'?'Review administrator-declared ServiceNow terminal policy; no provider action':'Review exact already-written ServiceNow journal proof; no provider action',autonomyLevel:'observe',status:'paused_for_input',currentStep:'requested',inputJson:input,stateJson:{status:'requested',approval:null},requestedByUserId:scope.actorUserId,attemptCount:0,maxAttempts:1,version:0,leaseOwner:null,leaseExpiresAt:null,approvalProposalId:null,nextAttemptAt:null,createdAt:at,updatedAt:at}});
    await event(tx,row,scope.actorUserId,clientRequestId,null);await principals(tx,scope,row);await source(tx,scope,c);await history(tx,row);return view(row,scope.actorUserId);
   });
  },
  async approve(rawScope:TicketReviewScope,raw:unknown){
   const scope=ticketReviewScopeSchema.parse(rawScope),a=action.parse(raw);
   return repo.$transaction(async tx=>{
    const row=await load(tx,scope,a.id),{c,state}=unpack(row,scope.organizationId);
    if([c.requesterUserId,c.executorUserId].includes(scope.actorUserId))refuse();await authority(tx,scope,scope.actorUserId,'approver',c);await principals(tx,scope,row);await source(tx,scope,c);
    if(state.status==='approved'&&a.expectedVersion===0&&state.approval?.actorUserId===scope.actorUserId&&state.approval.sessionId===scope.sessionId&&state.approval.clientRequestId===a.clientRequestId)return view(row,scope.actorUserId);
    if(state.status!=='requested'||a.expectedVersion!==row.version)refuse();
    const next=await change(tx,row,{status:'approved',approval:{actorUserId:scope.actorUserId,sessionId:scope.sessionId,clientRequestId:a.clientRequestId,approvedAt:now().toISOString()}},scope.actorUserId,a.clientRequestId,a.expectedVersion);await principals(tx,scope,next);await source(tx,scope,c);return view(next,scope.actorUserId);
   });
  },
  /** Authenticated audit display only. Never conveys current source or execution authority. */
  async readHistory(rawScope:TicketReviewScope,id:string){const scope=ticketReviewScopeSchema.parse(rawScope);return repo.$transaction(async tx=>{const row=await load(tx,scope,id);await principals(tx,scope,row);await authority(tx,scope,scope.actorUserId,'reader',unpack(row,scope.organizationId).c);return view(row,scope.actorUserId,false,false)})},
  async get(rawScope:TicketReviewScope,id:string){const scope=ticketReviewScopeSchema.parse(rawScope);return repo.$transaction(async tx=>{const row=await load(tx,scope,id),{c}=unpack(row,scope.organizationId);await principals(tx,scope,row);let live=true;try{await source(tx,scope,c)}catch(e){if(!(e instanceof TicketReviewSourceChanged))throw e;live=false}let approvalAllowed=false;if(live&&unpack(row,scope.organizationId).state.status==='requested'&&![c.requesterUserId,c.executorUserId].includes(scope.actorUserId)){try{await authority(tx,scope,scope.actorUserId,'approver',c);approvalAllowed=true}catch{/* Reader access does not imply approval authority. */}}await authority(tx,scope,scope.actorUserId,'reader',c);return view(row,scope.actorUserId,live,approvalAllowed)})},
  async cancel(rawScope:TicketReviewScope,raw:unknown){const scope=ticketReviewScopeSchema.parse(rawScope),a=action.parse(raw);return repo.$transaction(async tx=>{const row=await load(tx,scope,a.id),{c,state}=unpack(row,scope.organizationId);if(![c.requesterUserId,state.approval?.actorUserId].includes(scope.actorUserId))refuse();await authority(tx,scope,scope.actorUserId,scope.actorUserId===c.requesterUserId?(c.kind==='servicenow_terminal_policy'?'policy_admin':'requester'):'approver',c);if(!['requested','approved'].includes(state.status)||a.expectedVersion!==row.version)refuse();const next=await change(tx,row,{...state,status:state.status==='requested'?'cancelled':'revoked'},scope.actorUserId,a.clientRequestId,a.expectedVersion);await authority(tx,scope,scope.actorUserId,'reader',c);return view(next,scope.actorUserId,false)})},
  /** Read-only provenance, never a provider permission or execution approval. */
  async readApproved(tx:ReleaseOperationPlanTransaction,rawScope:TicketReviewScope,id:string,rawBinding:unknown){
   const scope=ticketReviewScopeSchema.parse(rawScope),expected=ticketGovernanceBindingSchema.parse(rawBinding),row=await load(tx,scope,id),{c,state,input}=unpack(row,scope.organizationId);
   if(state.status!=='approved'||!state.approval||sha256ContentHash(expected)!==input.bindingDigest)refuse();await principals(tx,scope,row);await source(tx,scope,c);await authority(tx,scope,scope.actorUserId,'reader',c);await clock(tx,c);
   return{kind:'verified_ticket_governance_review_v1' as const,reviewId:row.id,bindingDigest:input.bindingDigest,approverUserId:state.approval!.actorUserId,binding:structuredClone(c)};
  },
 };
}
