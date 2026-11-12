import {z} from 'zod';
import {digest} from '../contracts';
import {platformActionId} from '../viewContract';
import {operationalSettingsManifest} from './contracts';
export const settingsReviewCommand=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('preview'),actionId:platformActionId}).strict(),
 z.object({operation:z.literal('review'),actionId:platformActionId,expectedVersion:z.literal(0),planDigest:digest}).strict(),
]);
const setting=operationalSettingsManifest.shape.settings.element.extend({artifactStatus:z.enum(['missing','saved'])}).strict().refine(v=>v.current.kind==='absent'&&(v.sensitivity!=='secret'||v.type==='encrypted'));
export const settingsReviewPreview=z.object({actionId:platformActionId,planDigest:digest,version:z.literal(0),target:operationalSettingsManifest.shape.target,profileId:operationalSettingsManifest.shape.artifactProfileId,expiresAt:z.string().max(40).datetime(),settings:z.array(setting).min(1).max(32),reviewReady:z.boolean(),authority:z.literal('review_preview_only'),executionAuthorized:z.literal(false)}).strict().refine(v=>new Set(v.settings.map(s=>s.environment+':'+s.name)).size===v.settings.length&&new Set(v.settings.map(s=>s.artifactId)).size===v.settings.length&&v.reviewReady===v.settings.every(s=>s.artifactStatus==='saved'));
export const settingsReviewDecision=z.object({actionId:platformActionId,planDigest:digest,status:z.literal('approved'),version:z.literal(1),authority:z.literal('review_only'),executionAuthorized:z.literal(false)}).strict();
export type SettingsReviewPreview=z.infer<typeof settingsReviewPreview>;
export type SettingsReviewDecision=z.infer<typeof settingsReviewDecision>;
