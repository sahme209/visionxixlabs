import {z} from 'zod';
const actionId=z.string().regex(/^servicenow_action_[a-f0-9]{64}$/);
export const serviceNowFreshAttemptReferenceSchema=z.object({parentActionId:actionId,parentVersion:z.number().int().positive().max(2147483647),parentCandidateDigest:z.string().regex(/^[a-f0-9]{64}$/),logicalActionId:actionId}).strict();
export type ServiceNowFreshAttemptReference=z.infer<typeof serviceNowFreshAttemptReferenceSchema>;
