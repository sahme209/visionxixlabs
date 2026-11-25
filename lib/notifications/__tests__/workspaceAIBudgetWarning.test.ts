import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  transaction: vi.fn(),
  readSettings: vi.fn(),
  budgetEnabled: vi.fn(),
  isolated: vi.fn(),
}));

vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.context }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/billing/workspaceAIUsageBudget", () => ({ workspaceAIUsageBudgetsEnabled: mocks.budgetEnabled }));
vi.mock("@/lib/billing/workspaceAIUsageBudgetSettings", () => ({ readWorkspaceBudgetSettings: mocks.readSettings }));
vi.mock("@/lib/billing/isolatedApplication/runtime", () => ({ isolatedRuntimeRequested: mocks.isolated }));
vi.mock("@/lib/risk/riskQueueBuilder", () => ({ buildRiskQueue: async () => ({ items: [] }) }));
vi.mock("@/lib/integrations/integrationHealthChecker", () => ({ buildIntegrationHealthReport: async () => ({ entries: [] }) }));
vi.mock("@/lib/intelligence/priorityEngine", () => ({ buildPriorityReport: async () => ({}) }));
vi.mock("@/lib/axiomOS/axiomOSStateBuilder", () => ({
  buildAxiomOSState: async () => ({ criticalBlockers: [], generatedAt: "2026-11-24T12:00:00.000Z" }),
}));

import { GET } from "@/app/api/notifications/route";

function request() {
  return GET(new NextRequest("https://example.invalid/api/notifications?organizationId=other"));
}

describe("workspace AI budget warning", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.context.mockResolvedValue({ isAuthenticated: true, userId: "user-1", organizationId: "org-1", roles: ["owner"] });
    mocks.budgetEnabled.mockReturnValue(true);
    mocks.isolated.mockReturnValue(false);
    mocks.transaction.mockImplementation(run => run({}));
    mocks.readSettings.mockResolvedValue({ kind: "ok", data: { budget: { warningReached: true, remainingCents: 900 } } });
  });

  it("uses the signed-in actor and workspace to show a single actionable warning", async () => {
    const response = await request();
    const { data } = await response.json();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.readSettings).toHaveBeenCalledWith({}, { organizationId: "org-1", userId: "user-1" });
    expect(data.summary).toMatchObject({ total: 1, warning: 1 });
    expect(data.notifications).toMatchObject([{
      type: "workspace_ai_budget_warning", severity: "warning", route: { href: "/control/usage-billing" },
    }]);
    expect(JSON.stringify(data.notifications)).not.toContain("900");
  });

  it.each([{ kind: "ok", data: { budget: null } }, { kind: "ok", data: { budget: { warningReached: false } } }, { kind: "forbidden" }])(
    "keeps cleared and unauthorized warnings out of the report", async result => {
      mocks.readSettings.mockResolvedValue(result);
      const { data } = await (await request()).json();
      expect(data.notifications).toEqual([]);
    },
  );

  it.each(["member", "flag off", "isolated", "actor missing"])("skips the billing read for %s", async reason => {
    if (reason === "member") mocks.context.mockResolvedValue({ isAuthenticated: true, userId: "user-1", organizationId: "org-1", roles: ["operator"] });
    if (reason === "flag off") mocks.budgetEnabled.mockReturnValue(false);
    if (reason === "isolated") mocks.isolated.mockReturnValue(true);
    if (reason === "actor missing") mocks.context.mockResolvedValue({ isAuthenticated: true, organizationId: "org-1", roles: ["owner"] });
    const { data } = await (await request()).json();
    expect(data.notifications).toEqual([]);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("reports unavailable evidence without failing the notification center", async () => {
    mocks.transaction.mockRejectedValue(new Error("private storage error"));
    const { data } = await (await request()).json();
    expect(data.notifications).toEqual([]);
    expect(data.limitations).toContain("The workspace AI budget warning could not be verified.");
    expect(JSON.stringify(data)).not.toContain("private storage error");
  });
});
