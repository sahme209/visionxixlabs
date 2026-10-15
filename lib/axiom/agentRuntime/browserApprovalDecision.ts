import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { agentActionDigest } from "./proposalIntegrity";
import { executeApprovedAction, type ActionExecutionRepo } from "./actionApprovalResponder";
import { readWorkspaceAgentIdentity } from "./agentIdentityPolicy";

export type BrowserApprovalResult =
  | { ok: true; status: "rejected" | "executed" | "failed"; errorMessage?: string | null }
  | { ok: false; error: "not_found" | "already_decided" | "self_approval_forbidden" | "approval_expired" | "proposal_integrity_failed" | "workspace_agent_disabled" | "workspace_agent_policy_unavailable" | "agent_tool_not_allowed" };

export async function decideAgentAction(input: {
  organizationId: string;
  proposalId: string;
  actorUserId: string;
  actorRole: string;
  decision: "approve" | "reject";
  correlationId?: string;
  now?: Date;
}): Promise<BrowserApprovalResult> {
  const now = input.now ?? new Date();
  const correlationId = input.correlationId ?? `approval_${randomUUID()}`;
  const proposal = await prisma.agentActionProposal.findFirst({ where: { id: input.proposalId, organizationId: input.organizationId } });
  if (!proposal) return { ok: false, error: "not_found" };
  if (proposal.status !== "proposed") return { ok: false, error: "already_decided" };
  if (proposal.proposedByUserId === input.actorUserId) return { ok: false, error: "self_approval_forbidden" };

  const expiresAt = proposal.approvalExpiresAt ?? new Date(proposal.createdAt.getTime() + 24 * 60 * 60 * 1000);
  if (expiresAt <= now) {
    await prisma.agentActionProposal.updateMany({ where: { id: proposal.id, organizationId: input.organizationId, status: "proposed" }, data: { status: "expired", decidedAt: now } });
    return { ok: false, error: "approval_expired" };
  }

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
  const claimed = await prisma.$transaction(async (tx) => {
    const claim = await tx.agentActionProposal.updateMany({
      where: { id: proposal.id, organizationId: input.organizationId, status: "proposed", actionDigest: digest },
      data: { status: claimedStatus, decidedByUserId: input.actorUserId, decidedAt: now },
    });
    if (claim.count !== 1) return false;
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
      occurredAt: now,
      detail: { actionDigest: digest, actorRole: input.actorRole, toolName: proposal.toolName, riskLevel: proposal.riskLevel },
    } });
    if (input.decision === "reject") {
      await tx.agentConversationTurn.create({ data: { conversationId: proposal.conversationId, role: "tool_result", actionProposalId: proposal.id, content: `${proposal.toolName} was rejected.` } });
    }
    return true;
  });
  if (!claimed) return { ok: false, error: "already_decided" };
  if (input.decision === "reject") return { ok: true, status: "rejected" };

  const execution = await executeApprovedAction(
    prisma as unknown as ActionExecutionRepo,
    input.organizationId,
    proposal.toolName,
    proposal.argsJson as Record<string, unknown>,
    input.actorUserId,
    `agent-action:${proposal.id}`,
  );
  const status = execution.ok ? "executed" : "failed";
  await prisma.$transaction(async (tx) => {
    await tx.agentActionProposal.update({ where: { id: proposal.id }, data: {
      status,
      resultJson: execution.ok ? (execution.result as Prisma.InputJsonValue) : undefined,
      errorMessage: execution.ok ? null : execution.error,
      executedAt: new Date(),
    } });
    await tx.agentConversationTurn.create({ data: {
      conversationId: proposal.conversationId,
      role: "tool_result",
      actionProposalId: proposal.id,
      content: execution.ok ? `${proposal.toolName} approved and executed.`
        : execution.error === "deployment_outcome_unknown"
          ? `${proposal.toolName} approved; provider outcome unconfirmed. Its reservation is retained. Review the external outcome before retrying.`
          : `${proposal.toolName} approved but failed: ${execution.error}`,
    } });
  });
  return execution.ok ? { ok: true, status } : { ok: true, status, errorMessage: execution.error };
}
