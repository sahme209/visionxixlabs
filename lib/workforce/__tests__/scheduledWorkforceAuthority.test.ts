import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  workspaces: vi.fn(),
  report: vi.fn(),
  tick: vi.fn(),
  gateway: vi.fn(),
  aiLog: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    cloudAccount: { groupBy: m.workspaces },
    aiRationaleEnrichment: { findMany: async () => [], upsert: m.report },
    agentEngineerRecord: { findMany: async () => [] },
    agentEngineerActionAttempt: { groupBy: async () => [], findFirst: async () => null },
    engineerApprovalSnapshot: { count: async () => 0 },
    axiomFinding: { findMany: async () => [] },
  },
}));
vi.mock("@/lib/ai/AIProviderManager", () => ({ getAIProviderManager: m.gateway }));
vi.mock("@/lib/releaseops/aiCallLogResponder", () => ({
  lookupCircuitState: async () => "closed",
  persistAiCallLog: m.aiLog,
}));
vi.mock("../domains/tickLog", () => ({ persistTickSummary: m.tick }));
vi.mock("../domains/runners", async () => {
  const { runComplianceEngineer, persistComplianceReport } = await import("../domains/complianceEngineer");
  return { DOMAIN_RUNNERS: [{
    engineerId: "compliance_engineer",
    sweepPriority: 10,
    minIntervalMinutes: 120,
    async runAndPersist(organizationId: string) {
      const report = await runComplianceEngineer(organizationId);
      await persistComplianceReport(organizationId, report);
      return report;
    },
  }] };
});

import { GET as specialty } from "@/app/api/cron/engineer-agi-tick/route";
import { GET as domain } from "@/app/api/cron/engineer-domain-tick/route";

function request(authorization?: string) {
  return new NextRequest("https://fixture.invalid/api/cron/test", { headers: authorization ? { authorization } : {} });
}

describe("scheduled Workforce funding authority", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("CRON_SECRET", "fixture-cron");
    vi.stubEnv("AXIOM_WORKSPACE_AI_USAGE_BUDGETS", "");
    m.workspaces.mockResolvedValue([{ organizationId: "fixture-workspace" }]);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("requires the configured bearer before any workspace read", async () => {
    for (const handler of [specialty, domain]) {
      vi.stubEnv("CRON_SECRET", "");
      expect((await handler(request())).status).toBe(503);
      vi.stubEnv("CRON_SECRET", "fixture-cron");
      expect((await handler(request("Bearer wrong"))).status).toBe(401);
    }
    expect(m.workspaces).not.toHaveBeenCalled();
  });

  it("persists the existing specialty rules without opening the model manager", async () => {
    const result = await (await specialty(request("Bearer fixture-cron"))).json();
    expect(result.perWorkspace["fixture-workspace"]).toEqual({ picked: 5, ai_generated: 0, fallback_rules: 5, error: 0 });
    expect(m.report).toHaveBeenCalledTimes(5);
    expect(m.report).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ organizationId: "fixture-workspace", outcome: "fallback_rules", modelHint: null }),
    }));
    expect(m.gateway).not.toHaveBeenCalled();
  });

  it("persists a real domain rule result and counts it honestly in the tick summary", async () => {
    const result = await (await domain(request("Bearer fixture-cron"))).json();
    expect(result.perWorkspace["fixture-workspace"]).toEqual({ picked: 1, ai_generated: 0, fallback_rules: 1, error: 0 });
    expect(m.tick).toHaveBeenCalledExactlyOnceWith("fixture-workspace", expect.objectContaining({
      trigger: "cron", aiGenerated: 0, fallbackRules: 1, error: 0,
    }));
    expect(m.report).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ organizationId: "fixture-workspace", outcome: "fallback_rules" }),
    }));
    expect(m.gateway).not.toHaveBeenCalled();
  });
});
