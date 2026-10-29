/** Browser-safe report wire contract. No Node imports or execution authority. */
export type ReadinessStatus='queued'|'running'|'needs_attention'|'completed'|'failed'|'cancel_requested'|'canceled'|'outcome_unknown';
export interface ReadinessRunDto {id:string;taskId:string;taskVersion:number;status:ReadinessStatus;revision:number;attemptCount:number;createdAt:string;updatedAt:string;deadlineAt:string}
export interface ReadinessCapabilitiesDto {enabled:boolean;canStart:boolean;adapter:'workspace_readiness_v1';modelCalls:0;providerRequests:0;description:string}
export interface ReadinessRunResponseDto {enabled:boolean;run:ReadinessRunDto}
export interface ReadinessReportResponseDto extends ReadinessRunResponseDto {report:null|{id:string;content:string;observedAt:string}}
export interface ReadinessStartDto {taskId:string;expectedVersion:number;adapter:'workspace_readiness_v1';clientRequestId:string;confirmRecordedMetadata:true}
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const number=(v:unknown,max=2147483647):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;
const date=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
export const isReadinessRunId=(v:unknown):v is string=>typeof v==='string'&&/^botrun_[a-f0-9]{64}$/.test(v);
const statuses:readonly unknown[]=['queued','running','needs_attention','completed','failed','cancel_requested','canceled','outcome_unknown'];
export const isReadinessCapabilities=(v:unknown):v is ReadinessCapabilitiesDto=>record(v)&&typeof v.enabled==='boolean'&&typeof v.canStart==='boolean'&&(!v.canStart||v.enabled)&&v.adapter==='workspace_readiness_v1'&&v.modelCalls===0&&v.providerRequests===0&&typeof v.description==='string'&&v.description.length<=512;
function isRun(v:unknown):v is ReadinessRunDto{return record(v)&&isReadinessRunId(v.id)&&typeof v.taskId==='string'&&/^bot_[a-f0-9]{64}$/.test(v.taskId)&&number(v.taskVersion)&&number(v.revision,20)&&number(v.attemptCount,1)&&statuses.includes(v.status)&&date(v.createdAt)&&date(v.updatedAt)&&date(v.deadlineAt)&&Date.parse(v.deadlineAt)-Date.parse(v.createdAt)===30000&&Date.parse(v.updatedAt)>=Date.parse(v.createdAt)&&(!['running','completed','cancel_requested'].includes(String(v.status))||v.attemptCount===1)}
export const isReadinessRunResponse=(v:unknown):v is ReadinessRunResponseDto=>record(v)&&typeof v.enabled==='boolean'&&isRun(v.run);
export function isReadinessReportResponse(v:unknown):v is ReadinessReportResponseDto {
 if(!isReadinessRunResponse(v)||!record(v))return false;
 if(v.report===null)return v.run.status!=='completed';
 const report=v.report;return v.run.status==='completed'&&record(report)&&report.id==='botartifact_'+v.run.id.slice(7)&&typeof report.content==='string'&&new TextEncoder().encode(report.content).byteLength<=32768&&date(report.observedAt)&&Date.parse(report.observedAt)>=Date.parse(v.run.createdAt)&&Date.parse(report.observedAt)<=Date.parse(v.run.updatedAt);
}

export interface ReadinessRunListDto {enabled:boolean;runs:ReadinessRunDto[];truncated:boolean}
export const isReadinessRunList=(v:unknown):v is ReadinessRunListDto=>record(v)&&typeof v.enabled==='boolean'&&typeof v.truncated==='boolean'&&Array.isArray(v.runs)&&v.runs.length<=5&&v.runs.every(isRun)&&new Set(v.runs.map(r=>r.id)).size===v.runs.length;
