import {z} from 'zod';
export const releaseProviderMergeReceiptSchema=z.object({repositoryFullName:z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),pullRequestNumber:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),headSha:z.string().regex(/^[a-f0-9]{40}$/),mergeSha:z.string().regex(/^[a-f0-9]{40}$/)}).strict();
export type ProviderMergeReceipt=z.infer<typeof releaseProviderMergeReceiptSchema>;
export const releaseProviderMergeDtoSchema=z.object({id:z.string().regex(/^release_merge_provider_[a-f0-9]{64}$/),state:z.enum(['prepared','dispatching','unknown','confirmed','refused','cancelled']),attemptCount:z.number().int().min(0).max(1),version:z.number().int().min(0).max(2),mode:z.literal('provider'),providerWritePerformed:z.boolean().nullable(),receipt:releaseProviderMergeReceiptSchema.optional()}).strict().superRefine((v,c)=>{const uncertain=['dispatching','unknown'].includes(v.state),zero=['prepared','cancelled'].includes(v.state);if(v.attemptCount!==(zero?0:1)||v.version!==(v.state==='prepared'?0:['dispatching','cancelled'].includes(v.state)?1:2)||v.providerWritePerformed!==(v.state==='confirmed'?true:uncertain?null:false)||(v.state==='confirmed')!==(v.receipt!==undefined))c.addIssue({code:'custom',message:'Invalid provider execution state'})});
export type ProviderMergeDto=z.infer<typeof releaseProviderMergeDtoSchema>;
export const parseReleaseProviderMergeDto=(v:unknown)=>releaseProviderMergeDtoSchema.parse(v);

export const releaseProviderMergeOperationResponseSchema=z.object({operation:releaseProviderMergeDtoSchema.nullable(),providerExecutionAvailable:z.literal(false)}).strict();
export type ProviderMergeOperationResponse=z.infer<typeof releaseProviderMergeOperationResponseSchema>;
export const parseReleaseProviderMergeOperationResponse=(v:unknown)=>releaseProviderMergeOperationResponseSchema.parse(v);

const mergeEvent = z.object({type: releaseProviderMergeDtoSchema.shape.state, at: z.string().datetime()}).strict();
export const providerMergeHistorySchema = z.object({
  requestId: z.string().regex(/^[A-Za-z0-9_-]{1,160}$/),
  requestVersion: z.number().int().positive().max(2147483647),
  planId: z.string().regex(/^release_plan_[a-f0-9]{64}$/),
  planDigest: z.string().regex(/^[a-f0-9]{64}$/),
  events: z.array(mergeEvent).max(3),
}).strict().refine(({events}) => {
  if (!events.length) return true;
  if (events[0].type !== 'prepared' || events.some((event, index) => index > 0 && Date.parse(event.at) < Date.parse(events[index - 1].at))) return false;
  if (events.length === 1) return true;
  return events[1].type === 'cancelled' ? events.length === 2
    : events[1].type === 'dispatching' && (events.length === 2 || ['confirmed', 'unknown', 'refused'].includes(events[2].type));
});
export type ProviderMergeHistory = z.infer<typeof providerMergeHistorySchema>;
