/**
 * Runtime action gate — exhaustive invariant tests.
 *
 * These tests are the load-bearing safety check for Phase 362:
 * if any of them fail the platform's enforcement promise is broken.
 */

import { describe, expect, it } from "vitest";
import {
  evaluateEngineerActionAttempt,
  canTightenApprovalRule,
  tightest,
  type EngineerActionAttempt,
  type ResolveContext,
} from "../runtimeActionGate";
import type { AgentEngineer, ApprovalRule } from "../agentWorkforceRegistry";

// Test helpers --------------------------------------------------------------

function mkEngineer(overrides: Partial<AgentEngineer> = {}): AgentEngineer {
  return {
    id: "test_engineer",
    displayName: "Test Engineer",
    role: "test role",
    department: "planning",
    productLayer: "client",
    kernelModules: ["testKernel"],
    requiredTools: [],
    requiredConnectors: [],
    requiredPermissions: [],
    requiresDesktopApp: false,
    cliExposed: false,
    ideExposed: false,
    requiredBackendServices: [],
    automationWorkflows: [],
    highestRiskAction: "Test action",
    approvalRule: "single_approver",
    auditTopics: ["test.attempted"],
    missingPieces: [],
    ...overrides,
  };
}

function mkAttempt(overrides: Partial<EngineerActionAttempt> = {}): EngineerActionAttempt {
  return {
    workspaceId: "ws_test_client",
    engineerId: "test_engineer",
    action: "test_action",
    riskLevel: "low",
    isReadOnly: false,
    requestedBy: "user_alice",
    ...overrides,
  };
}

// Tightening invariant ------------------------------------------------------

describe("canTightenApprovalRule", () => {
  it("allows tightening across the rule ladder", () => {
    expect(canTightenApprovalRule("no_approval_needed", "single_approver")).toBe(true);
    expect(canTightenApprovalRule("single_approver", "two_step_approval")).toBe(true);
    expect(canTightenApprovalRule("two_step_approval", "incident_commander_only")).toBe(true);
    expect(canTightenApprovalRule("incident_commander_only", "blocked_always")).toBe(true);
    expect(canTightenApprovalRule("no_approval_needed", "blocked_always")).toBe(true);
  });

  it("blocks loosening", () => {
    expect(canTightenApprovalRule("single_approver", "no_approval_needed")).toBe(false);
    expect(canTightenApprovalRule("two_step_approval", "single_approver")).toBe(false);
    expect(canTightenApprovalRule("blocked_always", "two_step_approval")).toBe(false);
    expect(canTightenApprovalRule("blocked_always", "no_approval_needed")).toBe(false);
  });

  it("allows keeping the same rule (idempotent set)", () => {
    expect(canTightenApprovalRule("single_approver", "single_approver")).toBe(true);
    expect(canTightenApprovalRule("blocked_always", "blocked_always")).toBe(true);
  });
});

describe("tightest", () => {
  it("returns the strictest of two rules", () => {
    expect(tightest("single_approver", "two_step_approval")).toBe("two_step_approval");
    expect(tightest("no_approval_needed", "blocked_always")).toBe("blocked_always");
    expect(tightest("two_step_approval", "single_approver")).toBe("two_step_approval");
  });
});

// Unknown engineer ----------------------------------------------------------

describe("evaluateEngineerActionAttempt — unknown engineer", () => {
  it("blocks an unknown engineer id", () => {
    const v = evaluateEngineerActionAttempt(mkAttempt(), { engineer: undefined });
    expect(v.decision).toBe("blocked");
    expect(v.policySource).toBe("engineer_unknown");
    expect(v.effectiveRule).toBe("blocked_always");
  });
});

// Disabled engineer ---------------------------------------------------------

describe("evaluateEngineerActionAttempt — disabled in workspace", () => {
  it("blocks when workspaceEnabled is false", () => {
    const v = evaluateEngineerActionAttempt(mkAttempt(), {
      engineer: mkEngineer(),
      workspaceEnabled: false,
    });
    expect(v.decision).toBe("blocked");
    expect(v.policySource).toBe("engineer_disabled");
  });
});

// Internal-layer leakage ----------------------------------------------------

describe("evaluateEngineerActionAttempt — internal-layer leakage protection", () => {
  it("blocks an internal_admin engineer running in a client workspace", () => {
    const internal = mkEngineer({ productLayer: "internal_admin" });
    const v = evaluateEngineerActionAttempt(mkAttempt(), { engineer: internal });
    expect(v.decision).toBe("blocked");
    expect(v.policySource).toBe("engineer_disabled");
  });

  it("permits an internal_admin engineer in the internal-admin workspace", () => {
    const internal = mkEngineer({ productLayer: "internal_admin", approvalRule: "single_approver" });
    const v = evaluateEngineerActionAttempt(
      mkAttempt({ workspaceId: "ws_internal_admin_visionxixlabs" }),
      { engineer: internal },
    );
    // Action requires approval (single_approver) — but it's NOT blocked.
    expect(v.decision).toBe("requires_approval");
    expect(v.requiredApprovers).toBe(1);
  });
});

// blocked_always invariant --------------------------------------------------

describe("evaluateEngineerActionAttempt — blocked_always invariant", () => {
  it("blocks when canonical rule is blocked_always", () => {
    const e = mkEngineer({ approvalRule: "blocked_always" });
    const v = evaluateEngineerActionAttempt(mkAttempt({ riskLevel: "read_only", isReadOnly: true }), { engineer: e });
    expect(v.decision).toBe("blocked");
    expect(v.effectiveRule).toBe("blocked_always");
    expect(v.policySource).toBe("policy_block_invariant");
  });
});

// no_approval_needed fast-path ----------------------------------------------

describe("evaluateEngineerActionAttempt — no_approval_needed fast-path", () => {
  it("auto-allows a genuine read-only action", () => {
    const e = mkEngineer({ approvalRule: "no_approval_needed" });
    const v = evaluateEngineerActionAttempt(
      mkAttempt({ riskLevel: "read_only", isReadOnly: true }),
      { engineer: e },
    );
    expect(v.decision).toBe("allowed");
    expect(v.requiredApprovers).toBe(0);
  });

  it("refuses an action that claims read-only but declares a higher risk", () => {
    const e = mkEngineer({ approvalRule: "no_approval_needed" });
    const v = evaluateEngineerActionAttempt(
      mkAttempt({ riskLevel: "high", isReadOnly: true }),
      { engineer: e },
    );
    expect(v.decision).toBe("blocked");
    expect(v.policySource).toBe("risk_floor_block");
  });

  it("escalates a write action to approval even when the rule says no_approval_needed", () => {
    const e = mkEngineer({ approvalRule: "no_approval_needed" });
    const v = evaluateEngineerActionAttempt(
      mkAttempt({ riskLevel: "medium", isReadOnly: false }),
      { engineer: e },
    );
    expect(v.decision).toBe("requires_approval");
    expect(v.effectiveRule).toBe("single_approver");
  });
});

// Risk floor ---------------------------------------------------------------

describe("evaluateEngineerActionAttempt — risk floor", () => {
  it("forces two_step_approval for critical actions even on loose rules", () => {
    const e = mkEngineer({ approvalRule: "no_approval_needed" });
    const v = evaluateEngineerActionAttempt(
      mkAttempt({ riskLevel: "critical", isReadOnly: false }),
      { engineer: e },
    );
    expect(v.decision).toBe("requires_approval");
    expect(v.effectiveRule).toBe("two_step_approval");
    expect(v.requiredApprovers).toBe(2);
  });

  it("forces single_approver for medium actions", () => {
    const e = mkEngineer({ approvalRule: "no_approval_needed" });
    const v = evaluateEngineerActionAttempt(
      mkAttempt({ riskLevel: "medium", isReadOnly: false }),
      { engineer: e },
    );
    expect(v.effectiveRule).toBe("single_approver");
  });
});

// Workspace override --------------------------------------------------------

describe("evaluateEngineerActionAttempt — workspace overrides", () => {
  it("applies a tightening override", () => {
    const e = mkEngineer({ approvalRule: "single_approver" });
    const v = evaluateEngineerActionAttempt(
      mkAttempt({ riskLevel: "low", isReadOnly: false }),
      { engineer: e, workspaceOverride: "two_step_approval" },
    );
    expect(v.decision).toBe("requires_approval");
    expect(v.policySource).toBe("workspace_override");
    expect(v.requiredApprovers).toBe(2);
  });

  it("ignores a loosening override (silently falls back to canonical)", () => {
    const e = mkEngineer({ approvalRule: "two_step_approval" });
    const v = evaluateEngineerActionAttempt(
      mkAttempt({ riskLevel: "low", isReadOnly: false }),
      { engineer: e, workspaceOverride: "single_approver" }, // attempting to loosen
    );
    // Override rejected — canonical stays in force.
    expect(v.effectiveRule).toBe("two_step_approval");
    expect(v.requiredApprovers).toBe(2);
    expect(v.policySource).toBe("canonical_default");
  });

  it("an override to blocked_always always wins", () => {
    const e = mkEngineer({ approvalRule: "single_approver" });
    const v = evaluateEngineerActionAttempt(
      mkAttempt({ riskLevel: "read_only", isReadOnly: true }),
      { engineer: e, workspaceOverride: "blocked_always" },
    );
    expect(v.decision).toBe("blocked");
    expect(v.effectiveRule).toBe("blocked_always");
  });
});

// Required approvers --------------------------------------------------------

describe("evaluateEngineerActionAttempt — required approvers", () => {
  const cases: Array<[ApprovalRule, number]> = [
    ["single_approver", 1],
    ["two_step_approval", 2],
    ["incident_commander_only", 1],
  ];

  for (const [rule, expected] of cases) {
    it(`requires ${expected} approver(s) for ${rule}`, () => {
      const e = mkEngineer({ approvalRule: rule });
      const v = evaluateEngineerActionAttempt(
        mkAttempt({ riskLevel: "low", isReadOnly: false }),
        { engineer: e },
      );
      expect(v.requiredApprovers).toBe(expected);
    });
  }
});
