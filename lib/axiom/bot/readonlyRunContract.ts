import {createHash} from 'node:crypto';
import {z} from 'zod';
import {savedBotTaskContentHash,type SavedBotTaskContent} from './savedTaskSchema';
import type {SavedBotTaskScope} from './savedTaskRepo';
export const READINESS_ADAPTER='workspace_readiness_v1' as const;
export const READINESS_LIMITS=Object.freeze({totalMs:30000,leaseMs:45000,maxAttempts:1,maxEvents:20,maxEventBytes:4096,maxArtifactBytes:32768,maxTotalBytes:131072,maxReleases:25,readerCategories:3,modelCalls:0,providerRequests:0});
const startSchema=z.object({taskId:z.string().regex(/^bot_[a-f0-9]{64}$/),expectedVersion:z.number().int().min(0).max(2147483647),adapter:z.literal(READINESS_ADAPTER),clientRequestId:z.string().uuid(),confirmRecordedMetadata:z.literal(true)}).strict();
export type ReadinessRunStart=z.infer<typeof startSchema>;
export const parseReadinessRunStart=(value:unknown):ReadinessRunStart=>startSchema.parse(value);
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function scopeKey(scope:SavedBotTaskScope){if(!scope.organizationId.trim()||!scope.userId.trim())throw new Error('Verified workspace and creator required');return[scope.organizationId,scope.userId]}
export function readinessRunId(scope:SavedBotTaskScope,clientRequestId:string){z.string().uuid().parse(clientRequestId);return 'botrun_'+digest([...scopeKey(scope),clientRequestId])}
export function readinessIntentHash(input:ReadinessRunStart){const value=parseReadinessRunStart(input);return digest([value.taskId,value.expectedVersion,value.adapter])}
export function readinessSnapshotDigest(scope:SavedBotTaskScope,input:ReadinessRunStart,content:SavedBotTaskContent){const value=parseReadinessRunStart(input);return digest([...scopeKey(scope),value.taskId,value.expectedVersion,value.adapter,savedBotTaskContentHash(content)])}
export const READINESS_RUN_STATUSES=['queued','running','needs_attention','completed','failed','cancel_requested','canceled','outcome_unknown'] as const;
export type ReadinessRunStatus=typeof READINESS_RUN_STATUSES[number];
export const READINESS_TERMINAL_STATUSES:readonly ReadinessRunStatus[]=['needs_attention','completed','failed','canceled','outcome_unknown'];
const iso=z.string().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value,'Canonical timestamp required');
const availability=z.enum(['recorded','absent','unavailable']);
const integration=z.object({provider:z.enum(['aws','azure','gcp','github','slack','teams','linear','jira','servicenow']),status:z.enum(['active','connected','pending','awaiting_validation','needs_attention','suspended','revoked','not_connected','unknown']),recordedAt:iso.nullable()}).strict();
const release=z.object({id:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),status:z.enum(['draft','submitted','closed','unknown']),version:z.number().int().min(0).max(2147483647),recordedAt:iso}).strict();
const factsSchema=z.object({checkedAt:iso,access:z.object({role:z.enum(['owner','admin','operator','security_reviewer','finance_viewer','read_only']),code:z.enum(['active','production_access_required','payment_past_due','access_canceled'])}).strict(),integrations:z.object({availability,items:z.array(integration).max(9)}).strict().refine(v=>v.availability==='recorded'||v.items.length===0,'Unavailable/absent storage cannot supply records'),releases:z.object({availability,items:z.array(release).max(READINESS_LIMITS.maxReleases),truncated:z.boolean()}).strict().refine(v=>v.availability==='recorded'||v.items.length===0&&!v.truncated,'Unavailable/absent storage cannot supply records')}).strict().refine(v=>Buffer.byteLength(JSON.stringify(v),'utf8')<=READINESS_LIMITS.maxArtifactBytes,'Report facts exceed bound');
export type ReadinessFacts=z.infer<typeof factsSchema>;
export const parseReadinessFacts=(value:unknown):ReadinessFacts=>factsSchema.parse(value);
/** Only fixed allowlisted DTO values are rendered. No instructions, credentials,
 * provider account identifiers, URLs, intake bodies or raw error text are accepted. */
export function renderReadinessReport(raw:unknown):string{
 const facts=parseReadinessFacts(raw),lines=['# Recorded workspace readiness','',`Checked: ${facts.checkedAt}`,'','Not a live provider health check or deployment approval. These are recorded observations only.','',`Current workspace role: ${facts.access.role}`,`Current commercial-access result: ${facts.access.code}`,'','## Recorded integrations'];
 if(facts.integrations.availability==='unavailable')lines.push('Integration storage unavailable. Connection state is unknown.');
 else if(facts.integrations.availability==='absent')lines.push('No recorded integrations were found.');
 else for(const row of facts.integrations.items)lines.push(`- ${row.provider}: ${row.status}; recorded timestamp: ${row.recordedAt??'not recorded'}`);
 lines.push('','## Recorded releases');
 if(facts.releases.availability==='unavailable')lines.push('Release storage unavailable. Release state is unknown.');
 else if(facts.releases.availability==='absent')lines.push('No recorded releases were found.');
 else{for(const row of facts.releases.items)lines.push(`- \`${row.id}\`: ${row.status}; version ${row.version}; recorded timestamp: ${row.recordedAt}`);if(facts.releases.truncated)lines.push('Only the latest 25 recorded releases are included; this is a partial inventory.');}
 lines.push('','No model calls or external provider requests were made. No connected-system changes were performed.');
 const report=lines.join('\n');if(Buffer.byteLength(report,'utf8')>READINESS_LIMITS.maxArtifactBytes)throw new Error('Report exceeds output bound');return report;
}
