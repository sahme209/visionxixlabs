import {z} from 'zod';
import {digest} from '../contracts';
import {platformActionId} from '../viewContract';
import {operationalSettingsManifest} from './contracts';
export const settingsReviewCommand=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('preview'),actionId:platformActionId}).strict(),
 z.object({operation:z.literal('inspect'),actionId:platformActionId}).strict(),
 z.object({operation:z.literal('review'),actionId:platformActionId,expectedVersion:z.literal(0),planDigest:digest}).strict(),
]);
const setting=operationalSettingsManifest.shape.settings.element.extend({artifactStatus:z.enum(['missing','saved'])}).strict().refine(v=>v.current.kind==='absent'&&(v.sensitivity!=='secret'||v.type==='encrypted'));
export const settingsReviewPreview=z.object({actionId:platformActionId,planDigest:digest,version:z.literal(0),target:operationalSettingsManifest.shape.target,profileId:operationalSettingsManifest.shape.artifactProfileId,expiresAt:z.string().max(40).datetime(),settings:z.array(setting).min(1).max(32),reviewReady:z.boolean(),authority:z.literal('review_preview_only'),executionAuthorized:z.literal(false)}).strict().refine(v=>new Set(v.settings.map(s=>s.environment+':'+s.name)).size===v.settings.length&&new Set(v.settings.map(s=>s.artifactId)).size===v.settings.length&&v.reviewReady===v.settings.every(s=>s.artifactStatus==='saved'));
export const settingsReviewDecision=z.object({actionId:platformActionId,planDigest:digest,status:z.literal('approved'),version:z.literal(1),authority:z.literal('review_only'),executionAuthorized:z.literal(false)}).strict();
export type SettingsReviewPreview=z.infer<typeof settingsReviewPreview>;
export type SettingsReviewDecision=z.infer<typeof settingsReviewDecision>;

import {settingsResultSchema} from './settingsResultContract';
export const settingsHistory=z.object({actionId:platformActionId,planDigest:digest,status:z.enum(['proposed','approved','claimed','confirmed','refused','unknown']),version:z.number().int().min(0).max(3),attemptCount:z.number().int().min(0).max(1),requesterUserId:z.string().min(1).max(256),reviewerUserId:z.string().min(1).max(256).nullable(),expired:z.boolean(),results:z.array(settingsResultSchema).max(32),authority:z.literal('history_only'),sourceValidation:z.literal('not_checked'),executionAuthorized:z.literal(false)}).strict().refine(v=>{
 if(v.reviewerUserId===v.requesterUserId||v.version!==({proposed:0,approved:1,claimed:2,confirmed:3,refused:3,unknown:3}[v.status])||v.attemptCount!==(v.version<2?0:1)||v.status==='proposed'&&v.reviewerUserId!==null||v.status!=='proposed'&&v.reviewerUserId===null)return false;
 if(v.version<2&&v.results.length)return false;
 return new Set(v.results.map(r=>r.effectIndex)).size===v.results.length&&v.results.every(r=>r.actionId===v.actionId&&r.planDigest===v.planDigest&&(r.outcome==='confirmed'?r.settingId!==null:r.settingId===null));
});
export type SettingsHistory=z.infer<typeof settingsHistory>;
