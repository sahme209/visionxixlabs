import {z} from 'zod';
export const GCP_GUIDED_CALLBACK='https://visionxixlabs.com/api/integrations/gcp-cloud/callback';
export const GCP_GUIDED_SCOPE='https://www.googleapis.com/auth/cloud-platform.read-only';
export const gcpProjectId=z.string().regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/);
export const guidedAttemptId=z.string().uuid();
export const guidedResource=z.object({id:gcpProjectId,label:z.string().min(1).max(200).refine(s=>!/[\u0000-\u001f\u007f-\u009f]/.test(s))}).strict();
export const guidedStatus=z.object({status:z.enum(['awaiting_consent','selection_required','connected_read_only','outcome_unknown','expired','working','cancelled','not_connected']),attemptId:guidedAttemptId.optional(),expiresAt:z.string().datetime().optional(),resources:z.array(guidedResource).max(100).optional(),connection:z.object({id:z.string().min(1).max(240),resourceId:gcpProjectId,version:z.number().int().positive()}).strict().optional()}).strict();
export type GuidedStatus=z.infer<typeof guidedStatus>;
export interface GuidedPrincipal {organizationId:string;userId:string;sessionId:string}
export class GcpGuidedError extends Error {constructor(public code:'gcp_guided_unavailable'|'gcp_guided_invalid'|'gcp_guided_authority_required'|'gcp_guided_conflict'|'gcp_guided_outcome_unknown'){super(code)}}
