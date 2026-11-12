import {z} from 'zod';
import {digest} from '../contracts';
import {platformActionId} from '../viewContract';
import type {OperationalEcsManifestMetadata as EcsManifest} from './contracts';
import {operationalEcsManifest} from './contracts';
const manifest=z.custom<EcsManifest>(value=>{try{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const {digest:hash,authority,executionAuthorized,...input}=value as Record<string,unknown>;
 return digest.safeParse(hash).success&&authority==='metadata_only'&&executionAuthorized===false&&operationalEcsManifest.safeParse(input).success;
}catch{return false}});
export const ecsReviewPreview=z.object({delegationState:z.enum(['not_delegated','delegated']),actionId:platformActionId,planDigest:digest,version:z.number().int().min(0).max(1),status:z.enum(['proposed','approved']),requesterUserId:z.string().min(1).max(256),reviewerUserId:z.string().min(1).max(256).nullable(),manifest,authority:z.literal('review_preview_only'),executionAuthorized:z.literal(false)}).strict().refine(v=>((v.status==='proposed'&&v.version===0&&v.reviewerUserId===null&&v.delegationState==='not_delegated')||(v.status==='approved'&&v.version===1&&v.reviewerUserId!==null&&v.reviewerUserId!==v.requesterUserId)));
export const ecsReviewDecision=z.object({actionId:platformActionId,planDigest:digest,status:z.literal('approved'),version:z.literal(1),authority:z.literal('review_recorded_only'),executionAuthorized:z.literal(false)}).strict();
export type EcsReviewPreview=z.infer<typeof ecsReviewPreview>;
export type EcsReviewDecision=z.infer<typeof ecsReviewDecision>;
/** Receipt of delegation only; no workload identity, key or provider authority. */
export const ecsDelegationReceipt=z.object({actionId:platformActionId,manifest,status:z.literal('delegated'),version:z.literal(0),attemptCount:z.literal(0),requesterUserId:z.string().min(1).max(256),reviewerUserId:z.string().min(1).max(256),executionPrincipal:z.null(),credential:z.object({status:z.literal('not_requested')}).strict(),targetReservation:z.null(),expired:z.literal(false),authority:z.literal('delegation_history_only'),sourceValidation:z.literal('not_checked'),executionAuthorized:z.literal(false),providerExecution:z.literal(false)}).strict().refine(v=>v.requesterUserId!==v.reviewerUserId);
export type EcsDelegationReceipt=z.infer<typeof ecsDelegationReceipt>;
