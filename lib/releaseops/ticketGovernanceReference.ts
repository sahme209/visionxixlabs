import {z} from 'zod';
/** References identify an independently approved governance record, never its authority. */
export const ticketGovernanceReferenceSchema=z.object({reviewId:z.string().regex(/^ticket_review_[a-f0-9]{64}$/),bindingDigest:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export type TicketGovernanceReference=z.infer<typeof ticketGovernanceReferenceSchema>;
