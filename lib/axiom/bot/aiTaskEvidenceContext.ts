import {createHash} from 'node:crypto';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {parsePullRequestEvidence,matchPullRequestEvidence,type PullRequestEvidence} from './pullRequestEvidenceContract';
import {savedBotTaskContentHash,type SavedBotTaskContent} from './savedTaskSchema';
import type {PullRequestEvidenceRow,PullRequestEvidenceArtifact} from './pullRequestEvidenceRepo';
import type {SavedBotTaskScope} from './savedTaskRepo';
const digest=z.string().regex(/^[a-f0-9]{64}$/),taskId=z.string().regex(/^bot_[a-f0-9]{64}$/),version=z.number().int().min(0).max(2147483647);
const identity=z.string().min(1).max(1024).refine(v=>v.trim().length>0);
export const aiTaskEvidenceSelectionSchema=z.object({kind:z.literal('saved_pr_evidence_v1'),runId:z.string().regex(/^botpr_[a-f0-9]{64}$/),artifactHash:digest,confirmUse:z.literal(true)}).strict();
export type AiTaskEvidenceSelection=z.infer<typeof aiTaskEvidenceSelectionSchema>;
export const AI_TASK_EVIDENCE_MAX_BYTES=8192;
const card=z.unknown().transform((v,ctx):PullRequestEvidence=>{try{return parsePullRequestEvidence(v)}catch{ctx.addIssue({code:'custom',message:'Invalid recorded PR evidence'});return z.NEVER}});
export const aiTaskEvidenceContextSchema=z.object({kind:z.literal('saved_pr_evidence_v1'),runId:z.string().regex(/^botpr_[a-f0-9]{64}$/),artifactHash:digest,artifactId:z.string().regex(/^botprartifact_[a-f0-9]{64}$/),runSnapshotDigest:digest,organizationId:identity,userId:identity,taskId,taskVersion:version,taskContentHash:digest,observedAt:z.string().datetime().refine(v=>new Date(v).toISOString()===v),evidence:card}).strict().refine(v=>v.observedAt===v.evidence.observedAt,'Observation timestamp mismatch').refine(v=>Buffer.byteLength(JSON.stringify(v),'utf8')<=AI_TASK_EVIDENCE_MAX_BYTES,'Recorded evidence exceeds 8 KiB; choose a smaller scope');
export type AiTaskEvidenceContext=z.infer<typeof aiTaskEvidenceContextSchema>;
export interface AiTaskEvidenceRepo {$queryRaw<T=unknown>(query:TemplateStringsArray,...values:unknown[]):Promise<T>}
export class AiTaskEvidenceConflict extends Error {constructor(){super('The selected recorded evidence is unavailable or changed. Collect evidence again and explicitly select it before sending.');this.name='AiTaskEvidenceConflict'}}
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
type SourceTask=SavedBotTaskContent&{id:string;organizationId:string;createdByUserId:string;version:number;status:string;contentHash:string};
type Release={id:string;organizationId:string;status:string;version:number;intakeJson:unknown};
type Connection={id:string;organizationId:string;status:string;updatedAt:Date;githubInstallationId:string;revokedAt:Date|null;suspendedAt:Date|null};
/** SQL is also safe for a preliminary read outside a transaction. Hard lifecycle
 * fences call it within the existing transaction so FOR SHARE locks survive. */
export async function loadAiTaskEvidenceContext(repo:AiTaskEvidenceRepo,scope:SavedBotTaskScope,input:{taskId:string;expectedVersion:number;evidenceContext?:unknown},contentHash:string):Promise<AiTaskEvidenceContext>{
 const selection=aiTaskEvidenceSelectionSchema.parse(input.evidenceContext);
 if(!scope.organizationId.trim()||!scope.userId.trim())throw new AiTaskEvidenceConflict();
 const runs=await repo.$queryRaw<PullRequestEvidenceRow[]>`SELECT * FROM "BotPullRequestEvidenceRun" WHERE "id"=${selection.runId} AND "organizationId"=${scope.organizationId} AND "createdByUserId"=${scope.userId} FOR SHARE`;
 const row=runs[0];
 if(runs.length!==1||!row||row.id!==selection.runId||row.organizationId!==scope.organizationId||row.createdByUserId!==scope.userId||row.taskId!==input.taskId||row.taskVersion!==input.expectedVersion||row.kind!=='release_pull_request_evidence_v1'||row.status!=='completed'||row.attemptCount!==1||row.cancelRequested||row.snapshotJson.contentHash!==contentHash||savedBotTaskContentHash(row.snapshotJson.content)!==contentHash||row.snapshotDigest!==sha256ContentHash([scope.organizationId,scope.userId,row.taskId,row.taskVersion,row.clientRequestId,row.snapshotJson]))throw new AiTaskEvidenceConflict();
 const artifacts=await repo.$queryRaw<PullRequestEvidenceArtifact[]>`SELECT * FROM "BotPullRequestEvidenceArtifact" WHERE "runId"=${row.id} AND "organizationId"=${scope.organizationId} AND "createdByUserId"=${scope.userId} FOR SHARE`;
 const artifact=artifacts[0];
 if(artifacts.length!==1||!artifact||artifact.organizationId!==scope.organizationId||artifact.createdByUserId!==scope.userId||artifact.runId!==row.id||artifact.id!=='botprartifact_'+row.id.slice(6)||artifact.kind!=='release_pull_request_evidence'||artifact.contentHash!==selection.artifactHash||artifact.contentHash!==createHash('sha256').update(artifact.content).digest('hex')||artifact.snapshotDigest!==row.snapshotDigest||Buffer.byteLength(artifact.content)>16384||!Number.isFinite(artifact.observedAt.getTime())||artifact.observedAt<row.createdAt||artifact.observedAt>artifact.createdAt||artifact.createdAt>row.updatedAt)throw new AiTaskEvidenceConflict();
 const evidence=parsePullRequestEvidence(JSON.parse(artifact.content));
 if(!matchPullRequestEvidence(evidence,row.snapshotJson.binding)||evidence.observedAt!==artifact.observedAt.toISOString())throw new AiTaskEvidenceConflict();
 const tasks=await repo.$queryRaw<SourceTask[]>`SELECT "id","organizationId","createdByUserId","version","status","title","instruction","context","contentHash" FROM "BotTaskDraft" WHERE "id"=${row.taskId} AND "organizationId"=${scope.organizationId} AND "createdByUserId"=${scope.userId} FOR SHARE`;
 const task=tasks[0];
 if(tasks.length!==1||!task||task.id!==row.taskId||task.organizationId!==scope.organizationId||task.createdByUserId!==scope.userId||task.version!==row.taskVersion||task.status!=='draft'||task.contentHash!==contentHash||savedBotTaskContentHash({title:task.title,instruction:task.instruction,context:task.context})!==contentHash)throw new AiTaskEvidenceConflict();
 const source=row.snapshotJson.binding;
 const releases=await repo.$queryRaw<Release[]>`SELECT "id","organizationId","status","version","intakeJson" FROM "TauriDeploymentRequest" WHERE "id"=${source.releaseId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
 const release=releases[0];
 if(releases.length!==1||!release||release.id!==source.releaseId||release.organizationId!==scope.organizationId||release.status!=='submitted'||release.version!==source.releaseVersion||sha256ContentHash({requestVersion:release.version,intake:release.intakeJson})!==source.releaseDigest)throw new AiTaskEvidenceConflict();
 const connections=await repo.$queryRaw<Connection[]>`SELECT "id","organizationId","status","updatedAt","githubInstallationId","revokedAt","suspendedAt" FROM "GitHubInstallation" WHERE "id"=${source.connectionId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
 const connection=connections[0];
 if(connections.length!==1||!connection||connection.id!==source.connectionId||connection.organizationId!==scope.organizationId||connection.status!=='active'||connection.revokedAt||connection.suspendedAt||!/^[1-9][0-9]*$/.test(connection.githubInstallationId)||connection.updatedAt.toISOString()!==source.connectionRevision)throw new AiTaskEvidenceConflict();
 return aiTaskEvidenceContextSchema.parse({kind:selection.kind,runId:row.id,artifactHash:artifact.contentHash,artifactId:artifact.id,runSnapshotDigest:row.snapshotDigest,organizationId:scope.organizationId,userId:scope.userId,taskId:row.taskId,taskVersion:row.taskVersion,taskContentHash:contentHash,observedAt:evidence.observedAt,evidence});
}
export async function assertAiTaskEvidenceContextCurrent(repo:AiTaskEvidenceRepo,scope:SavedBotTaskScope,snapshot:{format:1|2;taskId:string;taskVersion:number;contentHash:string;evidenceContext?:AiTaskEvidenceContext}):Promise<void>{
 if(snapshot.format===1)return;
 const selected=aiTaskEvidenceContextSchema.parse(snapshot.evidenceContext);
 const current=await loadAiTaskEvidenceContext(repo,scope,{taskId:snapshot.taskId,expectedVersion:snapshot.taskVersion,evidenceContext:{kind:selected.kind,runId:selected.runId,artifactHash:selected.artifactHash,confirmUse:true}},snapshot.contentHash);
 if(hash(current)!==hash(selected))throw new AiTaskEvidenceConflict();
}
