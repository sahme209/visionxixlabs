import {z} from 'zod';
import type {PullRequestEvidenceBinding} from './pullRequestEvidenceRepo';
const id=z.string().min(1).max(160).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f]/.test(v));
const version=z.number().int().min(0).max(2147483647),repo=z.string().max(201).regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),sha=z.string().regex(/^[a-f0-9]{40}$/);
const instant=z.string().refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v);
const start=z.object({taskId:z.string().regex(/^bot_[a-f0-9]{64}$/),expectedVersion:version,releaseId:id,expectedReleaseVersion:version.min(1),pullRequestNumber:version.min(1),clientRequestId:z.string().uuid(),confirmRead:z.literal(true)}).strict();
export type PullRequestEvidenceStart=z.infer<typeof start>;
export const parsePullRequestEvidenceStart=(value:unknown)=>start.parse(value);
export const botPullRequestObservationSchema=z.object({number:version.min(1),repositoryFullName:repo,headRepositoryFullName:repo,headRef:id,headSha:sha,baseRef:id,baseSha:sha,state:z.enum(['open','closed']),draft:z.boolean(),merged:z.boolean()}).strict().refine(v=>!v.merged||v.state==='closed');
const evidence=z.object({kind:z.literal('release_pull_request_evidence_v1'),authority:z.literal('evidence_only'),observedAt:instant,releaseId:id,releaseVersion:version.min(1),releaseDigest:z.string().regex(/^[a-f0-9]{64}$/),repositoryFullName:repo,pullRequestNumber:version.min(1),connectionId:id,connectionRevision:instant,pullRequest:botPullRequestObservationSchema}).strict().refine(v=>v.pullRequest.number===v.pullRequestNumber&&v.pullRequest.repositoryFullName===v.repositoryFullName);
export type PullRequestEvidence=z.infer<typeof evidence>;
export const parsePullRequestEvidence=(value:unknown)=>evidence.parse(value);
export function matchPullRequestEvidence(value:unknown,binding:PullRequestEvidenceBinding){const parsed=evidence.safeParse(value);return parsed.success&&Object.entries(binding).every(([k,v])=>parsed.data[k as keyof PullRequestEvidence]===v)}
