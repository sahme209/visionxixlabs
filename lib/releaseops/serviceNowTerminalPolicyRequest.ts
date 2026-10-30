import {z} from 'zod';
import {serviceNowTerminalPolicySchema} from './ticketGovernanceReviewContract';
export const serviceNowTerminalPolicyRequestSchema=z.object({kind:z.literal('servicenow_terminal_policy_request'),modelSysId:z.string().regex(/^[a-f0-9]{32}$/),sourceReferences:serviceNowTerminalPolicySchema.shape.sourceReferences,terminalStates:serviceNowTerminalPolicySchema.shape.terminalStates,fields:serviceNowTerminalPolicySchema.shape.fields}).strict();
const label=z.string().min(1).max(240).refine(s=>s===s.trim()&&!/[\x00-\x1f\x7f]/.test(s));
export const serviceNowTerminalPolicyOptionsSchema=z.object({connectionId:label,connectionRevision:z.string().datetime(),instanceOrigin:z.string().regex(/^https:\/\/[a-z0-9][a-z0-9-]*\.service-now\.com$/),expiresAt:z.string().datetime(),models:z.array(z.object({id:z.string().regex(/^[a-f0-9]{32}$/),label,modelDigest:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).max(50),truncated:z.boolean()}).strict().refine(v=>new Set(v.models.map(m=>m.id)).size===v.models.length);
export type ServiceNowTerminalPolicyRequest=z.infer<typeof serviceNowTerminalPolicyRequestSchema>;
export type ServiceNowTerminalPolicyOptions=z.infer<typeof serviceNowTerminalPolicyOptionsSchema>;
