import {assertAiTaskEvidenceContextCurrent} from './aiTaskEvidenceContext';
import {createHash} from 'node:crypto';
import {AI_TASK_LIMITS,AI_TASK_STATUSES,AI_TASK_TERMINAL,parseAiTaskSnapshot,aiTaskSnapshotDigest,parseAiTaskAnswer} from './aiTaskContract';
import {decideAiTaskTransition} from './aiTaskTransition';
import {AiTaskConflict,type AiTaskRepo,type AiTaskTransaction,type AiTaskRow,type AiTaskArtifact} from './aiTaskRepo';
import {savedBotTaskContentHash,type SavedBotTaskContent} from './savedTaskSchema';
import type {SavedBotTaskScope} from './savedTaskRepo';
export interface AiTaskWorkerBinding {runId:string;expectedRevision:number;snapshotDigest:string;workerId:string}
/** Internal worker supplies this only after reading the linked reservation and usage event.
 * This value is never accepted from an HTTP body or from model output. */
export interface AiTaskAccountingEvidence {usageReceiptId:string;correlationId:string;organizationId:string;userId:string;modelId:string}
function clock(at:Date){if(!Number.isFinite(at.getTime()))throw new AiTaskConflict();return new Date(at.getTime())}
async function load(tx:AiTaskTransaction,scope:SavedBotTaskScope,id:string){
 if(!scope.organizationId.trim()||!scope.userId.trim()||!/^botai_[a-f0-9]{64}$/.test(id))throw new AiTaskConflict();
 const row=await tx.botAiTaskRun.findFirst({where:{id,organizationId:scope.organizationId,createdByUserId:scope.userId}});
 if(!row||row.id!==id||row.organizationId!==scope.organizationId||row.createdByUserId!==scope.userId||!AI_TASK_STATUSES.includes(row.status))throw new AiTaskConflict();
 const snap=parseAiTaskSnapshot(row.snapshotJson);
 if(aiTaskSnapshotDigest(snap)!==row.snapshotDigest||snap.organizationId!==scope.organizationId||snap.userId!==scope.userId||snap.taskId!==row.taskId||snap.taskVersion!==row.taskVersion||snap.modelId!==row.modelId)throw new AiTaskConflict();return row;
}
function bind(row:AiTaskRow,b:AiTaskWorkerBinding,leased=false){if(!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||row.revision!==b.expectedRevision||row.snapshotDigest!==b.snapshotDigest||!/^worker_[a-f0-9]{32}$/.test(b.workerId)||(leased&&row.leaseOwner!==b.workerId))throw new AiTaskConflict()}
function fence(row:AiTaskRow,authority:string,receipt=false){return{status:row.status,attemptCount:row.attemptCount,deadline:row.deadlineAt.getTime(),leaseExpiresAt:row.leaseExpiresAt?.getTime()??row.deadlineAt.getTime(),cancelRequested:row.cancelRequested,sourceCurrent:true,authorityCurrent:row.snapshotJson.authorityDigest===authority,receiptVerified:receipt}}
async function lockSource(tx:AiTaskTransaction,row:AiTaskRow){
 const tasks=await tx.$queryRaw<Array<SavedBotTaskContent&{id:string;organizationId:string;createdByUserId:string;version:number;status:string;contentHash:string}>>`SELECT "id","organizationId","createdByUserId","version","status","title","instruction","context","contentHash" FROM "BotTaskDraft" WHERE "id"=${row.taskId} AND "organizationId"=${row.organizationId} AND "createdByUserId"=${row.createdByUserId} FOR SHARE`;
 const task=tasks[0];
 if(tasks.length!==1||!task||task.id!==row.taskId||task.organizationId!==row.organizationId||task.createdByUserId!==row.createdByUserId||task.version!==row.taskVersion||task.status!=='draft'||task.contentHash!==row.snapshotJson.contentHash||savedBotTaskContentHash({title:task.title,instruction:task.instruction,context:task.context})!==task.contentHash)throw new AiTaskConflict();
 await assertAiTaskEvidenceContextCurrent(tx,{organizationId:row.organizationId,userId:row.createdByUserId},row.snapshotJson);
}
async function assertDatabaseLive(tx:AiTaskTransaction,row:AiTaskRow){
 if(!row.leaseExpiresAt)throw new AiTaskConflict();
 const rows=await tx.$queryRaw<Array<{live:boolean}>>`SELECT clock_timestamp() < ${row.deadlineAt} AND clock_timestamp() < ${row.leaseExpiresAt} AS "live"`;
 if(rows.length!==1||rows[0].live!==true)throw new AiTaskConflict();
}
async function change(tx:AiTaskTransaction,row:AiTaskRow,patch:Partial<AiTaskRow>,reason:string,now:Date,artifact?:AiTaskArtifact,liveFence=false){
 const payloadJson={reason},bytes=Buffer.byteLength(JSON.stringify(payloadJson));
 const storedBytes=row.storedBytes+bytes+(artifact?Buffer.byteLength(artifact.content):0);
 if(row.eventCount>=AI_TASK_LIMITS.maxEvents||bytes>AI_TASK_LIMITS.maxEventBytes||storedBytes>AI_TASK_LIMITS.maxTotalBytes)throw new AiTaskConflict();
 const data={...patch,revision:row.revision+1,eventCount:row.eventCount+1,storedBytes,updatedAt:now};
 const where={id:row.id,organizationId:row.organizationId,createdByUserId:row.createdByUserId,revision:row.revision,status:row.status,attemptCount:row.attemptCount,snapshotDigest:row.snapshotDigest,cancelRequested:row.cancelRequested,...(liveFence?{deadlineAt:{gt:now},leaseExpiresAt:{gt:now}}:{})};
 const result=await tx.botAiTaskRun.updateMany({where,data});
 if(result.count!==1)throw new AiTaskConflict();
 // updateMany may itself wait on a row lock. Check database time, not the
 // timestamp captured before that wait, before publishing any result.
 if(liveFence)await assertDatabaseLive(tx,row);
 if(artifact)await tx.botAiTaskArtifact.create({data:artifact});
 await tx.botAiTaskEvent.create({data:{organizationId:row.organizationId,createdByUserId:row.createdByUserId,runId:row.id,sequence:row.eventCount,eventType:`run.${patch.status??row.status}`,payloadJson,occurredAt:now}});
 // Event/artifact insertion may also wait. A late transaction must roll
 // back; existing deferred database guards additionally enforce commit time.
 if(liveFence)await assertDatabaseLive(tx,row);
 return{...row,...data};
}
export async function claimAiTaskRun(repo:AiTaskRepo,scope:SavedBotTaskScope,b:AiTaskWorkerBinding,at=new Date()){
 const now=clock(at);return repo.$transaction(async tx=>{const row=await load(tx,scope,b.runId);bind(row,b);
 if(row.status!=='queued'||row.attemptCount!==0||row.cancelRequested||row.deadlineAt<=now)throw new AiTaskConflict();
 return change(tx,row,{status:'preparing',leaseOwner:b.workerId,leaseExpiresAt:new Date(now.getTime()+AI_TASK_LIMITS.leaseMs)},'preparing_saved_task',now)});
}
export async function claimAiTaskDispatch(repo:AiTaskRepo,scope:SavedBotTaskScope,b:AiTaskWorkerBinding,authorityDigest:string,at?:Date){
 clock(at??new Date());return repo.$transaction(async tx=>{const row=await load(tx,scope,b.runId);bind(row,b,true);
 decideAiTaskTransition(fence(row,authorityDigest),'dispatch',clock(at??new Date()).getTime());await lockSource(tx,row);
 const now=clock(at??new Date()),next=decideAiTaskTransition(fence(row,authorityDigest),'dispatch',now.getTime());
 return change(tx,row,{...next,dispatchClaimedAt:now},'single_dispatch_claimed',now,undefined,true)});
}
export async function cancelAiTaskRun(repo:AiTaskRepo,scope:SavedBotTaskScope,id:string,expectedRevision:number,at=new Date()){
 const now=clock(at);return repo.$transaction(async tx=>{const row=await load(tx,scope,id);
 if(AI_TASK_TERMINAL.includes(row.status)||row.status==='cancel_requested')return row;
 if(!Number.isSafeInteger(expectedRevision)||row.revision!==expectedRevision)throw new AiTaskConflict();
 const next=decideAiTaskTransition(fence(row,row.snapshotJson.authorityDigest),'cancel',now.getTime());
 return change(tx,row,{...next,cancelRequested:true,...(next.status==='canceled'?{leaseOwner:null,leaseExpiresAt:null}:{})},'user_requested_cancellation',now)});
}
export async function recoverAiTaskRun(repo:AiTaskRepo,scope:SavedBotTaskScope,id:string,at=new Date()){
 const now=clock(at);return repo.$transaction(async tx=>{const row=await load(tx,scope,id);if(AI_TASK_TERMINAL.includes(row.status))return row;
 if(row.deadlineAt>now&&(row.status==='queued'||(row.leaseExpiresAt&&row.leaseExpiresAt>now)))return row;
 const next=decideAiTaskTransition(fence(row,row.snapshotJson.authorityDigest),'recover',now.getTime());
 return change(tx,row,{...next,leaseOwner:null,leaseExpiresAt:null},next.status==='outcome_unknown'?'dispatch_outcome_unknown':'preparation_expired',now)});
}
export async function completeAiTaskRun(repo:AiTaskRepo,scope:SavedBotTaskScope,b:AiTaskWorkerBinding,authorityDigest:string,answer:unknown,evidence:AiTaskAccountingEvidence|null,at?:Date){
 clock(at??new Date());const parsed=parseAiTaskAnswer(answer),content=JSON.stringify(parsed);
 return repo.$transaction(async tx=>{const row=await load(tx,scope,b.runId);bind(row,b,true);
 const valid=!!evidence&&evidence.usageReceiptId.trim().length>0&&evidence.usageReceiptId.length<=1024&&evidence.organizationId===row.organizationId&&evidence.userId===row.createdByUserId&&evidence.correlationId===row.correlationId&&evidence.modelId===row.modelId;
 decideAiTaskTransition(fence(row,authorityDigest,valid),parsed.kind==='answer'?'answer':'clarification',clock(at??new Date()).getTime());await lockSource(tx,row);
 const now=clock(at??new Date()),next=decideAiTaskTransition(fence(row,authorityDigest,valid),parsed.kind==='answer'?'answer':'clarification',now.getTime());
 const usageReceiptId=evidence!.usageReceiptId;
 const artifact:AiTaskArtifact={id:`botaiartifact_${row.id.slice(6)}`,organizationId:row.organizationId,createdByUserId:row.createdByUserId,runId:row.id,kind:parsed.kind==='answer'?'ai_task_answer':'ai_task_clarification',content,contentHash:createHash('sha256').update(content).digest('hex'),snapshotDigest:row.snapshotDigest,usageReceiptId,createdAt:now};
 return change(tx,row,{...next,usageReceiptId,leaseOwner:null,leaseExpiresAt:null},'verified_ai_result_saved',now,artifact,true)});
}
export const getAiTaskRun=(repo:AiTaskRepo,scope:SavedBotTaskScope,id:string)=>load(repo,scope,id);
export type AiTaskFailureReason='current_access_changed'|'stored_task_changed'|'model_unavailable'|'execution_budget_expired'|'receipt_unverified';
/** Never release a credit hold here. A dispatched failure is uncertain, not free. */
export async function failAiTaskRun(repo:AiTaskRepo,scope:SavedBotTaskScope,b:AiTaskWorkerBinding,reason:AiTaskFailureReason,at=new Date()){
 const now=clock(at);
 if(!['current_access_changed','stored_task_changed','model_unavailable','execution_budget_expired','receipt_unverified'].includes(reason))throw new AiTaskConflict();
 return repo.$transaction(async tx=>{const row=await load(tx,scope,b.runId);
 if(AI_TASK_TERMINAL.includes(row.status))return row;
 if(!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||row.revision<b.expectedRevision||row.snapshotDigest!==b.snapshotDigest||row.leaseOwner!==b.workerId||!/^worker_[a-f0-9]{32}$/.test(b.workerId)||!['preparing','dispatching','cancel_requested'].includes(row.status))throw new AiTaskConflict();
 const dispatched=row.attemptCount===1;
 if(dispatched!==!!row.dispatchClaimedAt)throw new AiTaskConflict();
 return change(tx,row,{status:dispatched?'outcome_unknown':'failed',leaseOwner:null,leaseExpiresAt:null},reason,now)});
}
