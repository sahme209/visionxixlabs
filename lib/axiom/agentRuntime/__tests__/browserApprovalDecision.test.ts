import { beforeEach, describe, expect, it, vi } from "vitest";
import { agentActionDigest } from "../proposalIntegrity";

const mocks = vi.hoisted(() => ({
  lock:vi.fn(),clock:vi.fn(),authority:vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn(), createTurn: vi.fn(), createAudit: vi.fn(), execute: vi.fn(), identity: vi.fn(), enrollment:vi.fn(),
}));
const transactionRepo = {
  $queryRaw:(sql:TemplateStringsArray,...values:unknown[])=>sql.join('').includes('AgentActionProposal')?mocks.lock(sql,...values):sql.join('').includes('clock_timestamp')?mocks.clock():mocks.authority(sql,...values),
  durableAgentWorkflow:{findMany:mocks.enrollment},
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
vi.mock("../agentIdentityPolicy", () => ({ readWorkspaceAgentIdentity: mocks.identity }));

const base = {
  id: "proposal-1", organizationId: "org-1", conversationId: "conversation-1", proposedByUserId: "author-1",
  toolName: "open_github_pull_request", argsJson: { repositoryFullName: "acme/app" }, riskLevel: "medium", status: "proposed",
  createdAt: new Date("2026-10-13T10:00:00Z"), approvalExpiresAt: new Date("2026-10-14T10:00:00Z"),
};
const reviewNow = new Date("2026-10-13T12:00:00Z");
const actionDigest = agentActionDigest({ organizationId: base.organizationId, conversationId: base.conversationId, proposedByUserId: base.proposedByUserId, toolName: base.toolName, args: base.argsJson });

describe("browser agent approval decision", () => {
  beforeEach(() => {
    vi.clearAllMocks();mocks.lock.mockResolvedValue([{id:base.id}]);mocks.clock.mockResolvedValue([{checkedAt:reviewNow}]);mocks.authority.mockImplementation(async(_sql,org,user)=>[{organizationId:org,userId:user,role:'admin',acceptedAt:reviewNow,checkedAt:reviewNow}]);mocks.enrollment.mockResolvedValue([]);
    mocks.findFirst.mockResolvedValue({ ...base, actionDigest });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.update.mockResolvedValue({});
    mocks.createTurn.mockResolvedValue({});
    mocks.createAudit.mockResolvedValue({});
    mocks.execute.mockResolvedValue({ ok: true, result: { number: 42 } });
    mocks.identity.mockResolvedValue({ enabled: true, allowedTools: [base.toolName] });
  });

  it.each([
    [null, "workspace_agent_disabled"],
    [{ enabled: false, allowedTools: [base.toolName] }, "workspace_agent_disabled"],
    [{ enabled: true, allowedTools: [] }, "agent_tool_not_allowed"],
  ])("blocks approval when current policy is %j", async (identity, error) => {
    mocks.identity.mockResolvedValue(identity);
    const { decideAgentAction } = await import("../browserApprovalDecision");
    expect(await decideAgentAction({ organizationId: "org-1", proposalId: base.id, actorUserId: "reviewer-1", actorRole: "admin", decision: "approve", now: reviewNow })).toEqual({ ok: false, error });
    expect(mocks.identity).toHaveBeenCalledWith("org-1");
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("fails closed when current Agent policy cannot be read", async () => {
    mocks.identity.mockRejectedValue(new Error("policy store unavailable"));
    const { decideAgentAction } = await import("../browserApprovalDecision");
    expect(await decideAgentAction({ organizationId: "org-1", proposalId: base.id, actorUserId: "reviewer-1", actorRole: "admin", decision: "approve", now: reviewNow })).toEqual({ ok: false, error: "workspace_agent_policy_unavailable" });
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("still permits rejection when the Agent has been disabled", async () => {
    mocks.identity.mockRejectedValue(new Error("policy store unavailable"));
    const { decideAgentAction } = await import("../browserApprovalDecision");
    expect(await decideAgentAction({ organizationId: "org-1", proposalId: base.id, actorUserId: "reviewer-1", actorRole: "admin", decision: "reject", now: reviewNow })).toEqual({ ok: true, status: "rejected" });
    expect(mocks.identity).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('records a current separately reviewed action without executing it',async()=>{
    const {decideAgentAction}=await import('../browserApprovalDecision');
    expect(await decideAgentAction({organizationId:'org-1',proposalId:base.id,actorUserId:'reviewer-1',actorRole:'admin',decision:'approve',now:reviewNow})).toEqual({ok:true,status:'approved'});
    expect(mocks.execute).not.toHaveBeenCalled();expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.createTurn).toHaveBeenCalledWith({data:expect.objectContaining({content:expect.stringContaining('Waiting for the requester')})});
  });
  it.each(['failed','executed','approved'])('never adopts consumed %s history as a new approval',async status=>{
    mocks.findFirst.mockResolvedValue({...base,actionDigest,status,errorMessage:'action_outcome_unknown'});
    const {decideAgentAction}=await import('../browserApprovalDecision');
    expect(await decideAgentAction({organizationId:'org-1',proposalId:base.id,actorUserId:'reviewer-1',actorRole:'admin',decision:'approve',now:reviewNow})).toEqual({ok:false,error:'already_decided'});
    expect(mocks.execute).not.toHaveBeenCalled();expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("lets an authorized proposer reject their own pending action without execution authority", async () => {
    mocks.identity.mockRejectedValue(new Error("Agent disabled"));
    const { decideAgentAction } = await import("../browserApprovalDecision");
    expect(await decideAgentAction({ organizationId: "org-1", proposalId: base.id, actorUserId: "author-1", actorRole: "owner", decision: "reject", now: reviewNow })).toEqual({ ok: true, status: "rejected" });
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.identity).not.toHaveBeenCalled();
    expect(mocks.createAudit).toHaveBeenCalledWith({ data: expect.objectContaining({ actorUserId: "author-1", action: "approval.deny" }) });
    expect(mocks.createTurn).toHaveBeenCalledWith({ data: expect.objectContaining({ content: "open_github_pull_request was rejected." }) });
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
    expect(await decideAgentAction({ organizationId: "org-1", proposalId: base.id, actorUserId: "reviewer-1", actorRole: "admin", decision: "approve", now: reviewNow }))
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
    expect(await decideAgentAction({ organizationId: "org-1", proposalId: base.id, actorUserId: "reviewer-1", actorRole: "admin", decision: "approve", now: reviewNow }))
      .toEqual({ ok: false, error: "already_decided" });
    expect(mocks.createAudit).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("atomically records rejection evidence", async () => {
    const { decideAgentAction } = await import("../browserApprovalDecision");
    expect(await decideAgentAction({ organizationId: "org-1", proposalId: base.id, actorUserId: "reviewer-1", actorRole: "security_reviewer", decision: "reject", now: reviewNow }))
      .toEqual({ ok: true, status: "rejected" });
    expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "approval.deny", entityRef: `agent_action:${base.id}` }) }));
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it.each(['enrolled','unavailable'])('records review while %s execution coverage remains separately refused',async state=>{
    if(state==='enrolled')mocks.enrollment.mockResolvedValue([{id:'governance_active_x',organizationId:'org-1',workflowKind:'governance_baseline_active_v1'}]);else mocks.enrollment.mockRejectedValue(Error('unavailable'));
    const {decideAgentAction}=await import('../browserApprovalDecision');
    expect(await decideAgentAction({organizationId:'org-1',proposalId:base.id,actorUserId:'reviewer-1',actorRole:'admin',decision:'approve',now:reviewNow})).toEqual({ok:true,status:'approved'});
    expect(mocks.enrollment).not.toHaveBeenCalled();expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('records review only and never invokes execution under the reviewer identity',async()=>{
    mocks.authority.mockResolvedValue([{organizationId:'org-1',userId:'reviewer-1',role:'security_reviewer',acceptedAt:reviewNow,checkedAt:reviewNow}]);
    const {decideAgentAction}=await import('../browserApprovalDecision');
    expect(await decideAgentAction({organizationId:'org-1',proposalId:base.id,actorUserId:'reviewer-1',actorRole:'security_reviewer',decision:'approve',now:reviewNow})).toEqual({ok:true,status:'approved'});
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.createAudit).toHaveBeenCalledWith({data:expect.objectContaining({action:'approval.grant',detail:expect.objectContaining({decisionFormat:'agent_review_only_v1'})})});
  });

  it('refuses a stale caller role when current persisted membership cannot approve',async()=>{
    mocks.authority.mockResolvedValue([{organizationId:'org-1',userId:'reviewer-1',role:'operator',acceptedAt:reviewNow,checkedAt:reviewNow}]);
    const {decideAgentAction}=await import('../browserApprovalDecision');
    expect(await decideAgentAction({organizationId:'org-1',proposalId:base.id,actorUserId:'reviewer-1',actorRole:'admin',decision:'approve',now:reviewNow})).toEqual({ok:false,error:'approval_authority_required'});
    expect(mocks.updateMany).not.toHaveBeenCalled();expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('refuses expiry reached at the locked decision check even if initial policy lookup started in time',async()=>{
    mocks.clock.mockResolvedValue([{checkedAt:base.approvalExpiresAt}]);
    const {decideAgentAction}=await import('../browserApprovalDecision');
    expect(await decideAgentAction({organizationId:'org-1',proposalId:base.id,actorUserId:'reviewer-1',actorRole:'admin',decision:'approve',now:reviewNow})).toEqual({ok:false,error:'approval_expired'});
    expect(mocks.execute).not.toHaveBeenCalled();expect(mocks.createAudit).not.toHaveBeenCalled();
  });

});
