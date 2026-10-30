import {z} from 'zod';
const actionId=z.string().regex(/^servicenow_action_[a-f0-9]{64}$/);
export const SERVICE_NOW_CORRECTIVE_REPAIR_REVISION='servicenow-native-link-preflight-v1' as const;
const correction=z.object({refusedChildActionId:actionId,refusedChildVersion:z.number().int().positive().max(2147483647),refusedChildCandidateDigest:z.string().regex(/^[a-f0-9]{64}$/),repairRevision:z.literal(SERVICE_NOW_CORRECTIVE_REPAIR_REVISION)}).strict();
export const serviceNowFreshAttemptReferenceSchema=z.object({parentActionId:actionId,parentVersion:z.number().int().positive().max(2147483647),parentCandidateDigest:z.string().regex(/^[a-f0-9]{64}$/),logicalActionId:actionId,correction:correction.optional()}).strict();
export type ServiceNowFreshAttemptReference=z.infer<typeof serviceNowFreshAttemptReferenceSchema>;
