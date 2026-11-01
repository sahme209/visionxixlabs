import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {hasDesktopCapability,type DesktopWorkspaceRole} from '@/lib/desktop/desktopAuthorization';
import {agentActionDigest} from './proposalIntegrity';
export const AGENT_ACTION_EXECUTION_KIND='agent_action_execution_v1' as const;
export const AGENT_EXECUTION_TOOLS=['create_github_branch','commit_github_file','commit_github_files','open_github_pull_request','trigger_aws_deploy','create_environment','configure_deployment_target','connect_identity_provider'] as const;
const id=z.string().min(1).max(240).refine(v=>v.trim()===v&&!/[\x00-\x1f\x7f]/.test(v));
const digest=z.string().regex(/^[a-f0-9]{64}$/),instant=z.string().datetime();
export const agentExecutionScopeSchema=z.object({organizationId:id,actorUserId:id,sessionId:id}).strict();
export type AgentExecutionScope=z.infer<typeof agentExecutionScopeSchema>;
export const agentReviewEvidenceSchema=z.object({organizationId:id,proposalId:id,conversationId:id,proposalDigest:digest,toolName:z.enum(AGENT_EXECUTION_TOOLS),requesterUserId:id,reviewerUserId:id,reviewId:id,reviewDigest:digest,reviewedAt:instant,expiresAt:instant}).strict();
export type AgentReviewEvidence=z.infer<typeof agentReviewEvidenceSchema>;
const proposalSchema=z.object({id,organizationId:id,conversationId:id,proposedByUserId:id,toolName:z.enum(AGENT_EXECUTION_TOOLS),argsJson:z.record(z.string(),z.unknown()),riskLevel:z.enum(['low','medium','high']),status:z.literal('approved'),actionDigest:digest,decidedByUserId:id,decidedAt:z.date(),createdAt:z.date(),approvalExpiresAt:z.date().nullable()}).passthrough();
const detailSchema=z.object({decisionFormat:z.literal('agent_review_only_v1'),actionDigest:digest,requesterUserId:id,actorRole:z.enum(['owner','admin','operator','security_reviewer','finance_viewer','read_only']),toolName:z.enum(AGENT_EXECUTION_TOOLS),riskLevel:z.enum(['low','medium','high']),expiresAt:instant}).strict();
const auditSchema=z.object({id,organizationId:id,actorUserId:id,actorKind:z.literal('user'),action:z.literal('approval.grant'),outcome:z.literal('success'),entityRef:id,source:z.literal('live'),occurredAt:z.date(),detail:detailSchema,errorCode:z.null().optional()}).passthrough();
/** Exact source-row evidence only, never permission. Storage readers must obtain
 * both original rows; callers cannot turn an object or marker into authority. */
export function readApprovedAgentReview(rawProposal:unknown,rawAudit:unknown,now:Date):AgentReviewEvidence {
 try{
  const p=proposalSchema.parse(rawProposal),a=auditSchema.parse(rawAudit),at=z.date().parse(now).getTime();
  const actual=agentActionDigest({organizationId:p.organizationId,conversationId:p.conversationId,proposedByUserId:p.proposedByUserId,toolName:p.toolName,args:p.argsJson});
  const expires=p.approvalExpiresAt??new Date(p.createdAt.getTime()+86400000);
  if(actual!==p.actionDigest||a.organizationId!==p.organizationId||a.entityRef!==`agent_action:${p.id}`||a.actorUserId!==p.decidedByUserId||p.decidedByUserId===p.proposedByUserId||a.occurredAt.getTime()!==p.decidedAt.getTime()||p.createdAt>p.decidedAt||p.decidedAt.getTime()>at||expires.getTime()<=at||p.decidedAt>=expires||a.detail.actionDigest!==actual||a.detail.requesterUserId!==p.proposedByUserId||a.detail.toolName!==p.toolName||a.detail.riskLevel!==p.riskLevel||a.detail.expiresAt!==expires.toISOString()||!hasDesktopCapability(a.detail.actorRole as DesktopWorkspaceRole,'agent:approve'))throw Error();
  const normalizedAudit={id:a.id,organizationId:a.organizationId,actorUserId:a.actorUserId,actorKind:a.actorKind,action:a.action,outcome:a.outcome,entityRef:a.entityRef,source:a.source,occurredAt:a.occurredAt.toISOString(),detail:a.detail};
  return Object.freeze(agentReviewEvidenceSchema.parse({organizationId:p.organizationId,proposalId:p.id,conversationId:p.conversationId,proposalDigest:actual,toolName:p.toolName,requesterUserId:p.proposedByUserId,reviewerUserId:p.decidedByUserId,reviewId:a.id,reviewDigest:sha256ContentHash(normalizedAudit),reviewedAt:p.decidedAt.toISOString(),expiresAt:expires.toISOString()}));
 }catch{throw Error('agent_review_evidence_unavailable')}
}
export function agentActionExecutionId(organizationId:string,proposalId:string,proposalDigest:string){return 'agent_execution_'+sha256ContentHash({kind:AGENT_ACTION_EXECUTION_KIND,organizationId:id.parse(organizationId),proposalId:id.parse(proposalId),proposalDigest:digest.parse(proposalDigest)})}
export const agentExecutionBindingSchema=z.object({format:z.literal(1),scope:agentExecutionScopeSchema,review:agentReviewEvidenceSchema,createdAt:instant}).strict();
export type AgentExecutionBinding=z.infer<typeof agentExecutionBindingSchema>;
export const agentExecutionReceiptSchema=z.object({code:z.enum(['action_completed','pre_dispatch_refused','provider_outcome_unknown']),references:z.array(z.object({kind:z.enum(['github_branch','github_commit','github_pull_request','github_workflow','environment','deployment_target','identity_provider']),id}).strict()).max(16).optional()}).strict();
export type AgentExecutionReceipt=z.infer<typeof agentExecutionReceiptSchema>;
export const agentExecutionStateSchema=z.object({state:z.enum(['prepared','dispatching','confirmed','refused','unknown','cancelled']),receipt:agentExecutionReceiptSchema.optional()}).strict();
