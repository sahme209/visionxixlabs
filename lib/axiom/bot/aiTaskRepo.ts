import { databaseErrorCode } from "@/lib/database/databaseErrorCode";
import {loadAiTaskEvidenceContext} from './aiTaskEvidenceContext';
import {parseAiTaskInput,aiTaskRunId,aiTaskIntentHash,aiTaskSnapshot,aiTaskSnapshotDigest,aiTaskCorrelationId,AI_TASK_LIMITS,type AiTaskSnapshot,type AiTaskStatus} from './aiTaskContract';
import {savedBotTaskContentHash,type SavedBotTaskContent} from './savedTaskSchema';
import type {SavedBotTaskScope} from './savedTaskRepo';
type Owned={id:string;organizationId:string;createdByUserId:string};
export interface AiTaskRow extends Owned {
 taskId:string;taskVersion:number;clientRequestId:string;kind:'ai_task_response_v1';modelId:string;correlationId:string;
 intentHash:string;snapshotJson:AiTaskSnapshot;snapshotDigest:string;status:AiTaskStatus;
 revision:number;attemptCount:number;eventCount:number;storedBytes:number;cancelRequested:boolean;
 leaseOwner:string|null;leaseExpiresAt:Date|null;dispatchClaimedAt:Date|null;usageReceiptId:string|null;
 createdAt:Date;updatedAt:Date;deadlineAt:Date;
}
export interface AiTaskEvent {organizationId:string;createdByUserId:string;runId:string;sequence:number;eventType:string;payloadJson:Record<string,string>;occurredAt:Date}
export interface AiTaskArtifact extends Owned {runId:string;kind:"ai_task_answer"|"ai_task_clarification";content:string;contentHash:string;snapshotDigest:string;usageReceiptId:string;createdAt:Date}
export interface AiTaskTransaction {
 $queryRaw<T=unknown>(query:TemplateStringsArray,...values:unknown[]):Promise<T>;
 botAiTaskArtifact:{create(args:{data:AiTaskArtifact}):Promise<unknown>};
 botTaskDraft:{findFirst(args:{where:Owned}):Promise<(Owned&SavedBotTaskContent&{version:number;status:string;contentHash:string})|null>};
 botAiTaskRun:{findFirst(args:{where:Owned}):Promise<AiTaskRow|null>;create(args:{data:AiTaskRow}):Promise<AiTaskRow>;updateMany(args:{where:Owned&Pick<AiTaskRow,"revision"|"status"|"attemptCount"|"snapshotDigest"|"cancelRequested">;data:Partial<AiTaskRow>}):Promise<{count:number}>};
 botAiTaskEvent:{create(args:{data:AiTaskEvent}):Promise<unknown>};
}
export interface AiTaskRepo extends AiTaskTransaction {$transaction<T>(fn:(tx:AiTaskTransaction)=>Promise<T>):Promise<T>}
export class AiTaskConflict extends Error {constructor(){super('The saved task or AI request changed. Reload before sending.');this.name='AiTaskConflict'}}
function owned(scope:SavedBotTaskScope,id:string):Owned {if(!scope.organizationId.trim()||!scope.userId.trim())throw new AiTaskConflict();return{id,organizationId:scope.organizationId,createdByUserId:scope.userId}}
/** Internal foundation only: no Prisma adapter or route exists until storage gates pass.
 * authorityDigest must come from a current server decision, never the request body. */
export async function createAiTaskRun(repo:AiTaskRepo,scope:SavedBotTaskScope,raw:unknown,authorityDigest:string,now=new Date()):Promise<AiTaskRow>{
 const body=parseAiTaskInput(raw),where=owned(scope,aiTaskRunId(scope,body.clientRequestId));
 if(!Number.isFinite(now.getTime())||!/^[a-f0-9]{64}$/.test(authorityDigest))throw new AiTaskConflict();
 const captured=new Date(now.getTime()),deadlineAt=new Date(captured.getTime()+AI_TASK_LIMITS.totalMs),intentHash=aiTaskIntentHash(body);
 for(let attempt=0;attempt<3;attempt++){
  try{return await repo.$transaction(async tx=>{
   const existing=await tx.botAiTaskRun.findFirst({where});
   if(existing){
    if(existing.id!==where.id||existing.organizationId!==scope.organizationId||existing.createdByUserId!==scope.userId||existing.intentHash!==intentHash||existing.taskId!==body.taskId||existing.taskVersion!==body.expectedVersion||existing.kind!==body.kind||existing.modelId!==body.modelId)throw new AiTaskConflict();
    // A retry retrieves the original operation; it never resets authority or deadline.
    return existing;
   }
   const task=await tx.botTaskDraft.findFirst({where:owned(scope,body.taskId)});
   if(!task||task.id!==body.taskId||task.organizationId!==scope.organizationId||task.createdByUserId!==scope.userId||task.version!==body.expectedVersion||task.status!=='draft')throw new AiTaskConflict();
   const content={title:task.title,instruction:task.instruction,context:task.context};
   if(savedBotTaskContentHash(content)!==task.contentHash)throw new AiTaskConflict();
   const selected=body.evidenceContext?await loadAiTaskEvidenceContext(tx,scope,body,task.contentHash):undefined;
   const snapshotJson=aiTaskSnapshot(scope,body,content,authorityDigest,selected),snapshotDigest=aiTaskSnapshotDigest(snapshotJson);
   if(snapshotJson.format===2&&Buffer.byteLength(JSON.stringify(snapshotJson,null,1),'utf8')>20000)throw new AiTaskConflict();
   const event:AiTaskEvent={organizationId:scope.organizationId,createdByUserId:scope.userId,runId:where.id,sequence:0,eventType:'run.queued',payloadJson:{kind:body.kind},occurredAt:captured};
   const eventBytes=Buffer.byteLength(JSON.stringify(event.payloadJson),'utf8');
   const storedBytes=Buffer.byteLength(JSON.stringify(snapshotJson),'utf8')+eventBytes;
   if(eventBytes>AI_TASK_LIMITS.maxEventBytes||storedBytes>AI_TASK_LIMITS.maxTotalBytes)throw new AiTaskConflict();
   const row=await tx.botAiTaskRun.create({data:{...where,taskId:body.taskId,taskVersion:body.expectedVersion,clientRequestId:body.clientRequestId,kind:body.kind,modelId:body.modelId,correlationId:aiTaskCorrelationId(where.id),intentHash,snapshotJson,snapshotDigest,status:'queued',revision:0,attemptCount:0,eventCount:1,storedBytes,cancelRequested:false,leaseOwner:null,leaseExpiresAt:null,dispatchClaimedAt:null,usageReceiptId:null,createdAt:captured,updatedAt:captured,deadlineAt}});
   await tx.botAiTaskEvent.create({data:event});return row;
  });}catch(error){
   const code=databaseErrorCode(error);
   if((code==='P2002'||code==='P2034')&&attempt<2)continue;
   if(code==='P2002'||code==='P2034')throw new AiTaskConflict();throw error;
  }
 }
 throw new AiTaskConflict();
}
export type AiTaskSummary=Pick<AiTaskRow,'id'|'taskId'|'taskVersion'|'modelId'|'status'|'revision'|'attemptCount'|'createdAt'|'updatedAt'|'deadlineAt'>;
export interface AiTaskListRepo {botAiTaskRun:{findMany(args:{where:{organizationId:string;createdByUserId:string;taskId:string};orderBy:Array<{createdAt:'desc'}|{id:'desc'}>;take:number;select:{id:true;taskId:true;taskVersion:true;modelId:true;status:true;revision:true;attemptCount:true;createdAt:true;updatedAt:true;deadlineAt:true}}):Promise<AiTaskSummary[]>}}
export async function listAiTaskRuns(repo:AiTaskListRepo,scope:SavedBotTaskScope,taskId:string){
 if(!/^bot_[a-f0-9]{64}$/.test(taskId))throw new AiTaskConflict();owned(scope,taskId);
 const runs=await repo.botAiTaskRun.findMany({where:{organizationId:scope.organizationId,createdByUserId:scope.userId,taskId},orderBy:[{createdAt:'desc'},{id:'desc'}],take:6,select:{id:true,taskId:true,taskVersion:true,modelId:true,status:true,revision:true,attemptCount:true,createdAt:true,updatedAt:true,deadlineAt:true}});
 if(runs.length>6||runs.some(row=>row.taskId!==taskId))throw new AiTaskConflict();return{runs:runs.slice(0,5),truncated:runs.length>5};
}
