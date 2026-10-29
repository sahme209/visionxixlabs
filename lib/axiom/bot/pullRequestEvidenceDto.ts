/** Client-safe, fixed read-only Bot evidence contract. Never conveys approval. */
export type BotPrStatus='queued'|'running'|'cancel_requested'|'completed'|'failed'|'canceled'|'outcome_unknown';
export interface BotPrRunDto {id:string;taskId:string;taskVersion:number;releaseId:string;releaseVersion:number;status:BotPrStatus;revision:number;attemptCount:number;createdAt:string;updatedAt:string;deadlineAt:string}
export interface BotPrCapabilitiesDto {enabled:boolean;canStart:boolean;recoveryScope:string;kind:'release_pull_request_evidence_v1';description:string}
export interface BotPrRunResponseDto {enabled:boolean;run:BotPrRunDto}
export interface BotPrEvidenceSelection {kind:'saved_pr_evidence_v1';runId:string;artifactHash:string}
export interface BotPrEvidenceResponseDto extends BotPrRunResponseDto {selection?:BotPrEvidenceSelection|null;evidence:null|{content:string;observedAt:string}}
export interface BotPrRunListDto {enabled:boolean;runs:BotPrRunDto[];truncated:boolean}
export interface BotPrStartDto {taskId:string;expectedVersion:number;releaseId:string;expectedReleaseVersion:number;pullRequestNumber:number;clientRequestId:string;confirmRead:true}
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,names:string[])=>Object.keys(v).length===names.length&&Object.keys(v).every(k=>names.includes(k));
const integer=(v:unknown,max=2147483647):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;
const date=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
export const isBotPrRunId=(v:unknown):v is string=>typeof v==='string'&&/^botpr_[a-f0-9]{64}$/.test(v);
export const isBotPrReleaseId=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=200&&/^[A-Za-z0-9_-]+$/.test(v);
export const isBotPrUuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
export function isBotPrRun(v:unknown):v is BotPrRunDto {return record(v)&&keys(v,['id','taskId','taskVersion','releaseId','releaseVersion','status','revision','attemptCount','createdAt','updatedAt','deadlineAt'])&&isBotPrRunId(v.id)&&typeof v.taskId==='string'&&/^bot_[a-f0-9]{64}$/.test(v.taskId)&&integer(v.taskVersion)&&isBotPrReleaseId(v.releaseId)&&integer(v.releaseVersion)&&integer(v.revision)&&integer(v.attemptCount,1)&&['queued','running','cancel_requested','completed','failed','canceled','outcome_unknown'].includes(String(v.status))&&date(v.createdAt)&&date(v.updatedAt)&&date(v.deadlineAt)&&Date.parse(v.updatedAt)>=Date.parse(v.createdAt)&&Date.parse(v.deadlineAt)>Date.parse(v.createdAt)&&Date.parse(v.deadlineAt)-Date.parse(v.createdAt)<=120000&&(!['running','completed'].includes(String(v.status))||v.attemptCount===1)}
export const isBotPrCapabilities=(v:unknown):v is BotPrCapabilitiesDto=>record(v)&&keys(v,['enabled','canStart','recoveryScope','kind','description'])&&typeof v.enabled==='boolean'&&typeof v.canStart==='boolean'&&(!v.canStart||v.enabled)&&typeof v.recoveryScope==='string'&&/^bot_pr_scope_[a-f0-9]{64}$/.test(v.recoveryScope)&&v.kind==='release_pull_request_evidence_v1'&&typeof v.description==='string'&&v.description.length<=512;
export const isBotPrRunResponse=(v:unknown):v is BotPrRunResponseDto=>record(v)&&keys(v,['enabled','run'])&&typeof v.enabled==='boolean'&&isBotPrRun(v.run);
export function isBotPrEvidenceResponse(v:unknown):v is BotPrEvidenceResponseDto {
 if(!record(v)||!(keys(v,['enabled','run','evidence'])||keys(v,['enabled','run','evidence','selection']))||typeof v.enabled!=='boolean'||!isBotPrRun(v.run))return false;
 if(v.selection!==undefined&&v.selection!==null){const selection=v.selection;if(!record(selection)||!keys(selection,['kind','runId','artifactHash'])||selection.kind!=='saved_pr_evidence_v1'||selection.runId!==v.run.id||typeof selection.artifactHash!=='string'||!/^([a-f0-9]{64})$/.test(selection.artifactHash)||v.run.status!=='completed')return false}
 if(v.evidence===null)return v.run.status!=='completed';
 const e=v.evidence;if(!(v.run.status==='completed'&&record(e)&&keys(e,['content','observedAt'])&&typeof e.content==='string'&&e.content.trim().length>0&&new TextEncoder().encode(e.content).byteLength<=16384&&date(e.observedAt)&&Date.parse(e.observedAt)>=Date.parse(v.run.createdAt)&&Date.parse(e.observedAt)<=Date.parse(v.run.updatedAt)))return false;
 const card=parseBotPrEvidence(e.content as string);return card!==null&&card.observedAt===e.observedAt&&card.releaseId===v.run.releaseId&&card.releaseVersion===v.run.releaseVersion;
}
export const isBotPrRunList=(v:unknown):v is BotPrRunListDto=>record(v)&&keys(v,['enabled','runs','truncated'])&&typeof v.enabled==='boolean'&&typeof v.truncated==='boolean'&&Array.isArray(v.runs)&&v.runs.length<=5&&v.runs.every(isBotPrRun)&&new Set(v.runs.map(r=>r.id)).size===v.runs.length;
export function isBotPrStart(v:unknown):v is BotPrStartDto {return record(v)&&keys(v,['taskId','expectedVersion','releaseId','expectedReleaseVersion','pullRequestNumber','clientRequestId','confirmRead'])&&typeof v.taskId==='string'&&/^bot_[a-f0-9]{64}$/.test(v.taskId)&&integer(v.expectedVersion)&&isBotPrReleaseId(v.releaseId)&&integer(v.expectedReleaseVersion)&&integer(v.pullRequestNumber)&&v.pullRequestNumber>0&&isBotPrUuid(v.clientRequestId)&&v.confirmRead===true}
export interface BotPrEvidenceCard {kind:'release_pull_request_evidence_v1';authority:'evidence_only';observedAt:string;releaseId:string;releaseVersion:number;releaseDigest:string;repositoryFullName:string;pullRequestNumber:number;connectionId:string;connectionRevision:string;pullRequest:{number:number;repositoryFullName:string;headRepositoryFullName:string;headRef:string;headSha:string;baseRef:string;baseSha:string;state:'open'|'closed';draft:boolean;merged:boolean}}
const hash=(v:unknown,n:number):v is string=>typeof v==='string'&&new RegExp(`^[a-f0-9]{${n}}$`).test(v);
const text=(v:unknown,max=200):v is string=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\0\r\n]/.test(v);
const repository=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(v);
/** Only controlled facts from this fixed evidence artifact, never executable Markdown/HTML. */
export function parseBotPrEvidence(content:string):BotPrEvidenceCard|null {
 try {const v:unknown=JSON.parse(content);if(!record(v)||!keys(v,['kind','authority','observedAt','releaseId','releaseVersion','releaseDigest','repositoryFullName','pullRequestNumber','connectionId','connectionRevision','pullRequest'])||v.kind!=='release_pull_request_evidence_v1'||v.authority!=='evidence_only'||!date(v.observedAt)||!isBotPrReleaseId(v.releaseId)||!integer(v.releaseVersion)||!hash(v.releaseDigest,64)||!repository(v.repositoryFullName)||!integer(v.pullRequestNumber)||v.pullRequestNumber<1||!text(v.connectionId)||!date(v.connectionRevision)||!record(v.pullRequest))return null;
 const p=v.pullRequest;if(!keys(p,['number','repositoryFullName','headRepositoryFullName','headRef','headSha','baseRef','baseSha','state','draft','merged'])||p.number!==v.pullRequestNumber||p.repositoryFullName!==v.repositoryFullName||!repository(p.headRepositoryFullName)||!text(p.headRef,240)||!text(p.baseRef,240)||!hash(p.headSha,40)||!hash(p.baseSha,40)||!['open','closed'].includes(String(p.state))||typeof p.draft!=='boolean'||typeof p.merged!=='boolean'||(p.merged&&p.state!=='closed'))return null;
 return v as unknown as BotPrEvidenceCard;
 }catch{return null}
}
