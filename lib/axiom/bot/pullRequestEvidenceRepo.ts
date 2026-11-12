import { databaseErrorCode } from "@/lib/database/databaseErrorCode";
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {savedBotTaskContentHash,type SavedBotTaskContent} from './savedTaskSchema';
import type {SavedBotTaskScope} from './savedTaskRepo';
export const PULL_REQUEST_EVIDENCE_KIND='release_pull_request_evidence_v1' as const;
export const PULL_REQUEST_EVIDENCE_LIMITS=Object.freeze({totalMs:45000,leaseMs:50000,maxAttempts:1,maxEvents:12,maxArtifactBytes:16384,maxTotalBytes:65536});
const id=z.string().min(1).max(1024).refine(v=>v.trim()===v&&v.length>0&&!/[\u0000-\u001f\u007f]/.test(v)),version=z.number().int().min(0).max(2147483647),digest=z.string().regex(/^[a-f0-9]{64}$/);
const bindingSchema=z.object({releaseId:id.max(160),releaseVersion:version.min(1),releaseDigest:digest,repositoryFullName:z.string().max(201).regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),pullRequestNumber:z.number().int().positive().max(2147483647),connectionId:id.max(160),connectionRevision:z.string().datetime({offset:false}).refine(v=>new Date(v).toISOString()===v)}).strict();
export type PullRequestEvidenceBinding=z.infer<typeof bindingSchema>;
const inputSchema=z.object({taskId:z.string().regex(/^bot_[a-f0-9]{64}$/),expectedVersion:version,clientRequestId:z.string().uuid()}).strict();
export type PullRequestEvidenceInput=z.infer<typeof inputSchema>;
type Owned={id:string;organizationId:string;createdByUserId:string};
export type PullRequestEvidenceStatus='queued'|'running'|'cancel_requested'|'completed'|'failed'|'canceled'|'outcome_unknown';
export interface PullRequestEvidenceSnapshot {content:SavedBotTaskContent;contentHash:string;binding:PullRequestEvidenceBinding}
export interface PullRequestEvidenceRow extends Owned {taskId:string;taskVersion:number;clientRequestId:string;kind:typeof PULL_REQUEST_EVIDENCE_KIND;intentHash:string;snapshotJson:PullRequestEvidenceSnapshot;snapshotDigest:string;status:PullRequestEvidenceStatus;revision:number;attemptCount:number;eventCount:number;storedBytes:number;cancelRequested:boolean;leaseOwner:string|null;leaseExpiresAt:Date|null;createdAt:Date;updatedAt:Date;deadlineAt:Date}
export interface PullRequestEvidenceEvent {organizationId:string;createdByUserId:string;runId:string;sequence:number;eventType:string;payloadJson:Record<string,string>;occurredAt:Date}
export interface PullRequestEvidenceArtifact extends Owned {runId:string;kind:'release_pull_request_evidence';content:string;contentHash:string;snapshotDigest:string;observedAt:Date;createdAt:Date}
export interface PullRequestEvidenceWorkerBinding {runId:string;expectedRevision:number;snapshotDigest:string;workerId:string}
type Task=Owned&SavedBotTaskContent&{version:number;status:string;contentHash:string};
type Where=Owned&Pick<PullRequestEvidenceRow,'revision'|'status'|'attemptCount'|'snapshotDigest'|'cancelRequested'>;
export interface PullRequestEvidenceTransaction {
 $queryRaw<T=unknown>(query:TemplateStringsArray,...values:unknown[]):Promise<T>;
 botTaskDraft:{findFirst(args:{where:Owned}):Promise<Task|null>};
 botPullRequestEvidenceRun:{findFirst(args:{where:Owned}):Promise<PullRequestEvidenceRow|null>;create(args:{data:PullRequestEvidenceRow}):Promise<PullRequestEvidenceRow>;updateMany(args:{where:Where;data:Partial<PullRequestEvidenceRow>}):Promise<{count:number}>};
 botPullRequestEvidenceEvent:{create(args:{data:PullRequestEvidenceEvent}):Promise<unknown>};
 botPullRequestEvidenceArtifact:{create(args:{data:PullRequestEvidenceArtifact}):Promise<unknown>};
}
export interface PullRequestEvidenceRepo extends PullRequestEvidenceTransaction {$transaction<T>(fn:(tx:PullRequestEvidenceTransaction)=>Promise<T>):Promise<T>}
export class PullRequestEvidenceConflict extends Error {constructor(){super('The saved task or release evidence request changed. Reload before continuing.');this.name='PullRequestEvidenceConflict'}}
const hash=(value:unknown)=>sha256ContentHash(value);
const terminal=(status:PullRequestEvidenceStatus)=>['completed','failed','canceled','outcome_unknown'].includes(status);
function clock(at:Date){if(!Number.isFinite(at.getTime()))throw new PullRequestEvidenceConflict();return new Date(at.getTime())}
function owned(scope:SavedBotTaskScope,runId:string){return{id:runId,organizationId:id.parse(scope.organizationId),createdByUserId:id.parse(scope.userId)}}
export function pullRequestEvidenceRunId(scope:SavedBotTaskScope,requestId:string){const o=owned(scope,'unused');return 'botpr_'+hash([o.organizationId,o.createdByUserId,z.string().uuid().parse(requestId)])}
async function load(tx:PullRequestEvidenceTransaction,scope:SavedBotTaskScope,runId:string){
 if(!/^botpr_[a-f0-9]{64}$/.test(runId))throw new PullRequestEvidenceConflict();
 const where=owned(scope,runId),row=await tx.botPullRequestEvidenceRun.findFirst({where});
 if(!row||row.id!==runId||row.organizationId!==where.organizationId||row.createdByUserId!==where.createdByUserId||row.kind!==PULL_REQUEST_EVIDENCE_KIND||row.snapshotDigest!==hash([where.organizationId,where.createdByUserId,row.taskId,row.taskVersion,row.clientRequestId,row.snapshotJson])||row.snapshotJson.contentHash!==savedBotTaskContentHash(row.snapshotJson.content))throw new PullRequestEvidenceConflict();
 bindingSchema.parse(row.snapshotJson.binding);return row;
}
export async function createPullRequestEvidenceRun(repo:PullRequestEvidenceRepo,scope:SavedBotTaskScope,raw:unknown,serverBinding:PullRequestEvidenceBinding,at=new Date()){
 const input=inputSchema.parse(raw),binding=bindingSchema.parse(serverBinding),where=owned(scope,pullRequestEvidenceRunId(scope,input.clientRequestId)),now=clock(at),intentHash=hash([input.taskId,input.expectedVersion,binding]);
 for(let attempt=0;attempt<3;attempt++)try{return await repo.$transaction(async tx=>{
  const existing=await tx.botPullRequestEvidenceRun.findFirst({where});
  if(existing){const checked=await load(tx,scope,where.id);if(checked.intentHash!==intentHash||checked.taskId!==input.taskId||checked.taskVersion!==input.expectedVersion)throw new PullRequestEvidenceConflict();return checked}
  const task=await tx.botTaskDraft.findFirst({where:owned(scope,input.taskId)});
  if(!task||task.id!==input.taskId||task.organizationId!==scope.organizationId||task.createdByUserId!==scope.userId||task.version!==input.expectedVersion||task.status!=='draft')throw new PullRequestEvidenceConflict();
  const content={title:task.title,instruction:task.instruction,context:task.context};if(savedBotTaskContentHash(content)!==task.contentHash)throw new PullRequestEvidenceConflict();
  const snapshotJson={content,contentHash:task.contentHash,binding},payloadJson={kind:PULL_REQUEST_EVIDENCE_KIND},storedBytes=Buffer.byteLength(JSON.stringify(snapshotJson))+Buffer.byteLength(JSON.stringify(payloadJson));
  if(storedBytes>PULL_REQUEST_EVIDENCE_LIMITS.maxTotalBytes-PULL_REQUEST_EVIDENCE_LIMITS.maxArtifactBytes)throw new PullRequestEvidenceConflict();
  const row=await tx.botPullRequestEvidenceRun.create({data:{...where,taskId:input.taskId,taskVersion:input.expectedVersion,clientRequestId:input.clientRequestId,kind:PULL_REQUEST_EVIDENCE_KIND,intentHash,snapshotJson,snapshotDigest:hash([scope.organizationId,scope.userId,input.taskId,input.expectedVersion,input.clientRequestId,snapshotJson]),status:'queued',revision:0,attemptCount:0,eventCount:1,storedBytes,cancelRequested:false,leaseOwner:null,leaseExpiresAt:null,createdAt:now,updatedAt:now,deadlineAt:new Date(now.getTime()+PULL_REQUEST_EVIDENCE_LIMITS.totalMs)}});
  await tx.botPullRequestEvidenceEvent.create({data:{organizationId:scope.organizationId,createdByUserId:scope.userId,runId:row.id,sequence:0,eventType:'run.queued',payloadJson,occurredAt:now}});return row;
 });}catch(error){const code=databaseErrorCode(error);if((code==='P2002'||code==='P2034')&&attempt<2)continue;if(code==='P2002'||code==='P2034')throw new PullRequestEvidenceConflict();throw error}
 throw new PullRequestEvidenceConflict();
}
function bind(row:PullRequestEvidenceRow,b:PullRequestEvidenceWorkerBinding,allowCancellation=false){if(!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||(!allowCancellation&&row.revision!==b.expectedRevision)||(allowCancellation&&row.revision<b.expectedRevision)||row.snapshotDigest!==b.snapshotDigest||!/^worker_[a-f0-9]{32}$/.test(b.workerId))throw new PullRequestEvidenceConflict()}
async function change(tx:PullRequestEvidenceTransaction,row:PullRequestEvidenceRow,patch:Partial<PullRequestEvidenceRow>,reason:string,now:Date,artifact?:PullRequestEvidenceArtifact){
 const payloadJson={reason},bytes=Buffer.byteLength(JSON.stringify(payloadJson)),storedBytes=row.storedBytes+bytes+(artifact?Buffer.byteLength(artifact.content):0);
 if(bytes>1024||row.eventCount>=PULL_REQUEST_EVIDENCE_LIMITS.maxEvents||storedBytes>PULL_REQUEST_EVIDENCE_LIMITS.maxTotalBytes)throw new PullRequestEvidenceConflict();
 const next={...row,...patch,revision:row.revision+1,eventCount:row.eventCount+1,storedBytes,updatedAt:now};
 const changed=await tx.botPullRequestEvidenceRun.updateMany({where:{...owned({organizationId:row.organizationId,userId:row.createdByUserId},row.id),revision:row.revision,status:row.status,attemptCount:row.attemptCount,snapshotDigest:row.snapshotDigest,cancelRequested:row.cancelRequested},data:{...patch,revision:next.revision,eventCount:next.eventCount,storedBytes,updatedAt:now}});
 if(changed.count!==1)throw new PullRequestEvidenceConflict();if(artifact)await tx.botPullRequestEvidenceArtifact.create({data:artifact});
 await tx.botPullRequestEvidenceEvent.create({data:{organizationId:row.organizationId,createdByUserId:row.createdByUserId,runId:row.id,sequence:row.eventCount,eventType:`run.${next.status}`,payloadJson,occurredAt:now}});return next;
}
export async function claimPullRequestEvidenceRun(repo:PullRequestEvidenceRepo,scope:SavedBotTaskScope,b:PullRequestEvidenceWorkerBinding,at=new Date()){
 const now=clock(at);return repo.$transaction(async tx=>{const row=await load(tx,scope,b.runId);bind(row,b);if(row.status!=='queued'||row.attemptCount!==0||row.cancelRequested||row.deadlineAt<=now)throw new PullRequestEvidenceConflict();return change(tx,row,{status:'running',attemptCount:1,leaseOwner:b.workerId,leaseExpiresAt:new Date(now.getTime()+PULL_REQUEST_EVIDENCE_LIMITS.leaseMs)},'read_started',now)});
}
export async function cancelPullRequestEvidenceRun(repo:PullRequestEvidenceRepo,scope:SavedBotTaskScope,runId:string,expectedRevision:number,at=new Date()){
 const now=clock(at);return repo.$transaction(async tx=>{const row=await load(tx,scope,runId);if(terminal(row.status)||row.status==='cancel_requested')return row;if(row.revision!==expectedRevision||!Number.isSafeInteger(expectedRevision))throw new PullRequestEvidenceConflict();return change(tx,row,row.status==='queued'?{status:'canceled',cancelRequested:true,leaseOwner:null,leaseExpiresAt:null}:{status:'cancel_requested',cancelRequested:true},'user_canceled',now)});
}
export type PullRequestEvidenceFinish={status:'completed';content:string;observedAt:Date}|{status:'failed'|'canceled'|'outcome_unknown';reason:string};
export async function finishPullRequestEvidenceRun(repo:PullRequestEvidenceRepo,scope:SavedBotTaskScope,b:PullRequestEvidenceWorkerBinding,result:PullRequestEvidenceFinish,at=new Date()){
 const now=clock(at);return repo.$transaction(async tx=>{const row=await load(tx,scope,b.runId);bind(row,b,result.status==='canceled'||result.status==='outcome_unknown');
  if(terminal(row.status)||!['running','cancel_requested'].includes(row.status)||row.attemptCount!==1||row.leaseOwner!==b.workerId)throw new PullRequestEvidenceConflict();
  let artifact:PullRequestEvidenceArtifact|undefined;
  if(result.status==='completed'){
   if(row.status!=='running'||row.cancelRequested||!row.leaseExpiresAt||row.leaseExpiresAt<=now||row.deadlineAt<=now||!Number.isFinite(result.observedAt.getTime())||result.observedAt<row.createdAt||result.observedAt>now||Buffer.byteLength(result.content)>PULL_REQUEST_EVIDENCE_LIMITS.maxArtifactBytes)throw new PullRequestEvidenceConflict();
   const value:unknown=JSON.parse(result.content);if(!value||typeof value!=='object'||Array.isArray(value))throw new PullRequestEvidenceConflict();
   const tasks=await tx.$queryRaw<Task[]>`SELECT "id","organizationId","createdByUserId","version","status","title","instruction","context","contentHash" FROM "BotTaskDraft" WHERE "id"=${row.taskId} AND "organizationId"=${scope.organizationId} AND "createdByUserId"=${scope.userId} FOR SHARE`;
   const task=tasks[0];if(!task||task.version!==row.taskVersion||task.status!=='draft'||task.contentHash!==row.snapshotJson.contentHash||savedBotTaskContentHash({title:task.title,instruction:task.instruction,context:task.context})!==task.contentHash)throw new PullRequestEvidenceConflict();
   // Keep source and installation locked through artifact commit. A concurrent
   // source edit/revocation either precedes this read and fails, or waits for commit.
   const source=row.snapshotJson.binding;
   const releases=await tx.$queryRaw<Array<{id:string;organizationId:string;status:string;version:number;intakeJson:unknown}>>`SELECT "id","organizationId","status","version","intakeJson" FROM "TauriDeploymentRequest" WHERE "id"=${source.releaseId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
   const release=releases[0];
   if(!release||release.id!==source.releaseId||release.organizationId!==scope.organizationId||release.status!=='submitted'||release.version!==source.releaseVersion||sha256ContentHash({requestVersion:release.version,intake:release.intakeJson})!==source.releaseDigest)throw new PullRequestEvidenceConflict();
   const connections=await tx.$queryRaw<Array<{id:string;organizationId:string;status:string;updatedAt:Date;githubInstallationId:string;revokedAt:Date|null;suspendedAt:Date|null}>>`SELECT "id","organizationId","status","updatedAt","githubInstallationId","revokedAt","suspendedAt" FROM "GitHubInstallation" WHERE "id"=${source.connectionId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
   const connection=connections[0];
   if(!connection||connection.id!==source.connectionId||connection.organizationId!==scope.organizationId||connection.status!=='active'||connection.revokedAt||connection.suspendedAt||!/^[1-9][0-9]*$/.test(connection.githubInstallationId)||connection.updatedAt.toISOString()!==source.connectionRevision)throw new PullRequestEvidenceConflict();

   artifact={...owned(scope,'botprartifact_'+row.id.slice(6)),runId:row.id,kind:'release_pull_request_evidence',content:result.content,contentHash:createHash('sha256').update(result.content).digest('hex'),snapshotDigest:row.snapshotDigest,observedAt:result.observedAt,createdAt:now};
  }else if(!/^[a-z][a-z0-9_]{0,79}$/.test(result.reason)||result.status==='canceled'&&!row.cancelRequested||result.status==='failed'&&row.cancelRequested)throw new PullRequestEvidenceConflict();
  return change(tx,row,{status:result.status,leaseOwner:null,leaseExpiresAt:null},result.status==='completed'?'evidence_saved':result.reason,now,artifact);
 });
}
export async function recoverPullRequestEvidenceRun(repo:PullRequestEvidenceRepo,scope:SavedBotTaskScope,runId:string,at=new Date()){
 const now=clock(at);return repo.$transaction(async tx=>{const row=await load(tx,scope,runId);if(terminal(row.status))return row;if(row.deadlineAt>now&&(row.status==='queued'||row.leaseExpiresAt&&row.leaseExpiresAt>now))return row;return change(tx,row,{status:row.status==='queued'?'failed':'outcome_unknown',leaseOwner:null,leaseExpiresAt:null},'read_deadline_expired',now)});
}
export const getPullRequestEvidenceRun=(repo:PullRequestEvidenceRepo,scope:SavedBotTaskScope,runId:string)=>load(repo,scope,runId);
export type PullRequestEvidenceSummary=Pick<PullRequestEvidenceRow,'id'|'taskId'|'taskVersion'|'status'|'revision'|'attemptCount'|'createdAt'|'updatedAt'|'deadlineAt'>;
export interface PullRequestEvidenceListRepo {botPullRequestEvidenceRun:{findMany(args:{where:{organizationId:string;createdByUserId:string;taskId:string};orderBy:Array<{createdAt:'desc'}|{id:'desc'}>;take:number;select:{id:true;taskId:true;taskVersion:true;status:true;revision:true;attemptCount:true;createdAt:true;updatedAt:true;deadlineAt:true}}):Promise<PullRequestEvidenceSummary[]>}}
export async function listPullRequestEvidenceRuns(repo:PullRequestEvidenceListRepo,scope:SavedBotTaskScope,taskId:string){
 if(!/^bot_[a-f0-9]{64}$/.test(taskId))throw new PullRequestEvidenceConflict();owned(scope,taskId);
 const runs=await repo.botPullRequestEvidenceRun.findMany({where:{organizationId:scope.organizationId,createdByUserId:scope.userId,taskId},orderBy:[{createdAt:'desc'},{id:'desc'}],take:6,select:{id:true,taskId:true,taskVersion:true,status:true,revision:true,attemptCount:true,createdAt:true,updatedAt:true,deadlineAt:true}});
 if(runs.length>6||runs.some(row=>row.taskId!==taskId))throw new PullRequestEvidenceConflict();return{runs:runs.slice(0,5),truncated:runs.length>5};
}
