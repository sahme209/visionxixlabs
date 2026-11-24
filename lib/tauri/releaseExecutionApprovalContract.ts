import {z} from 'zod';
const id=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f]/.test(v));
export const releaseExecutionApprovalDtoSchema=z.object({id:z.string().regex(/^release_approval_[a-f0-9]{64}$/),version:z.number().int().min(0).max(2147483647),planId:z.string().regex(/^release_plan_[a-f0-9]{64}$/),planVersion:z.literal(1),planDigest:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(['approved','revoked','consumed','stale']),executorUserId:id,createdAt:z.string().datetime(),expiresAt:z.string().datetime(),canRevoke:z.boolean(),simulationOnly:z.literal(true),providerExecutionAvailable:z.literal(false)}).strict();
export type ReleaseExecutionApprovalDto=z.infer<typeof releaseExecutionApprovalDtoSchema>;
export const parseReleaseExecutionApprovalDto=(value:unknown)=>releaseExecutionApprovalDtoSchema.parse(value);

const approvalEvent = z.object({
  type: z.enum(["approved", "revoked", "consumed"]),
  at: z.string().datetime(),
}).strict();

export const exactApprovalHistorySchema = z.object({
  requestId: id,
  requestVersion: z.number().int().positive().max(2147483647),
  planId: releaseExecutionApprovalDtoSchema.shape.planId,
  planDigest: releaseExecutionApprovalDtoSchema.shape.planDigest,
  events: z.array(approvalEvent).max(2),
}).strict().refine(({events}) =>
  events.length === 0 || (events[0].type === "approved" && (events.length === 1 || (events[1].type !== "approved" && Date.parse(events[1].at) >= Date.parse(events[0].at)))),
);
export const simulationApprovalHistorySchema = exactApprovalHistorySchema;
export type ExactApprovalHistory = z.infer<typeof exactApprovalHistorySchema>;
export type SimulationApprovalHistory = ExactApprovalHistory;
