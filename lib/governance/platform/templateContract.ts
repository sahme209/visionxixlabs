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
