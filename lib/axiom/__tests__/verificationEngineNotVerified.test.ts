/**
 * verificationEngine.ts generates read-only CLI commands for a human to
 * run themselves — it never performs a real cloud read. Before this
 * fix, every check hardcoded `passed: true`, so a successful apply
 * always reported `verified: true` even though nothing was ever
 * confirmed. Locks in: no action type can ever produce a "verified"
 * result or true `allVerified()` until a real tenant-bound read exists.
 */

import { describe, expect, it } from "vitest";
import {
  allVerified,
  getVerificationCommands,
  verifyAllActions,
  verifyAppliedAction,
  type VerificationResult,
} from "../verificationEngine";
import type { ActionType, ExecutionPlanItem } from "../executionPlan";

function makeItem(actionType: ActionType, overrides: Partial<ExecutionPlanItem> = {}): ExecutionPlanItem {
  return {
    id: `item-${actionType}`,
    provider: "aws",
    actionType,
    resourceIds: ["i-0123456789abcdef0"],
    region: "us-east-1",
    currentState: "before",
    recommendedState: "after",
    estimatedSavings: { monthly: 100, yearly: 1200 },
    riskLevel: "low",
    requiresDowntime: false,
    rollbackSteps: [],
    ...overrides,
  };
}

const ALL_ACTION_TYPES: ActionType[] = [
  "resize_compute",
  "apply_storage_policy",
  "purchase_commitment",
  "decommission_compute",
  "restrict_public_access",
  "enable_backup",
];

describe("verifyAppliedAction — never fabricates a verified result", () => {
  it.each(ALL_ACTION_TYPES)("reports verified:false and status:not_verified for %s", (actionType) => {
    const result = verifyAppliedAction(makeItem(actionType));

    expect(result.verified).toBe(false);
    expect(result.status).toBe("not_verified");
  });

  it.each(ALL_ACTION_TYPES)("every individual check for %s is status:not_verified, never a pass", (actionType) => {
    const result = verifyAppliedAction(makeItem(actionType));

    expect(result.checks.length).toBeGreaterThan(0);
    for (const check of result.checks) {
      expect(check.status).toBe("not_verified");
    }
  });

  it("reports not_verified for an action type with no registered verifier", () => {
    const result = verifyAppliedAction(makeItem("unknown_action" as ActionType));

    expect(result.verified).toBe(false);
    expect(result.status).toBe("not_verified");
    expect(result.checks).toEqual([]);
  });

  it("still returns the generated human-runnable command text — advisory content is not deleted", () => {
    const result = verifyAppliedAction(makeItem("resize_compute"));
    const commands = getVerificationCommands(makeItem("resize_compute"));

    expect(result.details.length).toBeGreaterThan(0);
    expect(commands.length).toBeGreaterThan(0);
  });
});

describe("allVerified — never true without a real verified result", () => {
  it("is false for a full batch of current (always not_verified) results", () => {
    const items = ALL_ACTION_TYPES.map((t) => makeItem(t));
    const results = verifyAllActions(items);

    expect(allVerified(results)).toBe(false);
  });

  it("is false for an empty batch — absence of failures is not success", () => {
    expect(allVerified([])).toBe(false);
  });

  it("would only be true if every result's status were the real 'verified' value (not reachable today)", () => {
    const fakeRealResult: VerificationResult = {
      itemId: "x",
      actionType: "resize_compute",
      provider: "aws",
      verified: true,
      status: "verified",
      details: [],
      warnings: [],
      checks: [],
      durationMs: 0,
    };
    expect(allVerified([fakeRealResult])).toBe(true);
    expect(allVerified([fakeRealResult, { ...fakeRealResult, status: "not_verified", verified: false }])).toBe(false);
  });
});
