import {createHash} from "node:crypto";
import {parseSavedBotTaskCreate,parseSavedBotTaskUpdate,savedBotTaskContentHash,type SavedBotTaskContent} from "./savedTaskSchema";

export interface SavedBotTaskScope {organizationId:string;userId:string}
export interface SavedBotTaskRow extends SavedBotTaskContent {
  id:string;organizationId:string;createdByUserId:string;clientRequestId:string;
  initialContentHash:string;contentHash:string;status:string;version:number;createdAt:Date;updatedAt:Date;
}
export type SavedBotTaskSummary = Pick<SavedBotTaskRow,"id"|"title"|"status"|"version"|"createdAt"|"updatedAt">;
export interface SavedBotTaskHistoryEntry {version:number;eventType:string;contentJson:SavedBotTaskContent;contentHash:string;occurredAt:Date}
type OwnedWhere={id:string;organizationId:string;createdByUserId:string};
interface TaskDelegate {
  findMany(args:{where:{organizationId:string;createdByUserId:string;OR?:Array<{createdAt:{lt:Date}}|{createdAt:Date;id:{lt:string}}>} ;orderBy:Array<{createdAt:"desc"}|{id:"desc"}>;take:number;select:{id:true;title:true;status:true;version:true;createdAt:true;updatedAt:true}}):Promise<SavedBotTaskSummary[]>;
  findFirst(args:{where:OwnedWhere}):Promise<SavedBotTaskRow|null>;
  create(args:{data:SavedBotTaskRow}):Promise<SavedBotTaskRow>;
  updateMany(args:{where:OwnedWhere&{version:number;status:"draft"};data:SavedBotTaskContent&{contentHash:string;version:{increment:number};updatedAt:Date}}):Promise<{count:number}>;
}
interface EventDelegate {
  findMany(args:{where:{organizationId:string;taskId:string;actorUserId:string;version?:{lt:number}};orderBy:{version:"desc"};take:number;select:{version:true;eventType:true;contentJson:true;contentHash:true;occurredAt:true}}):Promise<SavedBotTaskHistoryEntry[]>;
  create(args:{data:{organizationId:string;taskId:string;actorUserId:string;version:number;eventType:"draft.created"|"draft.updated";contentJson:SavedBotTaskContent;contentHash:string;occurredAt:Date}}):Promise<unknown>;
}
export interface SavedBotTaskTransaction {botTaskDraft:TaskDelegate;botTaskDraftEvent:EventDelegate}
export interface SavedBotTaskRepo extends SavedBotTaskTransaction {$transaction<T>(fn:(tx:SavedBotTaskTransaction)=>Promise<T>):Promise<T>}
export class SavedBotTaskConflictError extends Error {constructor(){super("Saved task changed or save identifier was reused.");this.name="SavedBotTaskConflictError"}}
export class SavedBotTaskNotFoundError extends Error {constructor(){super("Saved task was not found.");this.name="SavedBotTaskNotFoundError"}}
function owned(scope:SavedBotTaskScope,id:string):OwnedWhere {
  if(!scope.organizationId.trim()||!scope.userId.trim()||!id.trim())throw new Error("Verified workspace and actor are required.");
  return {id,organizationId:scope.organizationId,createdByUserId:scope.userId};
}
function content(value:SavedBotTaskContent):SavedBotTaskContent {return {title:value.title,instruction:value.instruction,context:value.context}}
function replay(row:SavedBotTaskRow,hash:string):SavedBotTaskRow {
  if(row.status!=="draft"||row.initialContentHash!==hash)throw new SavedBotTaskConflictError();
  return row;
}
/** Caller identity must be resolved by the authenticated server route, never by a request body. */
export async function createSavedBotTask(repo:SavedBotTaskRepo,scope:SavedBotTaskScope,raw:unknown):Promise<SavedBotTaskRow> {
  const body=parseSavedBotTaskCreate(raw);const snapshot=content(body);const hash=savedBotTaskContentHash(snapshot);
  const id="bot_"+createHash("sha256").update(JSON.stringify([scope.organizationId,scope.userId,body.clientRequestId])).digest("hex");
  const where=owned(scope,id);const now=new Date();
  try{return await repo.$transaction(async tx=>{
    const existing=await tx.botTaskDraft.findFirst({where});if(existing)return replay(existing,hash);
    const row=await tx.botTaskDraft.create({data:{...snapshot,...where,createdByUserId:scope.userId,clientRequestId:body.clientRequestId,initialContentHash:hash,contentHash:hash,status:"draft",version:0,createdAt:now,updatedAt:now}});
    await tx.botTaskDraftEvent.create({data:{organizationId:scope.organizationId,taskId:id,actorUserId:scope.userId,version:0,eventType:"draft.created",contentJson:snapshot,contentHash:hash,occurredAt:now}});
    return row;
  });}catch(error){
    // A competing transaction may have committed this same deterministic save.
    if(!error||typeof error!=="object"||!("code" in error)||error.code!=="P2002")throw error;
    const existing=await repo.botTaskDraft.findFirst({where});if(!existing)throw new SavedBotTaskConflictError();return replay(existing,hash);
  }
}
export async function getSavedBotTask(repo:SavedBotTaskRepo,scope:SavedBotTaskScope,id:string):Promise<SavedBotTaskRow|null> {
  const row=await repo.botTaskDraft.findFirst({where:owned(scope,id)});if(row&&row.status!=="draft")throw new SavedBotTaskConflictError();return row;
}
export async function updateSavedBotTask(repo:SavedBotTaskRepo,scope:SavedBotTaskScope,id:string,raw:unknown):Promise<SavedBotTaskRow> {
  const body=parseSavedBotTaskUpdate(raw);const where=owned(scope,id);const snapshot=content(body);const hash=savedBotTaskContentHash(snapshot);const now=new Date();
  return repo.$transaction(async tx=>{
    const current=await tx.botTaskDraft.findFirst({where});if(!current)throw new SavedBotTaskNotFoundError();
    if(current.status!=="draft"||current.version!==body.expectedVersion)throw new SavedBotTaskConflictError();
    if(current.contentHash===hash)return current;
    const changed=await tx.botTaskDraft.updateMany({where:{...where,version:body.expectedVersion,status:"draft"},data:{...snapshot,contentHash:hash,version:{increment:1},updatedAt:now}});
    if(changed.count!==1)throw new SavedBotTaskConflictError();
    const version=current.version+1;
    await tx.botTaskDraftEvent.create({data:{organizationId:scope.organizationId,taskId:id,actorUserId:scope.userId,version,eventType:"draft.updated",contentJson:snapshot,contentHash:hash,occurredAt:now}});
    return {...current,...snapshot,contentHash:hash,version,updatedAt:now};
  });
}

/** Stable creation-order paging keeps unrelated context out of list responses. */
export async function listSavedBotTasks(repo:SavedBotTaskRepo,scope:SavedBotTaskScope,cursor?:string):Promise<{tasks:SavedBotTaskSummary[];nextCursor:string|null}> {
  owned(scope,"list");
  const anchor=cursor?await getSavedBotTask(repo,scope,cursor):null;
  if(cursor&&!anchor)throw new SavedBotTaskNotFoundError();
  const rows=await repo.botTaskDraft.findMany({where:{organizationId:scope.organizationId,createdByUserId:scope.userId,...(anchor?{OR:[{createdAt:{lt:anchor.createdAt}},{createdAt:anchor.createdAt,id:{lt:anchor.id}}]}:{})},orderBy:[{createdAt:"desc"},{id:"desc"}],take:26,select:{id:true,title:true,status:true,version:true,createdAt:true,updatedAt:true}});
  if(rows.some(row=>row.status!=="draft"))throw new SavedBotTaskConflictError();
  const tasks=rows.slice(0,25);return {tasks,nextCursor:rows.length>25?tasks[tasks.length-1].id:null};
}
export async function listSavedBotTaskHistory(repo:SavedBotTaskRepo,scope:SavedBotTaskScope,id:string,beforeVersion?:number):Promise<{events:SavedBotTaskHistoryEntry[];nextBeforeVersion:number|null}> {
  if(beforeVersion!==undefined&&(!Number.isSafeInteger(beforeVersion)||beforeVersion<0||beforeVersion>2147483647))throw new Error("Invalid history cursor.");
  const row=await getSavedBotTask(repo,scope,id);if(!row)throw new SavedBotTaskNotFoundError();
  const rows=await repo.botTaskDraftEvent.findMany({where:{organizationId:scope.organizationId,taskId:id,actorUserId:scope.userId,...(beforeVersion!==undefined?{version:{lt:beforeVersion}}:{})},orderBy:{version:"desc"},take:11,select:{version:true,eventType:true,contentJson:true,contentHash:true,occurredAt:true}});
  const events=rows.slice(0,10);return {events,nextBeforeVersion:rows.length>10?events[events.length-1].version:null};
}
