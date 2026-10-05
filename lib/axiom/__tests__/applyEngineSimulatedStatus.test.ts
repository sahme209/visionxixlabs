/**
 * Locks in the "simulated" ActionStatus: every current AWS/Azure/GCP
 * handler in applyEngine.ts prepares command text but never calls a
 * real cloud SDK. Before this fix, a successful run always reported
 * "applied"/"verified" — indistinguishable from a real, executed and
 * confirmed mutation. Now the orchestrator must report "simulated"
 * instead, and must never fold it into the "applied" summary count or
 * estimatedMonthlySavings.
 */

import { describe, expect, it } from "vitest";
import {
  applyExecutionPlan,
  AWS_HANDLERS,
  AZURE_HANDLERS,
  GCP_HANDLERS,
} from "../applyEngine";
import type { ExecutionPlan, ExecutionPlanItem } from "../executionPlan";

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

function makePlan(items: ExecutionPlanItem[]): ExecutionPlan {
  return {
    generatedAt: new Date().toISOString(),
    provider: items[0]?.provider ?? "aws",
    accountId: "acct-1",
    items,
    totalEstimatedSavings: { monthly: 0, yearly: 0 },
    summary: "test plan",
  };
}

describe("applyExecutionPlan — simulated status", () => {
  it("reports 'simulated', never 'applied'/'verified', for the current AWS resize_compute handler", async () => {
    const item = makeItem();
    const plan = makePlan([item]);
    const result = await applyExecutionPlan(plan, AWS_HANDLERS, {
      approvedItemIds: [item.id],
      confirmedMediumRiskIds: [],
    });

    expect(result.results[0].status).toBe("simulated");
    expect(result.results[0].status).not.toBe("applied");
    expect(result.results[0].status).not.toBe("verified");
    expect(result.results[0].apply.simulated).toBe(true);
    expect(result.results[0].verify.simulated).toBe(true);
  });

  it("never counts a simulated result in summary.applied or estimatedMonthlySavings", async () => {
    const item = makeItem();
    const plan = makePlan([item]);
    const result = await applyExecutionPlan(plan, AWS_HANDLERS, {
      approvedItemIds: [item.id],
      confirmedMediumRiskIds: [],
    });

    expect(result.summary.applied).toBe(0);
    expect(result.summary.simulated).toBe(1);
    expect(result.summary.estimatedMonthlySavings).toBe(0);
  });

  it("is simulated for apply_storage_policy on every provider", async () => {
    for (const [handlers, provider] of [
      [AWS_HANDLERS, "aws"],
      [AZURE_HANDLERS, "azure"],
      [GCP_HANDLERS, "gcp"],
    ] as const) {
      const item = makeItem({ provider, actionType: "apply_storage_policy" });
      const plan = makePlan([item]);
      const result = await applyExecutionPlan(plan, handlers, {
        approvedItemIds: [item.id],
        confirmedMediumRiskIds: [],
      });
      expect(result.results[0].status).toBe("simulated");
    }
  });

  it("the audit log records the apply step as 'simulated', not 'applied'", async () => {
    const item = makeItem();
    const plan = makePlan([item]);
    const result = await applyExecutionPlan(plan, AWS_HANDLERS, {
      approvedItemIds: [item.id],
      confirmedMediumRiskIds: [],
    });

    const applyAudit = result.auditLog.find((e) => e.action === "apply");
    expect(applyAudit?.status).toBe("simulated");
  });
});
