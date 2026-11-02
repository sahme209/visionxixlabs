import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { agentActionDigest } from "./proposalIntegrity";
import {hasDesktopCapability,type DesktopWorkspaceRole} from "@/lib/desktop/desktopAuthorization";
import { readWorkspaceAgentIdentity } from "./agentIdentityPolicy";

export type BrowserApprovalResult =
  | { ok: true; status: "approved" | "rejected"; errorMessage?: string | null }
  | { ok: false; error: "not_found" | "already_decided" | "self_approval_forbidden" | "approval_expired" | "proposal_integrity_failed" | "workspace_agent_disabled" | "workspace_agent_policy_unavailable" | "agent_tool_not_allowed" | "governance_execution_coverage_unavailable" | "approval_authority_required" | "approval_authority_unavailable" };

export async function decideAgentAction(input: {
  organizationId: string;
  proposalId: string;
  actorUserId: string;
  actorRole: string;
  decision: "approve" | "reject";
  correlationId?: string;
  now?: Date;
}): Promise<BrowserApprovalResult> {
  const correlationId = input.correlationId ?? `approval_${randomUUID()}`;
  const proposal = await prisma.agentActionProposal.findFirst({ where: { id: input.proposalId, organizationId: input.organizationId } });
  if (!proposal) return { ok: false, error: "not_found" };
  if (proposal.status !== "proposed") return { ok: false, error: "already_decided" };
  // A proposer may stop a pending action; only execution approval needs a distinct reviewer.
  if (input.decision === "approve" && proposal.proposedByUserId === input.actorUserId) return { ok: false, error: "self_approval_forbidden" };

  const expiresAt = proposal.approvalExpiresAt ?? new Date(proposal.createdAt.getTime() + 24 * 60 * 60 * 1000);
  // Expiry is handled only after current membership and source locks below.
  // A removed caller must not mutate even an elapsed proposal by requesting stop.

  const digest = agentActionDigest({
    organizationId: proposal.organizationId,
    conversationId: proposal.conversationId,
    proposedByUserId: proposal.proposedByUserId,
    toolName: proposal.toolName,
    args: proposal.argsJson,
  });
  if (!proposal.actionDigest || proposal.actionDigest !== digest) return { ok: false, error: "proposal_integrity_failed" };

  // Proposal-time permission is not perpetual execution authority. Operators
  // must still be able to reject a proposal after revoking Agent access.
  if (input.decision === "approve") {
    try {
      const identity = await readWorkspaceAgentIdentity(input.organizationId);
      if (!identity?.enabled) return { ok: false, error: "workspace_agent_disabled" };
      if (!identity.allowedTools.includes(proposal.toolName)) return { ok: false, error: "agent_tool_not_allowed" };
    } catch {
      return { ok: false, error: "workspace_agent_policy_unavailable" };
    }
  }


  const claimedStatus = input.decision === "approve" ? "approved" : "rejected";
  try { return await prisma.$transaction(async (tx):Promise<BrowserApprovalResult> => {
    const rows=await tx.$queryRaw<Array<{organizationId:string;userId:string;role:string;acceptedAt:Date|null}>>`SELECT "organizationId","userId","role","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${input.organizationId} AND "userId"=${input.actorUserId} FOR SHARE`;
    const member=rows[0],required=input.decision==='reject'&&input.actorUserId===proposal.proposedByUserId?'workspace:read':'agent:approve';
    if(rows.length!==1||!member||member.organizationId!==input.organizationId||member.userId!==input.actorUserId||!(member.acceptedAt instanceof Date)||!Number.isFinite(member.acceptedAt.getTime())||!['owner','admin','operator','security_reviewer','finance_viewer','read_only'].includes(member.role)||!hasDesktopCapability(member.role as DesktopWorkspaceRole,required))return{ok:false,error:'approval_authority_required'};
    // Acquire both authority/source locks before sampling time. Sampling before
    // a contended proposal lock could approve an already-expired decision.
    const locked=await tx.$queryRaw<Array<{id:string}>>`SELECT "id" FROM "AgentActionProposal" WHERE "id"=${proposal.id} AND "organizationId"=${input.organizationId} FOR UPDATE`;
    if(locked.length!==1||locked[0].id!==proposal.id)return{ok:false,error:'already_decided'};
    const clocks=await tx.$queryRaw<Array<{checkedAt:Date}>>`SELECT clock_timestamp() AS "checkedAt"`;
    const decidedAt=clocks[0]?.checkedAt;
    if(clocks.length!==1||!(decidedAt instanceof Date)||!Number.isFinite(decidedAt.getTime()))return{ok:false,error:'approval_authority_unavailable'};
    if(expiresAt<=decidedAt){await tx.agentActionProposal.updateMany({where:{id:proposal.id,organizationId:input.organizationId,status:'proposed',actionDigest:digest},data:{status:'expired',decidedAt}});return{ok:false,error:'approval_expired'}}
    const claim = await tx.agentActionProposal.updateMany({
      where: { id: proposal.id, organizationId: input.organizationId, status: "proposed", actionDigest: digest,conversationId:proposal.conversationId,proposedByUserId:proposal.proposedByUserId,toolName:proposal.toolName,argsJson:{equals:proposal.argsJson as Prisma.InputJsonValue},approvalExpiresAt:proposal.approvalExpiresAt },
      data: { status: claimedStatus, decidedByUserId: input.actorUserId, decidedAt },
    });
    if (claim.count !== 1) return {ok:false,error:'already_decided'};
    await tx.secureAuditRecord.create({ data: {
      id: `aud_${randomUUID()}`,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      actorKind: "user",
      action: input.decision === "approve" ? "approval.grant" : "approval.deny",
      outcome: "success",
      entityRef: `agent_action:${proposal.id}`,
      correlationId,
      source: "live",
      occurredAt: decidedAt,
      detail: { actionDigest: digest, actorRole: member.role, toolName: proposal.toolName, riskLevel: proposal.riskLevel,decisionFormat:'agent_review_only_v1',requesterUserId:proposal.proposedByUserId,expiresAt:expiresAt.toISOString() },
    } });
    await tx.agentConversationTurn.create({ data: { conversationId: proposal.conversationId, role: "tool_result", actionProposalId: proposal.id, content: input.decision==='reject'?`${proposal.toolName} was rejected.`:`${proposal.toolName} review approved. Waiting for the requester to execute this exact action; nothing has been executed.` } });
    // Review is deliberately not execution. The future requester operation must
    // load this versioned review evidence; old approved history cannot adopt it.
    return {ok:true,status:claimedStatus};
  }); }catch{return{ok:false,error:'approval_authority_unavailable'}}
}
