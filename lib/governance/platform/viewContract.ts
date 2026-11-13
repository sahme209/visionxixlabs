import {z} from 'zod';
import {platformPlanSchema,digest} from './contracts';
export const platformActionId=z.string().regex(/^platform_action_[a-f0-9-]{36}$/);
const userId=z.string().min(1).max(256);
export const platformInspectionSchema=z.object({
 actionId:platformActionId,version:z.number().int().min(0).max(3),status:z.enum(['proposed','approved','claimed','confirmed','refused','unknown']),attemptCount:z.number().int().min(0).max(1),
 requesterUserId:userId,reviewerUserId:userId.nullable(),plan:platformPlanSchema.extend({digest}).strict(),expired:z.boolean(),
 effects:z.array(z.object({id:z.string().min(1).max(256),status:z.enum(['not_started','claimed','confirmed','refused','unknown'])}).strict()).min(1).max(32),
 authority:z.literal('history_only'),sourceValidation:z.literal('not_checked'),
}).strict().superRefine((v,c)=>{
 const versions={proposed:0,approved:1,claimed:2,confirmed:3,refused:3,unknown:3} as const;
 const bad=()=>c.addIssue({code:'custom',message:'Inconsistent platform history'});
 if(v.version!==versions[v.status])bad();
 if(v.effects.length!==v.plan.effects.length||v.effects.some((e,i)=>e.id!==v.plan.effects[i].id))bad();
 if(v.reviewerUserId===v.requesterUserId||v.status==='proposed'&&(v.version!==0||v.reviewerUserId!==null)||v.status!=='proposed'&&!v.reviewerUserId)bad();
 if(['proposed','approved'].includes(v.status)&&(v.attemptCount!==0||v.effects.some(e=>e.status!=='not_started'))||!['proposed','approved'].includes(v.status)&&v.attemptCount!==1)bad();
 if(v.status==='confirmed'&&v.effects.some(e=>e.status!=='confirmed')||v.status==='unknown'&&!v.effects.some(e=>e.status==='unknown')||v.status==='refused'&&!v.effects.some(e=>e.status==='refused'))bad();
});
export type PlatformInspection=z.infer<typeof platformInspectionSchema>;
/** Ephemeral current review content, never execution authority or a replacement
 * for the durable action record. Raw payload remains bounded and React-escaped. */
export const platformGrowthPreviewSchema=z.object({actionId:platformActionId,planDigest:digest,sourceDigest:digest,effectId:z.string().min(1).max(256),renderedPost:z.string().max(65536).optional(),authority:z.literal('review_preview_only')}).strict().superRefine((v,c)=>{
 if(v.renderedPost!==undefined){try{const p=JSON.parse(v.renderedPost);if(!p||typeof p!=='object'||Array.isArray(p)||typeof p.author!=='string'||typeof p.commentary!=='string'||p.visibility!=='PUBLIC')throw Error('shape')}catch{c.addIssue({code:'custom',message:'Invalid rendered review payload'})}}
});
export type PlatformGrowthPreview=z.infer<typeof platformGrowthPreviewSchema>;
export const platformReviewCommandSchema=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('preview_template'),actionId:platformActionId}).strict(),
 z.object({operation:z.literal('inspect'),actionId:platformActionId}).strict(),
 z.object({operation:z.literal('preview'),actionId:platformActionId}).strict(),
 z.object({operation:z.literal('approve'),actionId:platformActionId,expectedVersion:z.number().int().min(0).max(1000),planDigest:digest}).strict(),
]);
export const platformExecutionCommandSchema=z.object({operation:z.literal('execute'),actionId:platformActionId,expectedVersion:z.literal(1),planDigest:digest}).strict();
