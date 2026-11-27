// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ addOns: vi.fn(), settle: vi.fn(), supporters: vi.fn(), plans: vi.fn(), members: vi.fn(), repoGroup: vi.fn(), deployGroup: vi.fn(), usageGroup: vi.fn(), pending: vi.fn(), feedback: vi.fn(), questions: vi.fn(), leadGroup: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {
  addOnPurchase: { findMany: m.addOns }, aIUsageBillingSettlement: { findMany: m.settle }, foundingSupporterPurchase: { findMany: m.supporters }, tenantBillingPlan: { findMany: m.plans },
  orgMembership: { findMany: m.members }, repository: { groupBy: m.repoGroup }, deploymentExecution: { groupBy: m.deployGroup }, usageEvent: { groupBy: m.usageGroup },
  agentGatewayRequest: { count: m.pending }, feedbackRecord: { findMany: m.feedback }, helpQueryRecord: { findMany: m.questions }, lead: { groupBy: m.leadGroup },
} }));
import { readBusinessOverview } from "../founderBusiness";
const NOW = new Date("2026-11-27T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
beforeEach(() => {
  vi.clearAllMocks();
  for (const f of Object.values(m)) f.mockResolvedValue([]);
  m.pending.mockResolvedValue(0);
});

describe("readBusinessOverview", () => {
  it("sums collected revenue net of refunds and compares with the 30 days before", async () => {
    m.addOns.mockResolvedValue([{ organizationId: "org_a", pricePaidCents: 5000, refundedAmountCents: 1000, createdAt: day(2) }, { organizationId: "org_a", pricePaidCents: 2000, refundedAmountCents: 0, createdAt: day(40) }]);
    m.settle.mockResolvedValue([{ organizationId: "org_b", amountCents: 1000, submittedAt: day(1), createdAt: day(1) }]);
    m.plans.mockResolvedValue([{ organizationId: "org_a", tier: "pro", status: "active", seatQuantity: 3 }, { organizationId: "org_c", tier: "free", status: "active", seatQuantity: null }]);
    const o = await readBusinessOverview(NOW);
    expect(o.revenue).toMatchObject({ last30Cents: 5000, previous30Cents: 2000, changePct: 150, mrrListCents: 8700, paidWorkspaces: 1 });
    expect(o.revenue!.bySource).toEqual([{ source: "AI credits and add-ons", cents: 4000 }, { source: "Usage billing", cents: 1000 }]);
    expect(m.addOns.mock.calls[0][0].where.status).toEqual({ in: ["paid", "partially_refunded"] });
  });
  it("computes AI margin per model and leaves out feedback authors", async () => {
    m.usageGroup.mockImplementation(async (args: { by: string[] }) => args.by[0] === "model" ? [{ model: "m1", _count: { _all: 10 }, _sum: { costCents: 40, billedCents: 100 } }] : args.by[0] === "eventKind" ? [{ eventKind: "ai_invocation", _count: { _all: 10 } }] : []);
    m.feedback.mockResolvedValue([{ createdAt: day(1), sentiment: "negative", pagePath: "/x", message: "Too slow\n  to load" }]);
    const o = await readBusinessOverview(NOW);
    expect(o.ai).toMatchObject({ calls30: 10, costCents: 40, billedCents: 100, marginPct: 60 });
    expect(o.product!.latest[0]).toEqual({ at: day(1).toISOString(), sentiment: "negative", page: "/x", excerpt: "Too slow to load" });
    expect(Object.keys(m.feedback.mock.calls[0][0].select)).not.toContain("email");
  });
  it("finds the activation funnel and at-risk paying workspaces", async () => {
    m.members.mockResolvedValue([{ organizationId: "a", createdAt: day(3) }, { organizationId: "b", createdAt: day(100) }]);
    m.repoGroup.mockResolvedValue([{ organizationId: "a" }]);
    m.plans.mockResolvedValue([{ organizationId: "b", tier: "pro", status: "active", cancelAtPeriodEnd: false }, { organizationId: "a", tier: "pro", status: "past_due", cancelAtPeriodEnd: false }]);
    const o = await readBusinessOverview(NOW);
    expect(o.customers!.funnel.steps.map((s) => s.count)).toEqual([2, 1, 0, 0]);
    expect(o.customers!.new30).toBe(1);
    expect(o.customers!.atRisk.map((x) => x.reason).sort()).toEqual(["Paid plan, no activity in 14 days", "Payment past due"]);
  });
  it("reports a section it cannot read as unavailable", async () => {
    m.questions.mockRejectedValue(new Error("db"));
    expect((await readBusinessOverview(NOW)).support).toBeNull();
  });
});
