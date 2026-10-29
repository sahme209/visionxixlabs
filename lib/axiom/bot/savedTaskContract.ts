/** Shared presentation contract. No execution state or authority is represented. */
export interface SavedBotTaskContentDto {title:string;instruction:string;context:string}
export interface SavedBotTaskSummaryDto {id:string;title:string;status:"draft";version:number;createdAt:string;updatedAt:string}
export interface SavedBotTaskDto extends SavedBotTaskSummaryDto,SavedBotTaskContentDto {}
export interface SavedBotTaskCreateDto extends SavedBotTaskContentDto {clientRequestId:string}
export interface SavedBotTaskUpdateDto extends SavedBotTaskContentDto {expectedVersion:number}
export interface SavedBotTaskListDto {tasks:SavedBotTaskSummaryDto[];nextCursor:string|null}
export interface SavedBotTaskDetailDto {task:SavedBotTaskDto}
export interface SavedBotTaskHistoryDto {taskId:string;events:Array<{version:number;eventType:"draft.created"|"draft.updated";content:SavedBotTaskContentDto;occurredAt:string}>;nextBeforeVersion:number|null}
export type SavedBotTaskResult<T>={ok:true;data:T}|{ok:false;error:string;errorCode:string;outcomeUnconfirmed:boolean};
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v);
export const isSavedBotTaskId=(v:unknown):v is string=>typeof v==="string"&&/^bot_[a-f0-9]{64}$/.test(v);
const version=(v:unknown):v is number=>typeof v==="number"&&Number.isInteger(v)&&v>=0&&v<=2147483647;
const date=(v:unknown):v is string=>typeof v==="string"&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const title=(v:unknown):v is string=>typeof v==="string"&&v.trim().length>0&&v.length<=200;
const content=(v:unknown):v is SavedBotTaskContentDto=>record(v)&&title(v.title)&&typeof v.instruction==="string"&&v.instruction.trim().length>0&&v.instruction.length<=4000&&typeof v.context==="string"&&v.context.length<=4000&&new TextEncoder().encode(JSON.stringify({title:v.title,instruction:v.instruction,context:v.context})).byteLength<=16384;
const summary=(v:unknown):v is SavedBotTaskSummaryDto=>record(v)&&isSavedBotTaskId(v.id)&&title(v.title)&&v.status==="draft"&&version(v.version)&&date(v.createdAt)&&date(v.updatedAt);
export const isSavedBotTaskDetail=(v:unknown):v is SavedBotTaskDetailDto=>record(v)&&summary(v.task)&&content(v.task);
export const isSavedBotTaskList=(v:unknown):v is SavedBotTaskListDto=>record(v)&&Array.isArray(v.tasks)&&v.tasks.length<=25&&v.tasks.every(summary)&&new Set(v.tasks.map(t=>t.id)).size===v.tasks.length&&(v.nextCursor===null||isSavedBotTaskId(v.nextCursor)&&v.tasks.length>0&&v.nextCursor===v.tasks[v.tasks.length-1].id);
export const isSavedBotTaskHistory=(v:unknown):v is SavedBotTaskHistoryDto=>record(v)&&isSavedBotTaskId(v.taskId)&&Array.isArray(v.events)&&v.events.length<=10&&v.events.every((event,index,all)=>record(event)&&version(event.version)&&(event.eventType==="draft.created"||event.eventType==="draft.updated")&&content(event.content)&&date(event.occurredAt)&&(index===0||all[index-1].version>event.version))&&(v.nextBeforeVersion===null||version(v.nextBeforeVersion)&&v.events.length>0&&v.nextBeforeVersion===v.events[v.events.length-1].version);
