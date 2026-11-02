import 'server-only';
import {z} from 'zod';
import {identifier,digestSchema} from './contracts';
export const drainScopeSchema=z.object({organizationId:identifier,actorUserId:identifier,sessionId:identifier}).strict();
const version=z.number().int().min(0).max(127);
const parties={organizationId:identifier,epoch:z.string().uuid(),requesterUserId:identifier,executorUserId:identifier,reviewerUserId:identifier,expiresAt:z.string().datetime(),preExistingAdmissionDigest:digestSchema};
export const beginDrainPlanSchema=z.object({...parties,kind:z.literal('begin'),expectedVersion:version.nullable(),candidateDigest:digestSchema,parentDigest:digestSchema.nullable(),manifestDigest:digestSchema,qualificationDigest:digestSchema}).strict();
export const abortDrainPlanSchema=z.object({...parties,kind:z.literal('abort'),expectedVersion:version,restoredAdmissionDigest:digestSchema}).strict();
export const drainDecisionPlanSchema=z.discriminatedUnion('kind',[beginDrainPlanSchema,abortDrainPlanSchema]).superRefine((p,c)=>{if(p.requesterUserId!==p.executorUserId||p.reviewerUserId===p.requesterUserId||p.kind==='abort'&&p.restoredAdmissionDigest!==p.preExistingAdmissionDigest)c.addIssue({code:'custom',message:'invalid drain participants or restoration'})});
export type DrainDecisionPlan=z.infer<typeof drainDecisionPlanSchema>;
export const outboundBindingSchema=z.object({serverNonce:z.string().uuid(),operationId:identifier,attemptId:identifier,profile:identifier,targetDigest:digestSchema,connectionId:identifier,sourceDigest:digestSchema,issuerArtifactDigest:digestSchema}).strict();
export type DrainOutboundBinding=z.infer<typeof outboundBindingSchema>;
export type DrainAuthorityRole='reader'|'administrator'|'reviewer';
export const drainDecisionIdSchema=z.string().regex(/^governance_drain_decision_[a-f0-9]{64}$/);
export const drainSlotIdSchema=z.string().regex(/^governance_outbound_[a-f0-9]{64}$/);

export const drainSavedIdSchema=z.union([drainDecisionIdSchema,drainSlotIdSchema,z.string().regex(/^governance_transition_[a-f0-9]{64}$/)]);
