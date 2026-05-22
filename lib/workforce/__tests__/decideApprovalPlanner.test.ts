import { describe, it, expect } from "vitest";
import { planDecideApproval, type PlanDecideInput } from "../decideApprovalPlanner";
import type { QuorumDecision } from "../approvalQuorum";

const baseSnapshot = (overrides: Partial<{ organizationId: string; status: string; requiredApprovers: number }> = {}) => ({
  organizationId: "ws_acme",
  status: "pending",
  requiredApprovers: 1,
  ...overrides,
});

const baseInput = (overrides: Partial<PlanDecideInput> = {}): PlanDecideInput => ({
  rawDecision: "approved",
  viewerOrganizationId: "ws_acme",
  snapshot: baseSnapshot(),
  engineSourceId: "engineer:migration_engineer:apply_migration:up:users",
  existingDecisions: [] as ReadonlyArray<QuorumDecision>,
  newApproverUserId: "user_alice",
  ...overrides,
});

describe("planDecideApproval — guard order", () => {
  it("rejects invalid decision (garbage body)", () => {
    const r = planDecideApproval(baseInput({ rawDecision: "maybe" }));
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("invalid_decision");
  });

  it("rejects when rawDecision is undefined", () => {
    const r = planDecideApproval(baseInput({ rawDecision: undefined }));
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("invalid_decision");
  });

  it("rejects when snapshot lookup missed", () => {
    const r = planDecideApproval(baseInput({ snapshot: null }));
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("approval_not_found");
  });

  it("rejects cross-tenant attempt", () => {
    const r = planDecideApproval(baseInput({
      viewerOrganizationId: "ws_attacker",
      snapshot: baseSnapshot({ organizationId: "ws_victim" }),
    }));
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("cross_tenant");
  });

  it("rejects when snapshot already approved", () => {
    const r = planDecideApproval(baseInput({
      snapshot: baseSnapshot({ status: "approved" }),
    }));
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("already_decided");
  });

  it("rejects when snapshot already rejected", () => {
    const r = planDecideApproval(baseInput({
      snapshot: baseSnapshot({ status: "rejected" }),
    }));
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("already_decided");
  });

  it("rejects when snapshot expired (sweeper terminal state)", () => {
    const r = planDecideApproval(baseInput({
      snapshot: baseSnapshot({ status: "expired" }),
    }));
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("already_decided");
  });

  it("rejects when engine row exists but is not engineer-sourced", () => {
    const r = planDecideApproval(baseInput({
      engineSourceId: "human:user_op:apply_change",
    }));
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("not_engineer_sourced");
  });

  it("accepts when engine row is null (post-restart, trust snapshot)", () => {
    const r = planDecideApproval(baseInput({ engineSourceId: null }));
    expect(r.kind).toBe("accept");
  });
});

describe("planDecideApproval — quorum projection", () => {
  it("requiredApprovers=1, no prior votes, approve → terminal approved", () => {
    const r = planDecideApproval(baseInput({
      snapshot: baseSnapshot({ requiredApprovers: 1 }),
    }));
    expect(r.kind).toBe("accept");
    if (r.kind === "accept") {
      expect(r.quorum.status).toBe("approved");
      expect(r.quorum.isTerminal).toBe(true);
      expect(r.quorum.approvedCount).toBe(1);
    }
  });

  it("requiredApprovers=2, no prior votes, approve → partial (pending)", () => {
    const r = planDecideApproval(baseInput({
      snapshot: baseSnapshot({ requiredApprovers: 2 }),
    }));
    expect(r.kind).toBe("accept");
    if (r.kind === "accept") {
      expect(r.quorum.status).toBe("pending");
      expect(r.quorum.isTerminal).toBe(false);
      expect(r.quorum.approvedCount).toBe(1);
    }
  });

  it("requiredApprovers=2, one prior approve from u_bob, u_alice approves → terminal approved", () => {
    const r = planDecideApproval(baseInput({
      snapshot: baseSnapshot({ requiredApprovers: 2 }),
      existingDecisions: [{ approverUserId: "user_bob", decision: "approved" }],
      newApproverUserId: "user_alice",
    }));
    expect(r.kind).toBe("accept");
    if (r.kind === "accept") {
      expect(r.quorum.status).toBe("approved");
      expect(r.quorum.isTerminal).toBe(true);
      expect(r.quorum.approvedBy).toEqual(["user_alice", "user_bob"]);
    }
  });

  it("any reject short-circuits, even with prior approves", () => {
    const r = planDecideApproval(baseInput({
      rawDecision: "rejected",
      snapshot: baseSnapshot({ requiredApprovers: 3 }),
      existingDecisions: [
        { approverUserId: "user_bob", decision: "approved" },
        { approverUserId: "user_carol", decision: "approved" },
      ],
    }));
    expect(r.kind).toBe("accept");
    if (r.kind === "accept") {
      expect(r.quorum.status).toBe("rejected");
      expect(r.quorum.isTerminal).toBe(true);
    }
  });

  it("requiredApprovers=3, second approve still partial", () => {
    const r = planDecideApproval(baseInput({
      snapshot: baseSnapshot({ requiredApprovers: 3 }),
      existingDecisions: [{ approverUserId: "user_bob", decision: "approved" }],
    }));
    expect(r.kind).toBe("accept");
    if (r.kind === "accept") {
      expect(r.quorum.status).toBe("pending");
      expect(r.quorum.approvedCount).toBe(2);
    }
  });

  it("guard ordering: invalid_decision fires before cross_tenant", () => {
    // Both guards would reject; invalid must win because it's earlier.
    const r = planDecideApproval(baseInput({
      rawDecision: 42,
      viewerOrganizationId: "ws_attacker",
      snapshot: baseSnapshot({ organizationId: "ws_victim" }),
    }));
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("invalid_decision");
  });

  it("guard ordering: cross_tenant fires before already_decided", () => {
    const r = planDecideApproval(baseInput({
      viewerOrganizationId: "ws_attacker",
      snapshot: baseSnapshot({ organizationId: "ws_victim", status: "approved" }),
    }));
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("cross_tenant");
  });

  it("guard ordering: already_decided fires before not_engineer_sourced", () => {
    const r = planDecideApproval(baseInput({
      snapshot: baseSnapshot({ status: "approved" }),
      engineSourceId: "human:something_else",
    }));
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("already_decided");
  });
});
