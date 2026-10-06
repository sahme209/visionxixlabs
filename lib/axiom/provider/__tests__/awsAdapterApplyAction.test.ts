/**
 * AWSAdapter.applyAction() wraps lib/axiom/applyEngine.ts's AWS_HANDLERS,
 * translating StepResult -> ApplyActionResult. Uses the real handlers
 * (pure, deterministic, no network) rather than mocking them, so this
 * proves the actual current behavior: the `simulated` flag this session
 * added to StepResult passes through the adapter boundary intact, never
 * silently dropped — a caller reading only ApplyActionResult must still
 * see that nothing executed against a live AWS account.
 */

import { describe, expect, it } from "vitest";
import type { ExecutionPlanItem } from "../../executionPlan";

function makeItem(overrides: Partial<ExecutionPlanItem> = {}): ExecutionPlanItem {
  return {
    id: "item-1",
    provider: "aws",
    actionType: "resize_compute",
    resourceIds: ["i-0123456789abcdef0"],
    region: "us-east-1",
    currentState: "4x large",
    recommendedState: "2x large",
    estimatedSavings: { monthly: 100, yearly: 1200 },
    riskLevel: "low",
    requiresDowntime: true,
    rollbackSteps: [],
    ...overrides,
  };
}

describe("AWSAdapter.applyAction", () => {
  it("passes the simulated flag through from the handler — never claims a real mutation", async () => {
    const { AWSAdapter } = await import("../awsAdapter");
    const result = await new AWSAdapter().applyAction(makeItem());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.simulated).toBe(true);
      expect(result.data.success).toBe(true);
    }
  });

  it("returns a real apply_failed error for an action type with no AWS handler", async () => {
    const { AWSAdapter } = await import("../awsAdapter");
    const result = await new AWSAdapter().applyAction(makeItem({ actionType: "purchase_commitment" }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("apply_failed");
  });
});
