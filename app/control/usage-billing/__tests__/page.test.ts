/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const io = vi.hoisted(() => ({ members: vi.fn(), usage: vi.fn(), pending: vi.fn(), purchases: vi.fn(), quota: vi.fn(), plan: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: async () => ({ isAuthenticated: true, organizationId: "org_evidence", email: "owner@example.test", roles: ["owner"] }) }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: () => true }));
vi.mock("@/lib/billing/stripeHelper", () => ({ describeStripeStatus: () => ({ mode: "test" }) }));
vi.mock("@/lib/billing/deploymentQuota", () => ({ checkDeploymentQuota: io.quota }));
vi.mock("@/lib/db", () => ({ prisma: { tenantBillingPlan: { findUnique: io.plan }, orgMembership: { count: io.members }, usageEvent: { aggregate: io.usage, count: io.pending }, addOnPurchase: { findMany: io.purchases } } }));
import Page from "../page";
import { readBillingPlan, readBillingPlanWithAvailability } from "@/lib/billing/tenantBillingStore";

function value(label: string): string { return screen.getByText(label, { selector: "dt" }).parentElement!.querySelector("dd")!.textContent!.trim(); }
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AXIOM_SELF_SERVICE_BILLING_ENABLED", "false");
  io.plan.mockResolvedValue({ organizationId: "org_evidence", tier: "growth", status: "active", seatQuantity: 3, stripeCustomerId: "cus_fixture", cancelAtPeriodEnd: false, trialEndsAt: null, currentPeriodEndsAt: null });
  io.members.mockResolvedValue(3);
  io.usage.mockResolvedValue({ _count: { _all: 2 }, _sum: { inputTokens: 100, outputTokens: 20, billedCents: 30 } });
  io.pending.mockResolvedValue(1);
  io.purchases.mockImplementation(async (query) => query.select.id ? [] : [{ deliveredAICreditsCents: 500, reversedAICreditsCents: 0 }]);
  io.quota.mockResolvedValue({ allowed: true, planId: "pro", used: 2, limit: 100, remaining: 98 });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe("canonical customer billing evidence", () => {
  it("renders actual available records and scopes every financial query to the current tenant", async () => {
    render(await Page());
    expect(value("Organization seats")).toBe("3 / 3");
    expect(value("Counted deployments")).toBe("2 / 100");
    expect(value("AI credit available")).toBe("$34.70");
    expect(value("Gateway calls")).toBe("2");
    expect(screen.getByText("$0.30 settled")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(io.members).toHaveBeenCalledWith({ where: { organizationId: "org_evidence", acceptedAt: { not: null } } });
    for (const query of [...io.usage.mock.calls, ...io.pending.mock.calls, ...io.purchases.mock.calls]) expect(query[0].where.organizationId).toBe("org_evidence");
  });

  it.each(["members", "usage", "pending", "purchases"] as const)("withholds balances and empty-history claims when %s evidence is unavailable", async (boundary) => {
    io[boundary].mockRejectedValue(new Error("fixture database unavailable"));
    render(await Page());
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(value("Organization seats")).toBe("Unavailable");
    expect(value("AI credit available")).toBe("Unavailable");
    expect(value("Gateway calls")).toBe("Unavailable");
    expect(value("Input tokens")).toBe("Unavailable");
    expect(value("Paid top-ups")).toBe("Unavailable");
    expect(screen.getByText("Settled amount unavailable")).toBeTruthy();
    expect(screen.getByText("Credit transactions are unavailable.")).toBeTruthy();
    expect(screen.queryByText(/No credit transactions recorded/)).toBeNull();
    expect(screen.queryByText(/listed plan and paid top-ups/)).toBeNull();
    expect(screen.queryByText("$0.00 settled")).toBeNull();
    // The independently verified quota is preserved, not replaced with unknown/unlimited.
    expect(value("Counted deployments")).toBe("2 / 100");
  });

  it("does not turn a failed quota read into unlimited deployments or hide other available evidence", async () => {
    io.quota.mockResolvedValue({ allowed: false, planId: null, used: null, limit: null, remaining: 0, reason: "deployment_quota_unavailable" });
    render(await Page());
    expect(value("Counted deployments")).toBe("Unavailable");
    expect(screen.queryByText(/unlimited/)).toBeNull();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(value("AI credit available")).toBe("$34.70");
    expect(value("Gateway calls")).toBe("2");
  });

  it("distinguishes a real absent plan from a plan-only storage failure", async () => {
    io.plan.mockResolvedValue(null);
    const absent = render(await Page());
    expect(screen.getByRole("heading", { name: "Free" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    absent.unmount();
    io.plan.mockRejectedValue(new Error("private database URL and credentials must not be rendered"));
    render(await Page());
    expect(screen.getByRole("heading", { name: "Plan unavailable" })).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(value("AI credit available")).toBe("Unavailable");
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
    io.pending.mockResolvedValue(0);
    io.purchases.mockResolvedValue([]);
    render(await Page());
    expect(value("Gateway calls")).toBe("0");
    expect(value("Input tokens")).toBe("0");
    expect(value("Paid top-ups")).toBe("$0.00");
    expect(screen.getByText("$0.00 settled")).toBeTruthy();
    expect(screen.getByText("No credit transactions recorded.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("preserves a known exhausted quota rather than treating denial as missing evidence", async () => {
    io.quota.mockResolvedValue({ allowed: false, planId: "pro", used: 100, limit: 100, remaining: 0, reason: "deployment_quota_exhausted" });
    render(await Page());
    expect(value("Counted deployments")).toBe("100 / 100");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders unlimited only when explicitly established by a successful quota result", async () => {
    io.quota.mockResolvedValue({ allowed: true, planId: "enterprise", used: 3, limit: null, remaining: null });
    render(await Page());
    expect(value("Counted deployments")).toBe("3 / unlimited");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
