import { databaseErrorCode } from "@/lib/database/databaseErrorCode";
import {parseReadinessRunStart,readinessRunId,readinessIntentHash,readinessSnapshotDigest,READINESS_ADAPTER,READINESS_LIMITS,type ReadinessRunStatus} from './readonlyRunContract';
import {savedBotTaskContentHash,type SavedBotTaskContent} from './savedTaskSchema';
import type {SavedBotTaskScope} from './savedTaskRepo';
export type Owned={id:string;organizationId:string;createdByUserId:string};
export interface ReadinessRunRow extends Owned {
 taskId:string;taskVersion:number;clientRequestId:string;adapter:typeof READINESS_ADAPTER;
 intentHash:string;snapshotJson:SavedBotTaskContent;snapshotDigest:string;
 status:ReadinessRunStatus;revision:number;attemptCount:number;eventCount:number;storedBytes:number;
 cancelRequested:boolean;leaseOwner:string|null;leaseExpiresAt:Date|null;createdAt:Date;updatedAt:Date;deadlineAt:Date;
}
export interface BoundTask extends SavedBotTaskContent,Owned {version:number;status:string;contentHash:string}
export interface ReadinessRunEvent {organizationId:string;createdByUserId:string;runId:string;sequence:number;eventType:string;payloadJson:Record<string,string>;occurredAt:Date}
export type ReadinessRunCasWhere=Owned&Pick<ReadinessRunRow,"revision"|"status"|"snapshotDigest"|"cancelRequested">;
export interface ReadinessArtifact extends Owned {runId:string;kind:"workspace_readiness_report";content:string;contentHash:string;snapshotDigest:string;observedAt:Date;createdAt:Date}
export type ReadinessRunSummary=Pick<ReadinessRunRow,'id'|'taskId'|'taskVersion'|'status'|'revision'|'attemptCount'|'createdAt'|'updatedAt'|'deadlineAt'>;
interface RunDelegate {
 findMany(args:{where:{organizationId:string;createdByUserId:string;taskId:string};orderBy:Array<{createdAt:'desc'}|{id:'desc'}>;take:number;select:{id:true;taskId:true;taskVersion:true;status:true;revision:true;attemptCount:true;createdAt:true;updatedAt:true;deadlineAt:true}}):Promise<ReadinessRunSummary[]>;
 findFirst(args:{where:Owned}):Promise<ReadinessRunRow|null>;
 create(args:{data:ReadinessRunRow}):Promise<ReadinessRunRow>;
 updateMany(args:{where:ReadinessRunCasWhere;data:Partial<ReadinessRunRow>}):Promise<{count:number}>;
}
export interface ReadinessRunTransaction {
 $queryRaw<T=unknown>(query:TemplateStringsArray,...values:unknown[]):Promise<T>;
 botTaskDraft:{findFirst(args:{where:Owned}):Promise<BoundTask|null>};
 botTaskRun:RunDelegate;
 botTaskArtifact:{create(args:{data:ReadinessArtifact}):Promise<unknown>};
 botTaskRunEvent:{create(args:{data:ReadinessRunEvent}):Promise<unknown>};
}
export interface ReadinessRunRepo extends ReadinessRunTransaction {$transaction<T>(fn:(tx:ReadinessRunTransaction)=>Promise<T>):Promise<T>}
export class ReadinessRunConflict extends Error {constructor(){super('Saved task or report request changed. Reload before creating a new report.');this.name='ReadinessRunConflict'}}
function ownership(scope:SavedBotTaskScope,id:string):Owned {
 if(!scope.organizationId.trim()||!scope.userId.trim())throw new ReadinessRunConflict();
 return {id,organizationId:scope.organizationId,createdByUserId:scope.userId};
}
/** Authenticated route supplies scope; body cannot select actor, tenant, tool or limits.
 * A replay returns the original run before inspecting a later task revision. */
export async function createReadinessRun(repo:ReadinessRunRepo,scope:SavedBotTaskScope,raw:unknown,now=new Date()):Promise<ReadinessRunRow>{
 const body=parseReadinessRunStart(raw),where=ownership(scope,readinessRunId(scope,body.clientRequestId));
 if(!Number.isFinite(now.getTime()))throw new ReadinessRunConflict();
 const capturedNow=new Date(now.getTime()),deadlineAt=new Date(capturedNow.getTime()+READINESS_LIMITS.totalMs),intentHash=readinessIntentHash(body);
 for(let attempt=0;attempt<3;attempt++){
  try{return await repo.$transaction(async tx=>{
   const existing=await tx.botTaskRun.findFirst({where});
   if(existing){
    if(existing.id!==where.id||existing.organizationId!==scope.organizationId||existing.createdByUserId!==scope.userId||existing.intentHash!==intentHash||existing.taskId!==body.taskId||existing.taskVersion!==body.expectedVersion||existing.adapter!==READINESS_ADAPTER)throw new ReadinessRunConflict();
    return existing;
   }
   const task=await tx.botTaskDraft.findFirst({where:ownership(scope,body.taskId)});
   if(!task||task.id!==body.taskId||task.organizationId!==scope.organizationId||task.createdByUserId!==scope.userId||task.version!==body.expectedVersion||task.status!=='draft')throw new ReadinessRunConflict();
   const snapshotJson={title:task.title,instruction:task.instruction,context:task.context};
   if(savedBotTaskContentHash(snapshotJson)!==task.contentHash)throw new ReadinessRunConflict();
   const initialEvent:ReadinessRunEvent={organizationId:scope.organizationId,createdByUserId:scope.userId,runId:where.id,sequence:0,eventType:'run.queued',payloadJson:{adapter:READINESS_ADAPTER},occurredAt:capturedNow};
   const storedBytes=Buffer.byteLength(JSON.stringify(snapshotJson),'utf8')+Buffer.byteLength(JSON.stringify(initialEvent.payloadJson),'utf8');
   if(storedBytes>READINESS_LIMITS.maxTotalBytes)throw new ReadinessRunConflict();
   const row=await tx.botTaskRun.create({data:{...where,taskId:body.taskId,taskVersion:body.expectedVersion,clientRequestId:body.clientRequestId,adapter:READINESS_ADAPTER,intentHash,snapshotJson,snapshotDigest:readinessSnapshotDigest(scope,body,snapshotJson),status:'queued',revision:0,attemptCount:0,eventCount:1,storedBytes,cancelRequested:false,leaseOwner:null,leaseExpiresAt:null,createdAt:capturedNow,updatedAt:capturedNow,deadlineAt}});
   await tx.botTaskRunEvent.create({data:initialEvent});return row;
  });}catch(error){
   const code=databaseErrorCode(error);
   if((code==='P2002'||code==='P2034')&&attempt<2)continue;
   if(code==='P2002'||code==='P2034')throw new ReadinessRunConflict();
   throw error;
  }
 }
 throw new ReadinessRunConflict();
}

/** Latest five recorded reports only; never load instructions or identity metadata. */
export async function listReadinessReports(repo:ReadinessRunRepo,scope:SavedBotTaskScope,taskId:string){
 if(!/^bot_[a-f0-9]{64}$/.test(taskId))throw new ReadinessRunConflict();ownership(scope,taskId);
 const rows=await repo.botTaskRun.findMany({where:{organizationId:scope.organizationId,createdByUserId:scope.userId,taskId},orderBy:[{createdAt:'desc'},{id:'desc'}],take:6,select:{id:true,taskId:true,taskVersion:true,status:true,revision:true,attemptCount:true,createdAt:true,updatedAt:true,deadlineAt:true}});
 if(rows.length>6||rows.some(row=>row.taskId!==taskId))throw new ReadinessRunConflict();
 return {runs:rows.slice(0,5),truncated:rows.length>5};
}
