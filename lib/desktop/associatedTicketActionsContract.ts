import {z} from 'zod';
import {ticketGovernanceReferenceSchema} from '../releaseops/ticketGovernanceReference';
const amendment=z.object({actionId:z.string().regex(/^(jira|servicenow)_action_[a-f0-9]{64}$/),expectedVersion:z.number().int().min(0).max(16)}).strict();
const id=z.string().regex(/^(jira|servicenow)_action_[a-f0-9]{64}$/),nonce=z.string().uuid(),version=z.number().int().min(0).max(2147483647);
export const associatedTicketActionsRequestSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('check_servicenow_corrective_journal'),bindingDigest:ticketGovernanceReferenceSchema.shape.bindingDigest,parentActionId:z.string().regex(/^servicenow_action_[a-f0-9]{64}$/),parentVersion:version,refusedChildActionId:z.string().regex(/^servicenow_action_[a-f0-9]{64}$/),refusedChildVersion:version}).strict(),
 z.object({action:z.literal('prepare_servicenow_corrective_link'),bindingDigest:ticketGovernanceReferenceSchema.shape.bindingDigest,parentActionId:z.string().regex(/^servicenow_action_[a-f0-9]{64}$/),parentVersion:version,refusedChildActionId:z.string().regex(/^servicenow_action_[a-f0-9]{64}$/),refusedChildVersion:version,clientRequestId:nonce}).strict(),
 z.object({action:z.literal('inspect_servicenow_preflight'),bindingDigest:ticketGovernanceReferenceSchema.shape.bindingDigest,actionId:z.string().regex(/^servicenow_action_[a-f0-9]{64}$/),expectedVersion:version}).strict(),
 z.object({action:z.literal('check_servicenow_journal'),bindingDigest:ticketGovernanceReferenceSchema.shape.bindingDigest,parentActionId:z.string().regex(/^servicenow_action_[a-f0-9]{64}$/),parentVersion:version}).strict(),
 z.object({action:z.literal('prepare_servicenow_fresh_link'),bindingDigest:ticketGovernanceReferenceSchema.shape.bindingDigest,parentActionId:z.string().regex(/^servicenow_action_[a-f0-9]{64}$/),parentVersion:version,clientRequestId:nonce}).strict(),
 z.object({action:z.literal('list'),bindingDigest:ticketGovernanceReferenceSchema.shape.bindingDigest}).strict(),
 z.object({action:z.literal('prepare_link'),bindingDigest:ticketGovernanceReferenceSchema.shape.bindingDigest,clientRequestId:nonce,amendment:amendment.optional()}).strict(),
 z.object({action:z.literal('close_options'),bindingDigest:ticketGovernanceReferenceSchema.shape.bindingDigest,actionId:id}).strict(),
 z.object({action:z.literal('prepare_close'),bindingDigest:ticketGovernanceReferenceSchema.shape.bindingDigest,actionId:id,expectedLinkVersion:version,transitionId:z.string().regex(/^[0-9]{1,20}$/),clientRequestId:nonce,amendment:amendment.optional()}).strict(),
 z.object({action:z.literal('servicenow_close_options'),bindingDigest:ticketGovernanceReferenceSchema.shape.bindingDigest,actionId:id,terminalPolicy:ticketGovernanceReferenceSchema}).strict(),
 z.object({action:z.literal('prepare_servicenow_close'),bindingDigest:ticketGovernanceReferenceSchema.shape.bindingDigest,actionId:id,expectedLinkVersion:version,terminalPolicy:ticketGovernanceReferenceSchema,transitionId:z.string().regex(/^[a-f0-9]{32}$/),closeCode:z.string().max(200).optional(),closeNotes:z.string().max(8192).optional(),clientRequestId:nonce,amendment:amendment.optional()}).strict(),
 z.object({action:z.literal('load'),bindingDigest:ticketGovernanceReferenceSchema.shape.bindingDigest,actionId:id}).strict(),
 ...(['approve','cancel','dispatch','recover']as const).map(action=>z.object({action:z.literal(action),bindingDigest:ticketGovernanceReferenceSchema.shape.bindingDigest,actionId:id,expectedVersion:version,clientRequestId:nonce}).strict()),
]);
export type AssociatedTicketActionsRequest=z.infer<typeof associatedTicketActionsRequestSchema>;
