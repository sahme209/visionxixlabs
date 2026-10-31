import {z} from 'zod';
const id=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f]/.test(v));
export const releaseProviderMergeApprovalDtoSchema=z.object({governanceBaselineDigest:z.string().regex(/^[a-f0-9]{64}$/).optional(),id:z.string().regex(/^release_provider_approval_[a-f0-9]{64}$/),version:z.number().int().min(0).max(2147483647),planId:z.string().regex(/^release_plan_[a-f0-9]{64}$/),planVersion:z.literal(1),planDigest:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(['approved','revoked','consumed','stale']),executorUserId:id,createdAt:z.string().datetime(),expiresAt:z.string().datetime(),canRevoke:z.boolean(),mode:z.literal('provider'),sourcePolicy:z.literal('expected_head_observed_base')}).strict();
export type ReleaseProviderMergeApprovalDto=z.infer<typeof releaseProviderMergeApprovalDtoSchema>;
export const parseReleaseProviderMergeApprovalDto=(value:unknown)=>releaseProviderMergeApprovalDtoSchema.parse(value);
