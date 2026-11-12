import {z} from 'zod';
import {digest} from '../contracts';
import {platformActionId} from '../viewContract';
import {operationalSettingsManifest,operationalArtifactId} from './contracts';
const setting=operationalSettingsManifest.shape.settings.element;
export const settingsArtifactSaveCommand=z.object({operation:z.literal('save'),actionId:platformActionId,expectedVersion:z.literal(0),planDigest:digest,effectIndex:z.number().int().min(0).max(31),value:z.string().max(65536).refine(s=>!s.includes('\0')&&new TextEncoder().encode(s).byteLength<=65536&&new TextDecoder().decode(new TextEncoder().encode(s))===s)}).strict();
export const settingsArtifactReceipt=z.object({artifactId:operationalArtifactId,actionId:platformActionId,effectIndex:z.number().int().min(0).max(31),effectId:z.string().regex(/^setting_[0-9]{1,2}$/),creatorUserId:z.string().min(1).max(256),profileId:operationalSettingsManifest.shape.artifactProfileId,target:operationalSettingsManifest.shape.target.extend({name:setting.shape.name,environment:setting.shape.environment,type:setting.shape.type,sensitivity:setting.shape.sensitivity}).strict(),expiresAt:z.string().datetime(),authority:z.literal('metadata_only'),executionAuthorized:z.literal(false)}).strict().refine(v=>v.effectId==='setting_'+v.effectIndex&&(v.target.sensitivity!=='secret'||v.target.type==='encrypted'));
export type SettingsArtifactReceipt=z.infer<typeof settingsArtifactReceipt>;
