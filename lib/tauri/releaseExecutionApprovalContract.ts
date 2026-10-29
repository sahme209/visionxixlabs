import {z} from 'zod';
const id=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f]/.test(v));
export const releaseExecutionApprovalDtoSchema=z.object({id:z.string().regex(/^release_approval_[a-f0-9]{64}$/),version:z.number().int().min(0).max(2147483647),planId:z.string().regex(/^release_plan_[a-f0-9]{64}$/),planVersion:z.literal(1),planDigest:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(['approved','revoked','consumed','stale']),executorUserId:id,createdAt:z.string().datetime(),expiresAt:z.string().datetime(),canRevoke:z.boolean(),simulationOnly:z.literal(true),providerExecutionAvailable:z.literal(false)}).strict();
export type ReleaseExecutionApprovalDto=z.infer<typeof releaseExecutionApprovalDtoSchema>;
export const parseReleaseExecutionApprovalDto=(value:unknown)=>releaseExecutionApprovalDtoSchema.parse(value);
