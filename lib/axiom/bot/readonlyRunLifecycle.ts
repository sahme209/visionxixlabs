import {createHash} from 'node:crypto';
import {parseReadinessFacts,renderReadinessReport,READINESS_LIMITS,READINESS_RUN_STATUSES,READINESS_TERMINAL_STATUSES} from './readonlyRunContract';
import {ReadinessRunConflict,type ReadinessRunRepo,type ReadinessRunTransaction,type ReadinessRunRow,type ReadinessArtifact,type BoundTask} from './readonlyRunRepo';
import {savedBotTaskContentHash} from './savedTaskSchema';
import type {SavedBotTaskScope} from './savedTaskRepo';
export interface ReadinessWorkerBinding {runId:string;expectedRevision:number;snapshotDigest:string;workerId:string}
function clock(now:Date){if(!Number.isFinite(now.getTime()))throw new ReadinessRunConflict();return new Date(now.getTime())}
async function load(tx:ReadinessRunTransaction,scope:SavedBotTaskScope,id:string){
 if(!scope.organizationId.trim()||!scope.userId.trim()||!/^botrun_[a-f0-9]{64}$/.test(id))throw new ReadinessRunConflict();
 const row=await tx.botTaskRun.findFirst({where:{id,organizationId:scope.organizationId,createdByUserId:scope.userId}});
 if(!row||row.id!==id||row.organizationId!==scope.organizationId||row.createdByUserId!==scope.userId||!READINESS_RUN_STATUSES.includes(row.status))throw new ReadinessRunConflict();return row;
}
function bind(row:ReadinessRunRow,b:ReadinessWorkerBinding){if(!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||row.revision!==b.expectedRevision||row.snapshotDigest!==b.snapshotDigest||!/^worker_[a-f0-9]{32}$/.test(b.workerId))throw new ReadinessRunConflict()}
/** Every state change and its evidence share a transaction and revision CAS. */
async function change(tx:ReadinessRunTransaction,row:ReadinessRunRow,patch:Partial<ReadinessRunRow>,reason:string,now:Date,artifact?:ReadinessArtifact){
 const status=patch.status??row.status,payloadJson={reason},payloadBytes=Buffer.byteLength(JSON.stringify(payloadJson),'utf8');
 const storedBytes=row.storedBytes+payloadBytes+(artifact?Buffer.byteLength(artifact.content,'utf8'):0);
 if(row.eventCount>=READINESS_LIMITS.maxEvents||payloadBytes>READINESS_LIMITS.maxEventBytes||storedBytes>READINESS_LIMITS.maxTotalBytes)throw new ReadinessRunConflict();
 const next={...row,...patch,revision:row.revision+1,eventCount:row.eventCount+1,storedBytes,updatedAt:now};
 const result=await tx.botTaskRun.updateMany({where:{id:row.id,organizationId:row.organizationId,createdByUserId:row.createdByUserId,revision:row.revision,status:row.status,snapshotDigest:row.snapshotDigest,cancelRequested:row.cancelRequested},data:{...patch,revision:next.revision,eventCount:next.eventCount,storedBytes,updatedAt:now}});
 if(result.count!==1)throw new ReadinessRunConflict();
 if(artifact)await tx.botTaskArtifact.create({data:artifact});
 await tx.botTaskRunEvent.create({data:{organizationId:row.organizationId,createdByUserId:row.createdByUserId,runId:row.id,sequence:row.eventCount,eventType:`run.${status}`,payloadJson,occurredAt:now}});return next;
}
export async function claimReadinessRun(repo:ReadinessRunRepo,scope:SavedBotTaskScope,b:ReadinessWorkerBinding,at=new Date()){
 const now=clock(at);return repo.$transaction(async tx=>{const row=await load(tx,scope,b.runId);bind(row,b);
  if(row.status!=='queued'||row.attemptCount!==0||row.cancelRequested||row.deadlineAt<=now)throw new ReadinessRunConflict();
  return change(tx,row,{status:'running',attemptCount:1,leaseOwner:b.workerId,leaseExpiresAt:new Date(now.getTime()+READINESS_LIMITS.leaseMs)},'recorded_metadata_read_started',now);
 });
}
export async function cancelReadinessRun(repo:ReadinessRunRepo,scope:SavedBotTaskScope,id:string,expectedRevision:number,at=new Date()){
 const now=clock(at);return repo.$transaction(async tx=>{const row=await load(tx,scope,id);
  if(READINESS_TERMINAL_STATUSES.includes(row.status)||row.status==='cancel_requested')return row;
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||row.revision!==expectedRevision)throw new ReadinessRunConflict();
  return change(tx,row,row.status==='queued'?{status:'canceled',cancelRequested:true,leaseOwner:null,leaseExpiresAt:null}:{status:'cancel_requested',cancelRequested:true},'user_requested_cancellation',now);
 });
}
export async function recoverReadinessRun(repo:ReadinessRunRepo,scope:SavedBotTaskScope,id:string,at=new Date()){
 const now=clock(at);return repo.$transaction(async tx=>{const row=await load(tx,scope,id);
  if(READINESS_TERMINAL_STATUSES.includes(row.status))return row;
  const expired=row.deadlineAt<=now||(row.status!=='queued'&&(!row.leaseExpiresAt||row.leaseExpiresAt<=now));
  if(!expired)return row;
  return change(tx,row,{status:row.status==='queued'?'needs_attention':'outcome_unknown',leaseOwner:null,leaseExpiresAt:null},row.status==='queued'?'report_start_deadline_expired':'interrupted_read_outcome_unknown',now);
 });
}
/** Worker must independently recheck current membership/access and source bindings.
 * This only records the fixed local report, never approval or provider authority. */
export async function completeReadinessRun(repo:ReadinessRunRepo,scope:SavedBotTaskScope,b:ReadinessWorkerBinding,rawFacts:unknown,at=new Date()){
 const now=clock(at),facts=parseReadinessFacts(rawFacts),content=renderReadinessReport(facts),observedAt=new Date(facts.checkedAt);
 return repo.$transaction(async tx=>{const row=await load(tx,scope,b.runId);bind(row,b);
  if(row.status!=='running'||row.attemptCount!==1||row.cancelRequested||row.leaseOwner!==b.workerId||!row.leaseExpiresAt||row.leaseExpiresAt<=now||row.deadlineAt<=now||observedAt<row.createdAt||observedAt>now||facts.access.code!=='active')throw new ReadinessRunConflict();
  // Hold a share lock through the artifact/event commit. A concurrent task edit
  // either commits before this read and is rejected, or waits until report commit.
  const tasks=await tx.$queryRaw<BoundTask[]>`SELECT "id","organizationId","createdByUserId","version","status","title","instruction","context","contentHash" FROM "BotTaskDraft" WHERE "id"=${row.taskId} AND "organizationId"=${scope.organizationId} AND "createdByUserId"=${scope.userId} FOR SHARE`;
  const task=tasks[0];
  if(!task||task.version!==row.taskVersion||task.status!=='draft'||task.contentHash!==savedBotTaskContentHash(row.snapshotJson)||savedBotTaskContentHash({title:task.title,instruction:task.instruction,context:task.context})!==task.contentHash)throw new ReadinessRunConflict();
  const artifact:ReadinessArtifact={id:`botartifact_${row.id.slice(7)}`,organizationId:scope.organizationId,createdByUserId:scope.userId,runId:row.id,kind:'workspace_readiness_report',content,contentHash:createHash('sha256').update(content,'utf8').digest('hex'),snapshotDigest:row.snapshotDigest,observedAt,createdAt:now};
  return change(tx,row,{status:'completed',leaseOwner:null,leaseExpiresAt:null},'recorded_metadata_report_saved',now,artifact);
 });
}
export const getReadinessRun=(repo:ReadinessRunRepo,scope:SavedBotTaskScope,id:string)=>load(repo,scope,id);
export async function acknowledgeReadinessCancellation(repo:ReadinessRunRepo,scope:SavedBotTaskScope,b:ReadinessWorkerBinding,at=new Date()){
 const now=clock(at);return repo.$transaction(async tx=>{const row=await load(tx,scope,b.runId);
  if(row.status==='canceled')return row;
  if(row.status!=='cancel_requested'||!row.cancelRequested||row.leaseOwner!==b.workerId||row.snapshotDigest!==b.snapshotDigest||row.revision<b.expectedRevision||!row.leaseExpiresAt||row.leaseExpiresAt<=now||row.deadlineAt<=now)throw new ReadinessRunConflict();
  return change(tx,row,{status:'canceled',leaseOwner:null,leaseExpiresAt:null},'readers_stopped_after_cancellation',now);
 });
}
export type ReadinessFailureReason='current_access_changed'|'stored_task_changed'|'read_unavailable'|'read_budget_expired';
export async function failReadinessRun(repo:ReadinessRunRepo,scope:SavedBotTaskScope,b:ReadinessWorkerBinding,reason:ReadinessFailureReason,outcomeUnknown:boolean,at=new Date()){
 const now=clock(at);if(!['current_access_changed','stored_task_changed','read_unavailable','read_budget_expired'].includes(reason))throw new ReadinessRunConflict();
 return repo.$transaction(async tx=>{const row=await load(tx,scope,b.runId);
  if(READINESS_TERMINAL_STATUSES.includes(row.status))return row;
  if(!['running','cancel_requested'].includes(row.status)||row.leaseOwner!==b.workerId||row.snapshotDigest!==b.snapshotDigest||row.revision<b.expectedRevision)throw new ReadinessRunConflict();
  return change(tx,row,{status:outcomeUnknown?'outcome_unknown':'failed',leaseOwner:null,leaseExpiresAt:null},reason,now);
 });
}
