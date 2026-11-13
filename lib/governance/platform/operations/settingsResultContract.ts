import {z} from 'zod';
import {digest} from '../contracts';
import {platformActionId} from '../viewContract';
export const settingsResultBody=z.object({format:z.literal(1),purpose:z.literal('platform_settings_creation_result_v1'),actionId:platformActionId,effectIndex:z.number().int().min(0).max(31),planDigest:digest,manifestDigest:digest,nativeKey:digest,outcome:z.enum(['confirmed','refused','unknown']),settingId:z.string().regex(/^[A-Za-z0-9_-]{1,256}$/).nullable(),observedAt:z.number().int().nonnegative().safe()}).strict();
export const settingsResultSchema=settingsResultBody.extend({receiptDigest:digest}).strict();
