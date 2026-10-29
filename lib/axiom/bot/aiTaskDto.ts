/** Browser-safe AI task wire contract; no credentials, billing authority or Node imports. */
export type BotAiStatus='queued'|'preparing'|'dispatching'|'needs_input'|'completed'|'failed'|'cancel_requested'|'canceled'|'outcome_unknown';
export interface BotAiRunDto {id:string;taskId:string;taskVersion:number;modelId:string;status:BotAiStatus;revision:number;attemptCount:number;createdAt:string;updatedAt:string;deadlineAt:string}
export interface BotAiCapabilitiesDto {enabled:boolean;canSend:boolean;recoveryScope:string;kind:'ai_task_response_v1';toolAccess:false;description:string}
export interface BotAiRunResponseDto {enabled:boolean;run:BotAiRunDto}
export interface BotAiResultResponseDto extends BotAiRunResponseDto {result:null|{kind:'answer'|'needs_input';message:string;createdAt:string}}
export interface BotAiEvidenceContext {kind:'saved_pr_evidence_v1';runId:string;artifactHash:string;confirmUse:true}
export function isBotAiEvidenceContext(value:unknown):value is BotAiEvidenceContext {if(!value||typeof value!=='object'||Array.isArray(value))return false;const v=value as Record<string,unknown>;return Object.keys(v).sort().join(',')==='artifactHash,confirmUse,kind,runId'&&v.kind==='saved_pr_evidence_v1'&&v.confirmUse===true&&typeof v.runId==='string'&&/^botpr_[a-f0-9]{64}$/.test(v.runId)&&typeof v.artifactHash==='string'&&/^[a-f0-9]{64}$/.test(v.artifactHash)}
export interface BotAiStartDto {taskId:string;expectedVersion:number;kind:'ai_task_response_v1';clientRequestId:string;modelId:string;confirmSend:true;evidenceContext?:BotAiEvidenceContext}
export interface BotAiRunListDto {enabled:boolean;runs:BotAiRunDto[];truncated:boolean}
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,max=2147483647):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;
const date=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
export const isBotAiRunId=(v:unknown):v is string=>typeof v==='string'&&/^botai_[a-f0-9]{64}$/.test(v);
export const isBotAiModelId=(v:unknown):v is string=>typeof v==='string'&&v.length<=200&&/^[A-Za-z0-9][A-Za-z0-9._:-]*\/[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(v)&&!v.includes('://')&&!/\s/.test(v);
const states:readonly unknown[]=['queued','preparing','dispatching','needs_input','completed','failed','cancel_requested','canceled','outcome_unknown'];
export const isBotAiCapabilities=(v:unknown):v is BotAiCapabilitiesDto=>record(v)&&typeof v.enabled==='boolean'&&typeof v.canSend==='boolean'&&(!v.canSend||v.enabled)&&typeof v.recoveryScope==='string'&&/^bot_scope_[a-f0-9]{64}$/.test(v.recoveryScope)&&v.kind==='ai_task_response_v1'&&v.toolAccess===false&&typeof v.description==='string'&&v.description.length<=512;
function run(v:unknown):v is BotAiRunDto{return record(v)&&isBotAiRunId(v.id)&&typeof v.taskId==='string'&&/^bot_[a-f0-9]{64}$/.test(v.taskId)&&integer(v.taskVersion)&&isBotAiModelId(v.modelId)&&integer(v.revision,19)&&integer(v.attemptCount,1)&&states.includes(v.status)&&date(v.createdAt)&&date(v.updatedAt)&&date(v.deadlineAt)&&Date.parse(v.deadlineAt)-Date.parse(v.createdAt)===60000&&Date.parse(v.updatedAt)>=Date.parse(v.createdAt)&&(['queued','preparing','canceled','failed'].includes(String(v.status))?v.attemptCount===0:v.attemptCount===1)}
export const isBotAiRunResponse=(v:unknown):v is BotAiRunResponseDto=>record(v)&&typeof v.enabled==='boolean'&&run(v.run);
export function isBotAiResultResponse(v:unknown):v is BotAiResultResponseDto{
 if(!isBotAiRunResponse(v)||!record(v))return false;
 if(v.result===null)return !['completed','needs_input'].includes(v.run.status);
 const result=v.result;
 if(!record(result)||typeof result.message!=='string'||!result.message.trim()||!date(result.createdAt)||Date.parse(result.createdAt)<Date.parse(v.run.createdAt)||Date.parse(result.createdAt)>Date.parse(v.run.updatedAt))return false;
 if(!((v.run.status==='completed'&&result.kind==='answer')||(v.run.status==='needs_input'&&result.kind==='needs_input')))return false;
 for(let i=0;i<result.message.length;i++){const c=result.message.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const n=result.message.charCodeAt(++i);if(!(n>=0xdc00&&n<=0xdfff))return false}else if(c>=0xdc00&&c<=0xdfff)return false}
 return new TextEncoder().encode(JSON.stringify({kind:result.kind,message:result.message})).byteLength<=32768;
}
export const isBotAiRunList=(v:unknown):v is BotAiRunListDto=>record(v)&&typeof v.enabled==='boolean'&&typeof v.truncated==='boolean'&&Array.isArray(v.runs)&&v.runs.length<=5&&v.runs.every(run)&&new Set(v.runs.map(r=>r.id)).size===v.runs.length;
