import { beforeEach, describe, expect, it, vi } from "vitest";
import { agentActionDigest } from "../proposalIntegrity";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn(), createTurn: vi.fn(), createAudit: vi.fn(), execute: vi.fn(),
}));
const transactionRepo = {
  agentActionProposal: { updateMany: mocks.updateMany, update: mocks.update },
  agentConversationTurn: { create: mocks.createTurn },
  secureAuditRecord: { create: mocks.createAudit },
};
vi.mock("@/lib/db", () => ({ prisma: {
  ...transactionRepo,
  agentActionProposal: { ...transactionRepo.agentActionProposal, findFirst: mocks.findFirst },
  $transaction: (callback: (tx: typeof transactionRepo) => unknown) => callback(transactionRepo),
} }));
vi.mock("../actionApprovalResponder", () => ({ executeApprovedAction: mocks.execute }));

const base = {
  id: "proposal-1", organizationId: "org-1", conversationId: "conversation-1", proposedByUserId: "author-1",
  toolName: "open_github_pull_request", argsJson: { repositoryFullName: "acme/app" }, riskLevel: "medium", status: "proposed",
  createdAt: new Date("2026-10-13T10:00:00Z"), approvalExpiresAt: new Date("2026-10-14T10:00:00Z"),
};
const actionDigest = agentActionDigest({ organizationId: base.organizationId, conversationId: base.conversationId, proposedByUserId: base.proposedByUserId, toolName: base.toolName, args: base.argsJson });

describe("browser agent approval decision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue({ ...base, actionDigest });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.update.mockResolvedValue({});
    mocks.createTurn.mockResolvedValue({});
    mocks.createAudit.mockResolvedValue({});
    mocks.execute.mockResolvedValue({ ok: true, result: { number: 42 } });
  });

  it("forbids the proposer from approving their own action", async () => {
    const { decideAgentAction } = await import("../browserApprovalDecision");
    expect(await decideAgentAction({ organizationId: "org-1", proposalId: base.id, actorUserId: "author-1", actorRole: "owner", decision: "approve" }))
      .toEqual({ ok: false, error: "self_approval_forbidden" });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("fails closed when the action changed after proposal", async () => {
    mocks.findFirst.mockResolvedValue({ ...base, actionDigest: "tampered" });
    const { decideAgentAction } = await import("../browserApprovalDecision");
    expect(await decideAgentAction({ organizationId: "org-1", proposalId: base.id, actorUserId: "reviewer-1", actorRole: "admin", decision: "approve" }))
      .toEqual({ ok: false, error: "proposal_integrity_failed" });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("expires stale approval authority without executing", async () => {
    const { decideAgentAction } = await import("../browserApprovalDecision");
    expect(await decideAgentAction({ organizationId: "org-1", proposalId: base.id, actorUserId: "reviewer-1", actorRole: "admin", decision: "approve", now: new Date("2026-10-15T10:00:00Z") }))
      .toEqual({ ok: false, error: "approval_expired" });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("prevents replay when another decision wins the compare-and-set", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    const { decideAgentAction } = await import("../browserApprovalDecision");
    expect(await decideAgentAction({ organizationId: "org-1", proposalId: base.id, actorUserId: "reviewer-1", actorRole: "admin", decision: "approve" }))
      .toEqual({ ok: false, error: "already_decided" });
    expect(mocks.createAudit).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("atomically records rejection evidence", async () => {
    const { decideAgentAction } = await import("../browserApprovalDecision");
    expect(await decideAgentAction({ organizationId: "org-1", proposalId: base.id, actorUserId: "reviewer-1", actorRole: "security_reviewer", decision: "reject" }))
      .toEqual({ ok: true, status: "rejected" });
    expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "approval.deny", entityRef: `agent_action:${base.id}` }) }));
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
