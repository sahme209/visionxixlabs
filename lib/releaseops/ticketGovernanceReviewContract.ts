import {z} from 'zod';
import {releaseWorkflowEvidenceBindingSchema} from '@/lib/tauri/releaseWorkflowEvidenceContract';
import {serviceNowInstanceOriginSchema,serviceNowNativeProcessSchema} from './serviceNowTicketLifecycleContract';

export const TICKET_GOVERNANCE_REVIEW_KIND='ticket_governance_review_v1' as const;
const identity=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f-\x9f]/.test(v));
const hash=z.string().regex(/^[a-f0-9]{64}$/),instant=z.string().datetime();
const version=z.number().int().min(0).max(2147483647);
const common={organizationId:identity,requesterUserId:identity,executorUserId:identity,expiresAt:instant};
const original=z.object({releaseId:identity,releaseVersion:version.refine(v=>v>0),intakeDigest:hash,actionId:identity,actionVersion:version,payloadDigest:hash,recoveryDigest:hash.nullable()}).strict();
export const ticketAssociationTargetSchema=z.discriminatedUnion('provider',[
 z.object({provider:z.literal('jira'),connectionId:identity,connectionRevision:instant,siteId:z.string().uuid(),issue:z.object({id:z.string().regex(/^[0-9]{1,20}$/),key:z.string().regex(/^[A-Z][A-Z0-9_]*-[1-9][0-9]*$/).max(128)}).strict()}).strict(),
 z.object({provider:z.literal('servicenow'),connectionId:identity,connectionRevision:instant,instanceOrigin:serviceNowInstanceOriginSchema,issue:z.object({sysId:z.string().regex(/^[a-f0-9]{32}$/),number:z.string().regex(/^CHG[0-9]{1,20}$/)}).strict()}).strict(),
]);
export const ticketReleaseAssociationSchema=z.object({...common,kind:z.literal('ticket_release_association'),original,ticket:ticketAssociationTargetSchema,ticketReadDigest:hash,deployment:z.object({headReleaseVersion:version.refine(v=>v>0),headIntakeDigest:hash,binding:releaseWorkflowEvidenceBindingSchema,evidenceId:z.string().regex(/^release_workflow_evidence_[a-f0-9]{64}$/),evidenceDigest:hash,acceptedOperationId:z.string().regex(/^release_deployment_[a-f0-9]{64}$/)}).strict()}).strict().superRefine((v,c)=>{
 if(v.deployment.binding.organizationId!==v.organizationId||v.deployment.headReleaseVersion<v.deployment.binding.releaseVersion||v.deployment.headReleaseVersion===v.deployment.binding.releaseVersion&&v.deployment.headIntakeDigest!==v.deployment.binding.intakeDigest)c.addIssue({code:'custom',message:'Deployment scope changed'});
 if(!v.original.actionId.startsWith(v.ticket.provider==='jira'?'jira_action_':'servicenow_action_')||!new RegExp('^(?:jira|servicenow)_action_[a-f0-9]{64}$').test(v.original.actionId))c.addIssue({code:'custom',message:'Ticket source changed'});
});
const stateValue=z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const field=z.object({name:z.enum(['close_code','close_notes']),label:identity,required:z.boolean(),writable:z.literal(true),type:z.literal('string'),maxBytes:z.number().int().positive().max(8192),choices:z.array(z.object({value:identity,label:identity}).strict()).min(1).max(100).optional()}).strict();
export const serviceNowTerminalPolicySchema=z.object({...common,kind:z.literal('servicenow_terminal_policy'),connectionId:identity,connectionRevision:instant,instanceOrigin:serviceNowInstanceOriginSchema,nativeProcess:serviceNowNativeProcessSchema,modelDigest:hash,provenance:z.literal('administrator_declared'),sourceReferences:z.array(z.object({reference:identity,digest:hash}).strict()).min(1).max(20),terminalStates:z.array(z.object({value:stateValue,label:identity,outcome:z.literal('closed')}).strict()).min(1).max(20),fields:z.array(field).max(2)}).strict().superRefine((v,c)=>{
 if(new Set(v.terminalStates.map(s=>s.value)).size!==v.terminalStates.length||new Set(v.fields.map(f=>f.name)).size!==v.fields.length||new Set(v.sourceReferences.map(r=>r.reference)).size!==v.sourceReferences.length||v.fields.some(f=>f.name==='close_notes'&&f.choices!==undefined||f.name==='close_code'&&!f.choices?.length||f.choices&&new Set(f.choices.map(x=>x.value)).size!==f.choices.length))c.addIssue({code:'custom',message:'Policy choices are ambiguous'});
});
export const ticketGovernanceBindingSchema=z.union([ticketReleaseAssociationSchema,serviceNowTerminalPolicySchema]);
export type TicketGovernanceBinding=z.infer<typeof ticketGovernanceBindingSchema>;
export type TicketReleaseAssociation=z.infer<typeof ticketReleaseAssociationSchema>;
export type ServiceNowTerminalPolicy=z.infer<typeof serviceNowTerminalPolicySchema>;
export const ticketReviewScopeSchema=z.object({organizationId:identity,actorUserId:identity,sessionId:identity}).strict();
export type TicketReviewScope=z.infer<typeof ticketReviewScopeSchema>;
