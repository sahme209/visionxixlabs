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
