import {z} from 'zod';
import {digest} from './contracts';
import {platformActionId} from './viewContract';
/** Fixed template content, not a URL, permission or executable preview. */
export const platformTemplatePreview=z.object({
 kind:z.literal('template.source'),actionId:platformActionId,planDigest:digest,sourceDigest:digest,
 effectId:z.string().min(1).max(256),bytesDigest:digest,
 yaml:z.string().min(1).max(256*1024).refine(text=>new TextEncoder().encode(text).length<=256*1024),
 authority:z.literal('review_preview_only'),
}).strict().superRefine((value,c)=>{if(new TextEncoder().encode(JSON.stringify({ok:true,data:value})).length>262144)c.addIssue({code:'custom',message:'Template preview exceeds the bounded review transport'})});
export type PlatformTemplatePreview=z.infer<typeof platformTemplatePreview>;
const templateSelectionBase={accountId:z.string().regex(/^\d{12}$/),region:z.enum(['us-east-1','us-east-2']),expiresAt:z.string().datetime()};
export const platformTemplateSelection=z.discriminatedUnion('operation',[
 z.object({...templateSelectionBase,operation:z.literal('create_bucket')}).strict(),
 z.object({...templateSelectionBase,operation:z.literal('upload')}).strict(),
 z.object({...templateSelectionBase,operation:z.literal('access'),objectVersion:z.string().min(1).max(256).refine(v=>v!=='null'&&v.trim()===v&&!/[\x00-\x1f]/.test(v)),recipientDigest:digest,ttlSeconds:z.number().int().min(1).max(3600)}).strict(),
]);
import {platformPreparationRequestId} from './preparationContract';
export const platformTemplatePreparationCommand=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('prepare_template'),requestId:platformPreparationRequestId,selection:platformTemplateSelection}).strict(),
 z.object({operation:z.literal('lookup_template'),requestId:platformPreparationRequestId}).strict(),
]);
