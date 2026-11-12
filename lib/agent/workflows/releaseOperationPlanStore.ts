import { databaseErrorCode } from "@/lib/database/databaseErrorCode";
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {buildReleaseMergePlan} from '@/lib/tauri/releaseMergePlan';
import {RELEASE_OPERATION_PLAN_KIND,parseReleaseOperationPlan,parseReleaseOperationPlanInput,parseReleaseOperationPlanDto,type ReleaseOperationPlan,type ReleaseOperationPlanDto,type ReleaseOperationPlanInput} from '@/lib/tauri/releaseOperationPlanContract';
const identity=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f]/.test(v));
export interface ReleaseOperationPlanRow {id:string;organizationId:string;workflowKind:string;requestedByUserId:string;status:string;currentStep:string|null;inputJson:unknown;stateJson:unknown;attemptCount:number;maxAttempts:number;version:number;leaseOwner:string|null;leaseExpiresAt:Date|null;approvalProposalId:string|null;createdAt:Date;updatedAt:Date}
export interface ReleaseOperationPlanEvent {workflowRunId:string;organizationId:string;sequence:number;eventType:string;actorKind:string;actorId:string|null;detailJson:unknown;occurredAt:Date}
export interface ReleaseOperationPlanTransaction {
 $queryRaw<T=unknown>(query:TemplateStringsArray,...values:unknown[]):Promise<T>;
 durableAgentWorkflow:{findFirst(args:{where:Record<string,unknown>}):Promise<ReleaseOperationPlanRow|null>;findMany(args:{where:Record<string,unknown>;orderBy:Record<string,string>[];take:number}):Promise<ReleaseOperationPlanRow[]>;create(args:{data:Record<string,unknown>}):Promise<ReleaseOperationPlanRow>;updateMany(args:{where:Record<string,unknown>;data:Record<string,unknown>}):Promise<{count:number}>};
 durableAgentWorkflowEvent:{findMany(args:{where:Record<string,unknown>;orderBy:{sequence:'asc'};take:number}):Promise<ReleaseOperationPlanEvent[]>;create(args:{data:ReleaseOperationPlanEvent}):Promise<unknown>};
}
export interface ReleaseOperationPlanRepo extends ReleaseOperationPlanTransaction {$transaction<T>(fn:(tx:ReleaseOperationPlanTransaction)=>Promise<T>,options?:{maxWait?:number;timeout?:number}):Promise<T>}
export type ReleasePlanAuthority=(tx:ReleaseOperationPlanTransaction)=>Promise<void>;
type Scope={organizationId:string;actorUserId:string;assertCurrent:ReleasePlanAuthority};
export class ReleaseOperationPlanConflict extends Error {constructor(){super('Release plan changed or is unavailable. Refresh the stored release and review again.');this.name='ReleaseOperationPlanConflict'}}
export function releaseOperationPlanId(organizationId:string,requestId:string,requestVersion:number,planDigest:string){return 'release_plan_'+sha256ContentHash([identity.parse(organizationId),identity.parse(requestId),z.number().int().positive().parse(requestVersion),z.string().regex(/^[a-f0-9]{64}$/).parse(planDigest)])}
function now(at?:Date){const d=new Date((at??new Date()).getTime());if(!Number.isFinite(d.getTime()))throw new ReleaseOperationPlanConflict();return d}
function scope(input:Scope){identity.parse(input.organizationId);identity.parse(input.actorUserId);if(typeof input.assertCurrent!=='function')throw new ReleaseOperationPlanConflict()}
function unpack(row:ReleaseOperationPlanRow,organizationId:string){
 const input=parseReleaseOperationPlanInput(row.inputJson);
 if(row.organizationId!==organizationId||row.workflowKind!==RELEASE_OPERATION_PLAN_KIND||input.plan.organizationId!==organizationId||sha256ContentHash(input.plan)!==input.planDigest||row.id!==releaseOperationPlanId(organizationId,input.plan.requestId,input.plan.requestVersion,input.planDigest)||row.attemptCount!==0||row.maxAttempts!==1||row.leaseOwner||row.leaseExpiresAt||row.approvalProposalId||row.createdAt.toISOString()!==new Date(input.createdAt).toISOString())throw new ReleaseOperationPlanConflict();
 const state=z.object({reviewStatus:z.enum(['pending_review','reviewed','rejected','stale','cancelled'])}).strict().parse(row.stateJson);
 if(state.reviewStatus==='pending_review'?(row.status!=='paused_for_input'||row.currentStep!=='review_plan'):(row.status!==(state.reviewStatus==='cancelled'?'cancelled':'completed')||row.currentStep!==state.reviewStatus))throw new ReleaseOperationPlanConflict();
 return{input,status:state.reviewStatus};
}
async function membership(tx:ReleaseOperationPlanTransaction,input:Scope){
 const rows=await tx.$queryRaw<Array<{id:string;organizationId:string;userId:string;acceptedAt:Date|null}>>`SELECT "id","organizationId","userId","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${input.organizationId} AND "userId"=${input.actorUserId} FOR SHARE`;
 if(rows.length!==1||rows[0].organizationId!==input.organizationId||rows[0].userId!==input.actorUserId||!rows[0].acceptedAt)throw new ReleaseOperationPlanConflict();await input.assertCurrent(tx);
}
async function source(tx:ReleaseOperationPlanTransaction,organizationId:string,plan:ReleaseOperationPlan){
 const rows=await tx.$queryRaw<Array<{id:string;organizationId:string;requesterUserId:string;version:number;status:string;intakeJson:unknown}>>`SELECT "id","organizationId","requesterUserId","version","status","intakeJson" FROM "TauriDeploymentRequest" WHERE "id"=${plan.requestId} AND "organizationId"=${organizationId} FOR SHARE`;
 const release=rows[0];
 const connections=await tx.$queryRaw<Array<{id:string;organizationId:string;status:string;updatedAt:Date;githubInstallationId:string;revokedAt:Date|null;suspendedAt:Date|null}>>`SELECT "id","organizationId","status","updatedAt","githubInstallationId","revokedAt","suspendedAt" FROM "GitHubInstallation" WHERE "id"=${plan.connectionId} AND "organizationId"=${organizationId} FOR SHARE`;
 const connection=connections[0];
 if(rows.length!==1||connections.length!==1||!release||!connection||connection.organizationId!==organizationId||connection.id!==plan.connectionId||connection.status!=='active'||connection.revokedAt||connection.suspendedAt||!/^[1-9][0-9]*$/.test(connection.githubInstallationId)||connection.updatedAt.getTime()!==Date.parse(plan.connectionRevision))return null;
 const built=buildReleaseMergePlan(release,{organizationId,requestId:plan.requestId,expectedVersion:plan.requestVersion,expectedDigest:plan.intakeDigest,method:plan.method,observation:{connectionId:plan.connectionId,connectionRevision:plan.connectionRevision,repositoryFullName:plan.pullRequest.repositoryFullName,number:plan.pullRequest.number,headRepositoryFullName:plan.pullRequest.repositoryFullName,headRef:plan.pullRequest.headRef,headSha:plan.pullRequest.headSha,baseRef:plan.pullRequest.baseRef,baseSha:plan.pullRequest.baseSha,state:'open',draft:false,merged:false}});
 if(!built.ok||built.digest!==sha256ContentHash(plan)||!identity.safeParse(release.requesterUserId).success)return null;return release;
}
async function history(tx:ReleaseOperationPlanTransaction,row:ReleaseOperationPlanRow){
 const events=await tx.durableAgentWorkflowEvent.findMany({where:{organizationId:row.organizationId,workflowRunId:row.id},orderBy:{sequence:'asc'},take:21});
 const bound=unpack(row,row.organizationId);
 if(!events.length||events.length>20||events.length!==row.version+1||events.some((event,index)=>event.workflowRunId!==row.id||event.organizationId!==row.organizationId||event.sequence!==index||!Number.isFinite(event.occurredAt.getTime()))||events[0].eventType!=='release_plan.created'||events[0].actorId!==row.requestedByUserId||events.at(-1)!.eventType!=='release_plan.'+(bound.status==='pending_review'?'created':bound.status))throw new ReleaseOperationPlanConflict();
 for(const entry of events.slice(1)){if(!entry.actorId||entry.eventType==='release_plan.cancelled'&&entry.actorId!==row.requestedByUserId||['release_plan.reviewed','release_plan.rejected'].includes(entry.eventType)&&(entry.actorId===row.requestedByUserId||entry.actorId===bound.input.releaseRequesterUserId))throw new ReleaseOperationPlanConflict()}
 return events;
}
function dto(row:ReleaseOperationPlanRow,events:ReleaseOperationPlanEvent[],actorUserId:string,canManage:boolean,live:boolean):ReleaseOperationPlanDto{
 const {input,status}=unpack(row,row.organizationId),pending=status==='pending_review',projected=(pending||status==='reviewed')&&!live?'stale':status;
 return parseReleaseOperationPlanDto({id:row.id,version:row.version,requestId:input.plan.requestId,requestVersion:input.plan.requestVersion,planDigest:input.planDigest,plan:input.plan,status:projected,createdAt:input.createdAt,deadlineAt:input.deadlineAt,executionAvailable:false,canReview:canManage&&pending&&live&&actorUserId!==row.requestedByUserId&&actorUserId!==input.releaseRequesterUserId,canCancel:canManage&&pending&&actorUserId===row.requestedByUserId,history:events.map(event=>({sequence:event.sequence,type:event.eventType.replace('release_plan.',''),at:event.occurredAt.toISOString(),actorKind:event.eventType==='release_plan.created'||event.eventType==='release_plan.cancelled'?'creator':event.eventType==='release_plan.stale'?'system':'independent_reviewer'}))});
}
async function loadLocked(tx:ReleaseOperationPlanTransaction,input:Scope&idInput){
 if(!/^release_plan_[a-f0-9]{64}$/.test(input.id))throw new ReleaseOperationPlanConflict();
 const rows=await tx.$queryRaw<ReleaseOperationPlanRow[]>`SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${input.id} AND "organizationId"=${input.organizationId} AND "workflowKind"=${RELEASE_OPERATION_PLAN_KIND} FOR UPDATE`;
 if(rows.length!==1||rows[0].id!==input.id)throw new ReleaseOperationPlanConflict();unpack(rows[0],input.organizationId);return rows[0];
}
type idInput={id:string};
async function event(tx:ReleaseOperationPlanTransaction,row:ReleaseOperationPlanRow,type:string,actorUserId:string,detailJson:unknown,at:Date){await tx.durableAgentWorkflowEvent.create({data:{workflowRunId:row.id,organizationId:row.organizationId,sequence:row.version,eventType:'release_plan.'+type,actorKind:'user',actorId:actorUserId,detailJson,occurredAt:at}})}
export async function createReleaseOperationPlan(repo:ReleaseOperationPlanRepo,input:Scope&{plan:unknown;planDigest:string},at?:Date){
 scope(input);const plan=parseReleaseOperationPlan(input.plan);if(plan.organizationId!==input.organizationId||sha256ContentHash(plan)!==input.planDigest)throw new ReleaseOperationPlanConflict();const captured=now(at),id=releaseOperationPlanId(input.organizationId,plan.requestId,plan.requestVersion,input.planDigest);
 for(let retry=0;;retry++)try{return await repo.$transaction(async tx=>{
  await membership(tx,input);const current=await source(tx,input.organizationId,plan);await input.assertCurrent(tx);
  const existing=await tx.durableAgentWorkflow.findFirst({where:{id,organizationId:input.organizationId,workflowKind:RELEASE_OPERATION_PLAN_KIND}});
  if(existing){const stored=unpack(existing,input.organizationId);if(stored.input.planDigest!==input.planDigest)throw new ReleaseOperationPlanConflict();const recorded=await history(tx,existing);await input.assertCurrent(tx);return dto(existing,recorded,input.actorUserId,true,!!current&&current.requesterUserId===stored.input.releaseRequesterUserId&&now(at).getTime()<Date.parse(stored.input.deadlineAt))}
  if(!current||now(at).getTime()>=Date.parse(plan.window.endUtc))throw new ReleaseOperationPlanConflict();
  const binding=parseReleaseOperationPlanInput({format:1,plan,planDigest:input.planDigest,releaseRequesterUserId:current.requesterUserId,createdAt:captured.toISOString(),deadlineAt:new Date(plan.window.endUtc).toISOString()});
  await input.assertCurrent(tx);
  const row=await tx.durableAgentWorkflow.create({data:{id,organizationId:input.organizationId,workflowKind:RELEASE_OPERATION_PLAN_KIND,objective:'Review exact release merge plan; execution unavailable',status:'paused_for_input',autonomyLevel:'observe',currentStep:'review_plan',inputJson:binding,stateJson:{reviewStatus:'pending_review'},requestedByUserId:input.actorUserId,attemptCount:0,maxAttempts:1,version:0,leaseOwner:null,leaseExpiresAt:null,approvalProposalId:null,nextAttemptAt:null,createdAt:captured,updatedAt:captured}});
  await event(tx,row,'created',input.actorUserId,{planDigest:input.planDigest},captured);const recorded=await history(tx,row);await input.assertCurrent(tx);await assertWindow(tx,binding.deadlineAt);return dto(row,recorded,input.actorUserId,true,true);
 });}catch(error){const code=databaseErrorCode(error);if(retry>=2||!['P2002','P2034'].includes(String(code)))throw error}
}
export async function listReleaseOperationPlans(repo:ReleaseOperationPlanRepo,input:Scope&{requestId:string;canManage:boolean},at?:Date){
 scope(input);identity.parse(input.requestId);return repo.$transaction(async tx=>{await membership(tx,input);const rows=await tx.durableAgentWorkflow.findMany({where:{organizationId:input.organizationId,workflowKind:RELEASE_OPERATION_PLAN_KIND,inputJson:{path:['plan','requestId'],equals:input.requestId}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:6});if(rows.length>6)throw new ReleaseOperationPlanConflict();const plans=[];
 for(const row of rows.slice(0,5)){const bound=unpack(row,input.organizationId);if(bound.input.plan.requestId!==input.requestId)throw new ReleaseOperationPlanConflict();const current=await source(tx,input.organizationId,bound.input.plan);plans.push(dto(row,await history(tx,row),input.actorUserId,input.canManage,!!current&&current.requesterUserId===bound.input.releaseRequesterUserId&&now(at).getTime()<Date.parse(bound.input.deadlineAt)))}await input.assertCurrent(tx);return{plans,truncated:rows.length>5};});
}
/** Exact private lookup inside the caller's transaction. Reuses the same
 * membership, source, history and deadline checks as the existing list view;
 * unlike a bounded list, it cannot lose a selected older plan to pagination. */
export async function readReleaseOperationPlanInTransaction(tx:ReleaseOperationPlanTransaction,input:Scope&idInput&{canManage:boolean},at?:Date){
 scope(input);const row=await loadLocked(tx,input);await membership(tx,input);const bound=unpack(row,input.organizationId),events=await history(tx,row);
 const current=await source(tx,input.organizationId,bound.input.plan);await input.assertCurrent(tx);
 return dto(row,events,input.actorUserId,input.canManage,!!current&&current.requesterUserId===bound.input.releaseRequesterUserId&&now(at).getTime()<Date.parse(bound.input.deadlineAt));
}
function actionId(value:string){return z.string().uuid().parse(value)}
function replay(events:ReleaseOperationPlanEvent[],clientRequestId:string,actorUserId:string,type:string,expectedVersion:number){const match=events.find(e=>!!e.detailJson&&typeof e.detailJson==='object'&&'actionId'in e.detailJson&&e.detailJson.actionId===clientRequestId);if(!match)return false;if(!match.detailJson||typeof match.detailJson!=='object'||!('expectedVersion'in match.detailJson)||match.detailJson.expectedVersion!==expectedVersion||match.actorId!==actorUserId||match.eventType!=='release_plan.'+type&&!(match.eventType==='release_plan.stale'&&!!match.detailJson&&typeof match.detailJson==='object'&&'requestedDecision'in match.detailJson&&match.detailJson.requestedDecision===type))throw new ReleaseOperationPlanConflict();return true}
async function assertWindow(tx:ReleaseOperationPlanTransaction,deadlineAt:string){
 const rows=await tx.$queryRaw<Array<{live:boolean}>>`SELECT clock_timestamp() < ${new Date(deadlineAt)} AS "live"`;
 if(rows.length!==1||rows[0].live!==true)throw new ReleaseOperationPlanConflict();
}
async function transition(tx:ReleaseOperationPlanTransaction,row:ReleaseOperationPlanRow,input:Scope&{expectedVersion:number;clientRequestId:string;decision?:'reviewed'|'rejected'},type:'reviewed'|'rejected'|'stale'|'cancelled',at:Date){
 const bound=unpack(row,input.organizationId);if(bound.status!=='pending_review'||row.version!==input.expectedVersion||!Number.isSafeInteger(input.expectedVersion))throw new ReleaseOperationPlanConflict();await input.assertCurrent(tx);
 const changed=await tx.durableAgentWorkflow.updateMany({where:{id:row.id,organizationId:input.organizationId,workflowKind:RELEASE_OPERATION_PLAN_KIND,version:row.version,status:'paused_for_input',currentStep:'review_plan',attemptCount:0,maxAttempts:1,leaseOwner:null,leaseExpiresAt:null,approvalProposalId:null,inputJson:{equals:bound.input}},data:{status:type==='cancelled'?'cancelled':'completed',currentStep:type,stateJson:{reviewStatus:type},version:{increment:1},completedAt:at,...(type==='cancelled'?{cancelRequestedAt:at,cancelledAt:at}:{}),updatedAt:at}});if(changed.count!==1)throw new ReleaseOperationPlanConflict();if(type==='reviewed'||type==='rejected')await assertWindow(tx,bound.input.deadlineAt);const next={...row,version:row.version+1,status:type==='cancelled'?'cancelled':'completed',currentStep:type,stateJson:{reviewStatus:type},updatedAt:at};await event(tx,next,type,input.actorUserId,{actionId:input.clientRequestId,expectedVersion:input.expectedVersion,...(input.decision?{requestedDecision:input.decision}:{})},at);if(type==='reviewed'||type==='rejected')await assertWindow(tx,bound.input.deadlineAt);return next;
}
export async function reviewReleaseOperationPlan(repo:ReleaseOperationPlanRepo,input:Scope&idInput&{expectedVersion:number;clientRequestId:string;decision:'reviewed'|'rejected';currentPlan:unknown;currentPlanDigest:string},at?:Date){
 scope(input);actionId(input.clientRequestId);if(!['reviewed','rejected'].includes(input.decision))throw new ReleaseOperationPlanConflict();const fresh=parseReleaseOperationPlan(input.currentPlan);if(fresh.organizationId!==input.organizationId||sha256ContentHash(fresh)!==input.currentPlanDigest)throw new ReleaseOperationPlanConflict();
 return repo.$transaction(async tx=>{const row=await loadLocked(tx,input);await membership(tx,input);const bound=unpack(row,input.organizationId);if(input.actorUserId===row.requestedByUserId||input.actorUserId===bound.input.releaseRequesterUserId)throw new ReleaseOperationPlanConflict();const events=await history(tx,row);
 if(replay(events,input.clientRequestId,input.actorUserId,input.decision,input.expectedVersion)){const current=await source(tx,input.organizationId,bound.input.plan);await input.assertCurrent(tx);return dto(row,events,input.actorUserId,true,!!current&&current.requesterUserId===bound.input.releaseRequesterUserId&&now(at).getTime()<Date.parse(bound.input.deadlineAt)&&input.currentPlanDigest===bound.input.planDigest)}
 const current=await source(tx,input.organizationId,bound.input.plan);await input.assertCurrent(tx);const stale=!current||current.requesterUserId!==bound.input.releaseRequesterUserId||now(at).getTime()>=Date.parse(bound.input.deadlineAt)||input.currentPlanDigest!==bound.input.planDigest||sha256ContentHash(fresh)!==sha256ContentHash(bound.input.plan);
 const next=await transition(tx,row,input,stale?'stale':input.decision,now(at));const recorded=await history(tx,next);await input.assertCurrent(tx);if(!stale)await assertWindow(tx,bound.input.deadlineAt);return dto(next,recorded,input.actorUserId,true,!stale);
 });
}
export async function cancelReleaseOperationPlan(repo:ReleaseOperationPlanRepo,input:Scope&idInput&{expectedVersion:number;clientRequestId:string},at?:Date){
 scope(input);actionId(input.clientRequestId);return repo.$transaction(async tx=>{const row=await loadLocked(tx,input);await membership(tx,input);if(row.requestedByUserId!==input.actorUserId)throw new ReleaseOperationPlanConflict();const events=await history(tx,row);if(replay(events,input.clientRequestId,input.actorUserId,'cancelled',input.expectedVersion)){await input.assertCurrent(tx);return dto(row,events,input.actorUserId,true,false)}const next=await transition(tx,row,input,'cancelled',now(at));const recorded=await history(tx,next);await input.assertCurrent(tx);return dto(next,recorded,input.actorUserId,true,false)});
}
