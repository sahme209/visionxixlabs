import {z} from 'zod';
import {ticketGovernanceBindingSchema} from '../../../lib/releaseops/ticketGovernanceReviewContract';
const identity=z.string().min(1).max(240),hash=z.string().regex(/^[a-f0-9]{64}$/);
export const ticketReviewId=z.string().regex(/^ticket_review_[a-f0-9]{64}$/);
export const ticketReviewNonce=z.string().uuid();
export const ticketAssociationSelectionSchema=z.object({kind:z.literal('ticket_release_association_request'),provider:z.enum(['jira','servicenow']),originalActionId:z.string().regex(/^(jira|servicenow)_action_[a-f0-9]{64}$/),evidenceId:z.string().regex(/^release_workflow_evidence_[a-f0-9]{64}$/),expectedHeadVersion:z.number().int().positive()}).strict().refine(v=>v.originalActionId.startsWith(v.provider==='jira'?'jira_action_':'servicenow_action_'));
export type TicketAssociationSelection=z.infer<typeof ticketAssociationSelectionSchema>;
const reviewSchema=z.object({id:ticketReviewId,version:z.number().int().min(0).max(2),status:z.enum(['requested','approved','cancelled','revoked']),binding:ticketGovernanceBindingSchema,bindingDigest:hash,approval:z.object({actorUserId:identity,sessionId:identity,clientRequestId:ticketReviewNonce,approvedAt:z.string().datetime()}).strict().nullable(),canApprove:z.boolean(),canCancel:z.boolean(),current:z.boolean(),providerExecutionAvailable:z.literal(false)}).strict().superRefine((v,c)=>{
 const approved=v.status==='approved'||v.status==='revoked';
 if(Boolean(v.approval)!==approved||v.version!==(v.status==='requested'?0:v.status==='revoked'?2:1)||v.canApprove&&(!v.current||v.status!=='requested')||v.approval&&[v.binding.requesterUserId,v.binding.executorUserId].includes(v.approval.actorUserId))c.addIssue({code:'custom',message:'Invalid ticket review state'});
});
export type TicketGovernanceReview=z.infer<typeof reviewSchema>;
export function isTicketGovernanceReview(value:unknown):value is TicketGovernanceReview{return reviewSchema.safeParse(value).success}
