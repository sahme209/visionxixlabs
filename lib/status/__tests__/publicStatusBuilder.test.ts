import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const evidence = vi.hoisted(() => ({ latestRationale: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  prisma: {
    autonomyDecisionRationale: { findFirst: evidence.latestRationale, count: async () => 0 },
    outboundNotificationRecord: { findMany: async () => [] },
    tenantBillingPlan: { count: async () => 0 },
  },
}));
vi.mock("@/lib/autonomy/agiSelfDiagnostic", () => ({
  runAgiSelfDiagnostic: () => ({ failCount: 0, passCount: 1, totalChecks: 1 }),
}));
vi.mock("@/lib/ai/AIProviderManager", () => ({
  getAIProviderManager: () => ({ status: () => [{ configured: true, provider: "vercel_gateway", defaultModel: "synthetic" }] }),
}));

import { buildPublicStatus } from "../publicStatusBuilder";

describe("autonomy status evidence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T12:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("reports uncertainty when the rationale store has no recent decision", async () => {
    evidence.latestRationale.mockResolvedValue(null);
    const report = await buildPublicStatus();
    expect(report.overall).toBe("unknown");
    expect(report.components.find(component => component.id === "autonomy_loop")).toMatchObject({
      verdict: "unknown",
      detail: "No decision was recorded in the last 24 hours. Scheduler health is unverified.",
    });
  });

  it("reports recent recorded evidence without revealing decision content or volumes", async () => {
    evidence.latestRationale.mockResolvedValue({ id: "synthetic-private-decision" });
    const report = await buildPublicStatus();
    expect(evidence.latestRationale).toHaveBeenCalledWith({
      where: { createdAt: { gte: new Date("2026-11-22T12:00:00.000Z") } },
      select: { id: true },
    });
    expect(report.components.find(component => component.id === "autonomy_loop")).toMatchObject({
      verdict: "operational",
      detail: "A decision was recorded in the last 24 hours.",
    });
    expect(JSON.stringify(report)).not.toContain("synthetic-private-decision");
  });

  it("keeps rationale-store outages unknown without exposing storage errors", async () => {
    evidence.latestRationale.mockRejectedValue(new Error("private storage detail"));
    const report = await buildPublicStatus();
    expect(report.components.find(component => component.id === "autonomy_loop")).toMatchObject({
      verdict: "unknown",
      detail: "Could not query rationale store.",
    });
    expect(JSON.stringify(report)).not.toContain("private storage detail");
  });
});
