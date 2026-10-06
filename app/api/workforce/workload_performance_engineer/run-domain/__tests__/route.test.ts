/**
 * Locks in: a transient failure reading the workspace's AI usage meter
 * must degrade to the same graceful "blocked" redirect + audit record
 * the route already gives for an exhausted credit pool — not an
 * uncaught exception. checkWorkspaceAICredits({ failClosedOnUsageReadError:
 * true }) throws on a usage-read failure by design; this route previously
 * called it outside any try/catch, so that throw propagated uncaught to
 * Next.js's generic 500 handler instead of the intended redirect.
 *
 * Same pattern applies to compliance_framework_engineer, dr_planner_engineer,
 * safety-preflight/run, and sweep-now (not independently tested here —
 * none of these routes had test coverage before this fix; this is the
 * representative case for the shared pattern).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireContext: vi.fn(),
  checkWorkspaceAICredits: vi.fn(),
  recordAudit: vi.fn(),
  runWorkloadPerformanceEngineer: vi.fn(),
  persistWorkloadPerformanceAnalysis: vi.fn(),
}));

vi.mock("@/lib/auth/currentContext", () => ({ requireContext: mocks.requireContext }));
vi.mock("@/lib/billing/checkWorkspaceAICredits", () => ({ checkWorkspaceAICredits: mocks.checkWorkspaceAICredits }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.recordAudit }));
vi.mock("@/lib/workforce/domains/workloadPerformanceEngineer", () => ({
  runWorkloadPerformanceEngineer: mocks.runWorkloadPerformanceEngineer,
  persistWorkloadPerformanceAnalysis: mocks.persistWorkloadPerformanceAnalysis,
  WORKLOAD_PERFORMANCE_TARGET_KIND: "workload_performance",
}));

function formRequest() {
  const body = new URLSearchParams({
    title: "Checkout latency regression",
    serviceDescription: "checkout-api",
    telemetrySnapshot: "p99 latency 4200ms, up from 800ms",
  });
  return new Request("https://visionxixlabs.com/api/workforce/workload_performance_engineer/run-domain", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

describe("POST /api/workforce/workload_performance_engineer/run-domain — credit-check failure handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireContext.mockResolvedValue({ organizationId: "org-1", userId: "user-1" });
  });

  it("redirects to the blocked state instead of throwing when the credit meter read fails", async () => {
    mocks.checkWorkspaceAICredits.mockRejectedValue(new Error("ai_credit_meter_unavailable"));
    const { POST } = await import("../route");

    const res = await POST(formRequest());

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("blocked=credits_exhausted");
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "billing.entitlement_blocked",
        outcome: "blocked",
        detail: expect.objectContaining({ reason: "credit_meter_unavailable" }),
      }),
    );
    expect(mocks.runWorkloadPerformanceEngineer).not.toHaveBeenCalled();
  });

  it("still blocks normally (without a thrown error) when the credit pool itself is exhausted", async () => {
    mocks.checkWorkspaceAICredits.mockResolvedValue({ kind: "block", reason: "credit_pool_exhausted", remainingCents: 0 });
    const { POST } = await import("../route");

    const res = await POST(formRequest());

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("blocked=credits_exhausted");
  });

  it("proceeds to run the engineer when credits are available", async () => {
    mocks.checkWorkspaceAICredits.mockResolvedValue({ kind: "allow" });
    mocks.runWorkloadPerformanceEngineer.mockResolvedValue({
      id: "analysis-1",
      outcome: "ok",
      performanceVerdict: "healthy",
      baselineDeviations: [],
      rootCauseHypotheses: [],
      slug: "analysis-1",
    });
    mocks.persistWorkloadPerformanceAnalysis.mockResolvedValue(undefined);
    const { POST } = await import("../route");

    await POST(formRequest());

    expect(mocks.runWorkloadPerformanceEngineer).toHaveBeenCalled();
  });
});
