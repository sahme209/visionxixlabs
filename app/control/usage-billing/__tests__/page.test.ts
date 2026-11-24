/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const io = vi.hoisted(() => ({ members: vi.fn(), usage: vi.fn(), settled: vi.fn(), pending: vi.fn(), purchases: vi.fn(), quota: vi.fn(), plan: vi.fn(), holds: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/billing/isolatedApplication/scope", () => ({ withIsolatedWorkspaceScope: (_context: unknown, _kind: unknown, operation: () => unknown) => operation() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: async () => ({ isAuthenticated: true, organizationId: "org_evidence", email: "owner@example.test", roles: ["owner"] }) }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: () => true }));
vi.mock("@/lib/billing/stripeHelper", () => ({ describeStripeStatus: () => ({ mode: "test" }) }));
vi.mock("@/lib/billing/deploymentQuota", () => ({ checkDeploymentQuota: io.quota }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: async (fn: (tx: unknown) => unknown) => fn({ tenantBillingPlan: { findUnique: io.plan }, addOnPurchase: { findMany: io.purchases }, usageEvent: { aggregate: io.usage }, aIUsageReservation: { aggregate: io.holds } }), tenantBillingPlan: { findUnique: io.plan }, orgMembership: { count: io.members }, usageEvent: { aggregate: (query: {where: {billingStatus?:string}}) => query.where.billingStatus === "settled" ? io.settled(query) : io.usage(query), count: io.pending }, addOnPurchase: { findMany: io.purchases } } }));
import Page from "../page";
import { readBillingPlan, readBillingPlanWithAvailability } from "@/lib/billing/tenantBillingStore";

function value(label: string): string { return screen.getByText(label, { selector: "dt" }).parentElement!.querySelector("dd")!.textContent!.trim(); }
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AXIOM_SELF_SERVICE_BILLING_ENABLED", "false");
  io.plan.mockResolvedValue({ organizationId: "org_evidence", tier: "growth", status: "active", seatQuantity: 3, stripeCustomerId: "cus_fixture", cancelAtPeriodEnd: false, trialEndsAt: null, currentPeriodEndsAt: null });
  io.members.mockResolvedValue(3);
  io.usage.mockResolvedValue({ _count: { _all: 2 }, _sum: { inputTokens: 100, outputTokens: 20, billedCents: 30 } });
  io.settled.mockResolvedValue({ _sum: { billedCents: 30 } });
  io.pending.mockResolvedValue(1);
  io.purchases.mockImplementation(async (query) => query.select?.id ? [] : [{ sku: "credits", status: "paid", appliedAt: new Date("2026-10-01T00:00:00Z"), validFor: "current_month", deliveredAICreditsCents: 500, reversedAICreditsCents: 0, deliveredSeats: 0, deliveredConnectors: 0 }]);
  io.holds.mockResolvedValue({ _sum: { reservedCents: 0 } });
  io.quota.mockResolvedValue({ allowed: true, planId: "pro", used: 2, limit: 10, remaining: 8 });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe("canonical customer billing evidence", () => {
  it("renders actual available records and scopes every financial query to the current tenant", async () => {
    render(await Page({}));
    expect(value("Organization seats")).toBe("3 / 3");
    expect(value("Deployment records this month")).toBe("2");
    expect(value("Included AI allowance remaining")).toBe("$204.70");
    expect(value("Gateway calls")).toBe("2");
    expect(screen.getByText("$0.30 settled")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(io.members).toHaveBeenCalledWith({ where: { organizationId: "org_evidence", acceptedAt: { not: null } } });
    for (const query of [...io.usage.mock.calls, ...io.settled.mock.calls, ...io.pending.mock.calls, ...io.purchases.mock.calls]) expect(query[0].where.organizationId).toBe("org_evidence");
  });

  it.each(["members", "usage", "settled", "pending", "purchases"] as const)("withholds balances and empty-history claims when %s evidence is unavailable", async (boundary) => {
    io[boundary].mockRejectedValue(new Error("fixture database unavailable"));
    render(await Page({}));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(value("Organization seats")).toBe("Unavailable");
    expect(value("Included AI allowance remaining")).toBe(["usage", "purchases"].includes(boundary) ? "Unavailable" : "$204.70");
    expect(value("Gateway calls")).toBe("Unavailable");
    expect(value("Input tokens")).toBe("Unavailable");
    expect(value("Applied paid top-ups")).toBe(["usage", "purchases"].includes(boundary) ? "Unavailable" : "$5.00");
    expect(screen.getByText("Settled amount unavailable")).toBeTruthy();
    expect(screen.getByText("Credit transactions are unavailable.")).toBeTruthy();
    expect(screen.queryByText(/No credit transactions recorded/)).toBeNull();
    expect(screen.queryByText(/listed plan and paid top-ups/)).toBeNull();
    expect(screen.queryByText("$0.00 settled")).toBeNull();
    // The independently verified quota is preserved, not replaced with unknown/unlimited.
    expect(value("Deployment records this month")).toBe("2");
  });

  it("does not turn a failed quota read into unlimited deployments or hide other available evidence", async () => {
    io.quota.mockResolvedValue({ allowed: false, planId: null, used: null, limit: null, remaining: 0, reason: "deployment_quota_unavailable" });
    render(await Page({}));
    expect(value("Deployment records this month")).toBe("Unavailable");
    expect(screen.queryByText(/unlimited/)).toBeNull();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(value("Included AI allowance remaining")).toBe("$204.70");
    expect(value("Gateway calls")).toBe("2");
  });

  it("distinguishes a real absent plan from a plan-only storage failure", async () => {
    io.plan.mockResolvedValue(null);
    const absent = render(await Page({}));
    expect(screen.getByRole("heading", { name: "Free" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    absent.unmount();
    io.plan.mockRejectedValue(new Error("private database URL and credentials must not be rendered"));
    render(await Page({}));
    expect(screen.getByRole("heading", { name: "Plan unavailable" })).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(value("Included AI allowance remaining")).toBe("Unavailable");
    expect(value("Organization seats")).toBe("3 / unavailable");
    expect(value("Gateway calls")).toBe("2");
    expect(screen.getByText("$0.30 settled")).toBeTruthy();
    expect(screen.queryByText(/listed plan and paid top-ups/)).toBeNull();
    expect(screen.queryByText(/private database/)).toBeNull();
  });

  it("preserves the existing legacy plan-only fallback without disguising source availability", async () => {
    io.plan.mockRejectedValue(new Error("sensitive storage detail"));
    expect(await readBillingPlan("org_evidence")).toMatchObject({ organizationId: "org_evidence", tier: "trial", status: "no_plan", cancelAtPeriodEnd: false });
    expect(await readBillingPlanWithAvailability("org_evidence")).toMatchObject({ available: false, plan: { tier: "trial", status: "no_plan" } });
    io.plan.mockResolvedValue(null);
    expect(await readBillingPlanWithAvailability("org_evidence")).toMatchObject({ available: true, plan: { tier: "trial", status: "no_plan" } });
  });

  it("preserves verified true zero and empty transaction history", async () => {
    io.members.mockResolvedValue(0);
    io.usage.mockResolvedValue({ _count: { _all: 0 }, _sum: { inputTokens: null, outputTokens: null, billedCents: null } });
    io.settled.mockResolvedValue({ _sum: { billedCents: null } });
    io.pending.mockResolvedValue(0);
    io.purchases.mockResolvedValue([]);
    render(await Page({}));
    expect(value("Gateway calls")).toBe("0");
    expect(value("Input tokens")).toBe("0");
    expect(value("Applied paid top-ups")).toBe("$0.00");
    expect(screen.getByText("$0.00 settled")).toBeTruthy();
    expect(screen.getByText("No credit transactions recorded.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the count without an allowance denominator", async () => {
    io.quota.mockResolvedValue({ allowed: true, planId: "enterprise", used: 3, limit: null, remaining: null });
    render(await Page({}));
    expect(value("Deployment records this month")).toBe("3");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});


describe("current enforced AI allowance in the real server page", () => {
  it("shows legacy Growth's flat $200 pool rather than three public $10 seats", async () => {
    io.purchases.mockResolvedValue([]);
    io.holds.mockResolvedValue({ _sum: { reservedCents: 1250 } });
    render(await Page({}));
    expect(value("Included AI allowance remaining")).toBe("$187.20");
    expect(screen.getByText(/\$200.00 current account allowance/)).toBeTruthy();
    expect(screen.getByText(/\$12.50 held for unresolved requests/)).toBeTruthy();
    expect(screen.getByText(/not spend authorization/)).toBeTruthy();
    expect(screen.queryByText(/\$30.00 listed plan/)).toBeNull();
  });
  it("shows the existing no-plan $25 reservation baseline without granting a paid plan", async () => {
    io.plan.mockResolvedValue(null); io.purchases.mockResolvedValue([]);
    render(await Page({}));
    expect(value("Included AI allowance remaining")).toBe("$24.70");
    expect(screen.getByRole("heading", { name: "Free" })).toBeTruthy();
    expect(screen.getByText(/Current reservation policy: hard stop/)).toBeTruthy();
  });
  it("uses net current and permanent paid credits without counting refunded credits", async () => {
    io.purchases.mockImplementation(async q => q.select?.id ? [] : [
      { sku: "current", status: "partially_refunded", appliedAt: new Date("2026-10-01T00:00:00Z"), validFor: "current_month", deliveredAICreditsCents: 1000, reversedAICreditsCents: 400, deliveredSeats: 0, deliveredConnectors: 0 },
      { sku: "permanent", status: "paid", appliedAt: new Date("2026-10-01T00:00:00Z"), validFor: "permanent", deliveredAICreditsCents: 200, reversedAICreditsCents: 0, deliveredSeats: 0, deliveredConnectors: 0 },
    ]);
    render(await Page({}));
    expect(value("Applied paid top-ups")).toBe("$8.00");
    expect(value("Included AI allowance remaining")).toBe("$207.70");
  });
  it("never turns a missing hold ledger into an available balance", async () => {
    io.holds.mockRejectedValue(new Error("private storage outage"));
    render(await Page({}));
    expect(value("Included AI allowance remaining")).toBe("Unavailable");
    expect(value("Gateway calls")).toBe("2");
    expect(screen.getByRole("alert")).toBeTruthy();
  });
  it("shows a prepaid hard stop when the included allowance is exhausted", async () => {
    io.holds.mockResolvedValue({ _sum: { reservedCents: 25000 } });
    render(await Page({}));
    expect(value("Included AI allowance remaining")).toBe("$0.00");
    expect(screen.getByText(/Current reservation policy: hard stop/)).toBeTruthy();
    expect(screen.getByText(/not spend authorization/)).toBeTruthy();
  });
});

describe("isolated billing page refuses unsupported or unverified claims", () => {
  it("does not query/display legacy deployment quota and hides compatibility plan when proof is unavailable", async () => {
    vi.stubEnv("AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME", "true");
    render(await Page({}));
    expect(io.quota).not.toHaveBeenCalled();
    expect(value("Deployment records this month")).toBe("Unavailable");
    expect(screen.getByRole("heading", { name: "Plan unavailable" })).toBeTruthy();
  });
});

it("treats a spoofed success return as context without changing verified plan or allowance", async () => {
  render(await Page({ searchParams: Promise.resolve({ billing: "success" }) }));
  expect(screen.getByRole("status").textContent).toContain("The URL does not confirm payment");
  expect(screen.getByRole("heading", { name: "Pro" })).toBeDefined();
  expect(value("Included AI allowance remaining")).toBe("$204.70");
  expect(value("Applied paid top-ups")).toBe("$5.00");
  expect(io.plan).toHaveBeenCalled();
});
it.each([undefined, "unknown", ["success"]])("ignores unrecognized billing return context %j", async billing => {
  render(await Page({ searchParams: Promise.resolve({ billing }) }));
  expect(screen.queryByText(/The URL does not confirm payment/)).toBeNull();
  expect(value("Included AI allowance remaining")).toBe("$204.70");
});

it("never labels a pending ledger amount as settled debit", async () => {
  io.usage.mockResolvedValue({ _count: { _all: 2 }, _sum: { inputTokens: 500, outputTokens: 150, billedCents: 1006 } });
  io.settled.mockResolvedValue({ _sum: { billedCents: 7 } });
  render(await Page({}));
  expect(screen.getByText("$0.07 settled")).toBeTruthy();
  expect(screen.queryByText("$10.06 settled")).toBeNull();
  expect(value("Gateway calls")).toBe("2");
  expect(value("Input tokens")).toBe("500");
  expect(io.settled).toHaveBeenCalledWith({ where: { organizationId: "org_evidence", eventKind: "ai_invocation", billingStatus: "settled", createdAt: { gte: expect.any(Date) } }, _sum: { billedCents: true } });
});

it("distinguishes requested checkout amounts, verified payment, refund and net AI credits", async () => {
  const createdAt = new Date();
  const rows = [
    { id: "pending-fixture", sku: "pending_topup", status: "pending", pricePaidCents: 1000, refundedAmountCents: 250, reversedAICreditsCents: 250, appliedAt: null },
    { id: "failed-fixture", sku: "failed_topup", status: "failed", pricePaidCents: 2000, refundedAmountCents: 0, reversedAICreditsCents: 0, appliedAt: null },
    { id: "expired-fixture", sku: "expired_topup", status: "expired", pricePaidCents: 3000, refundedAmountCents: 0, reversedAICreditsCents: 0, appliedAt: null },
    { id: "paid-fixture", sku: "paid_topup", status: "paid", pricePaidCents: 4000, refundedAmountCents: 0, reversedAICreditsCents: 0, appliedAt: createdAt },
    { id: "partial-fixture", sku: "partial_topup", status: "partially_refunded", pricePaidCents: 1000, refundedAmountCents: 250, reversedAICreditsCents: 500, appliedAt: createdAt },
    { id: "refunded-fixture", sku: "refunded_topup", status: "refunded", pricePaidCents: 1000, refundedAmountCents: 1000, reversedAICreditsCents: 2000, appliedAt: createdAt },
    { id: "unverified-fixture", sku: "unverified_topup", status: "partially_refunded", pricePaidCents: 5000, refundedAmountCents: 500, reversedAICreditsCents: 500, appliedAt: null },
  ].map(row => ({ deliveredAICreditsCents: 2000, createdAt, ...row }));
  io.purchases.mockImplementation(async query => query.select?.id ? rows : rows.filter(row => ["paid", "partially_refunded"].includes(row.status)).map(row => ({ ...row, validFor: "permanent", deliveredSeats: 0, deliveredConnectors: 0 })));
  render(await Page({}));
  const detail = (label: string) => screen.getByText(label).parentElement!.nextElementSibling!.textContent;
  expect(detail("pending topup")).toBe("Checkout amount $10.00 · Payment confirmation pending");
  expect(detail("failed topup")).toBe("Checkout amount $20.00 · No credits applied");
  expect(detail("expired topup")).toBe("Checkout amount $30.00 · No credits applied");
  expect(detail("paid topup")).toBe("Paid $40.00 · Credits $20.00");
  expect(detail("partial topup")).toBe("Paid $10.00 · Refunded $2.50 · Credits $15.00");
  expect(detail("refunded topup")).toBe("Paid $10.00 · Refunded $10.00 · Credits $0.00");
  expect(detail("unverified topup")).toBe("Payment confirmation unavailable");
  expect(value("Applied paid top-ups")).toBe("$35.00");
});
