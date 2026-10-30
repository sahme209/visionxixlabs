import {z} from 'zod';
import {ticketGovernanceReferenceSchema} from './ticketGovernanceReference';
import {serviceNowInstanceOriginSchema} from './serviceNowTicketLifecycleContract';
const identity=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f-\x9f]/.test(v));
const hash=z.string().regex(/^[a-f0-9]{64}$/),sysId=z.string().regex(/^[a-f0-9]{32}$/),time=z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
export const writtenJournalProofSchema=z.object({present:z.literal(true),changeSysId:sysId,entryDigest:hash,observedAt:time,entry:z.object({id:sysId,createdAt:time}).strict()}).strict();
/** Evidence-only review. This contract cannot authorize provider execution. */
export const serviceNowWrittenLinkObservationSchema=z.object({kind:z.literal('servicenow_written_link_observation_v1'),organizationId:identity,requesterUserId:identity,executorUserId:identity,expiresAt:z.string().datetime(),originalActionId:z.string().regex(/^servicenow_action_[a-f0-9]{64}$/),originalVersion:z.number().int().min(1),originalCandidateDigest:hash,originalStatus:z.literal('unknown'),originalAttemptCount:z.literal(1),payloadDigest:hash,issue:z.object({sysId,number:z.string().regex(/^CHG[0-9]{1,20}$/)}).strict(),connectionId:identity,connectionRevision:z.string().datetime(),instanceOrigin:serviceNowInstanceOriginSchema,association:z.object({reviewId:z.string().regex(/^ticket_review_[a-f0-9]{64}$/),bindingDigest:hash}).strict(),logicalMarker:z.string().regex(/^servicenow_action_[a-f0-9]{64}$/),proof:writtenJournalProofSchema,providerExecutionAuthorized:z.literal(false)}).strict().superRefine((v,c)=>{if(v.requesterUserId!==v.executorUserId||v.issue.sysId!==v.proof.changeSysId)c.addIssue({code:'custom',message:'Observation scope changed'})});

export const serviceNowWrittenObservationRequestSchema=z.object({kind:z.literal('servicenow_written_link_observation_request'),actionId:z.string().regex(/^servicenow_action_[a-f0-9]{64}$/),expectedVersion:z.number().int().min(1).max(2147483647),association:ticketGovernanceReferenceSchema}).strict();
export type ServiceNowWrittenObservationRequest=z.infer<typeof serviceNowWrittenObservationRequestSchema>;
