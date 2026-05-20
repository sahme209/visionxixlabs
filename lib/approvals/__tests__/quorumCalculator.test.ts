/**
 * Vitest unit tests for the pure approval-quorum calculator.
 */

import { describe, it, expect } from "vitest";
import { calculateQuorum, type ApprovalRecord, type QuorumPolicy } from "../quorumCalculator";

const REC = (approver: string, role: ApprovalRecord["role"], decision: ApprovalRecord["decision"]): ApprovalRecord =>
  ({ approver, role, decision, decidedAt: "2026-05-20T01:00:00.000Z" });

describe("quorumCalculator", () => {
  it("empty records + totalApprovals=0 → passed=true", () => {
    const r = calculateQuorum([], { totalApprovals: 0 });
    expect(r.passed).toBe(true);
    expect(r.reason).toBeNull();
  });

  it("not enough total approvals → failed with reason", () => {
    const r = calculateQuorum(
      [REC("alice", "platform_admin", "approve")],
      { totalApprovals: 2 },
    );
    expect(r.passed).toBe(false);
    expect(r.reason).toContain("need 2 total");
  });

  it("perRole requirement enforced", () => {
    const r = calculateQuorum(
      [REC("alice", "platform_admin", "approve"), REC("bob", "platform_admin", "approve")],
      { totalApprovals: 2, perRole: { security: 1 } },
    );
    expect(r.passed).toBe(false);
    expect(r.reason).toContain("security approval");
  });

  it("passes when both total and perRole satisfied", () => {
    const r = calculateQuorum(
      [REC("alice", "platform_admin", "approve"), REC("eve", "security", "approve")],
      { totalApprovals: 2, perRole: { security: 1, platform_admin: 1 } },
    );
    expect(r.passed).toBe(true);
  });

  it("vetoOnReject=true: single reject blocks even if approvals meet threshold", () => {
    const r = calculateQuorum(
      [REC("alice", "platform_admin", "approve"), REC("bob", "platform_admin", "approve"), REC("eve", "security", "reject")],
      { totalApprovals: 2, vetoOnReject: true },
    );
    expect(r.passed).toBe(false);
    expect(r.reason).toContain("veto");
  });

  it("rejects counted but don't block when vetoOnReject=false", () => {
    const r = calculateQuorum(
      [REC("alice", "platform_admin", "approve"), REC("bob", "platform_admin", "approve"), REC("eve", "security", "reject")],
      { totalApprovals: 2 },
    );
    expect(r.passed).toBe(true);
    expect(r.rejects).toBe(1);
  });

  it("perRole approvals tallied independently of total", () => {
    const r = calculateQuorum(
      [REC("a", "platform_admin", "approve"), REC("b", "platform_admin", "approve"), REC("c", "security", "approve")],
      { totalApprovals: 3 },
    );
    expect(r.perRoleApprovals).toEqual({ platform_admin: 2, security: 1 });
  });
});
