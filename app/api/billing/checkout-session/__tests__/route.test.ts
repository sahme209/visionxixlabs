import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  currentContext: vi.fn(),
  isAdminOrOwner: vi.fn(),
  isSameOriginRequest: vi.fn(),
  countMemberships: vi.fn(),
  readBilling: vi.fn(),
  createCheckoutSession: vi.fn(),
}));

vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.currentContext }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: mocks.isAdminOrOwner }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: mocks.isSameOriginRequest }));
vi.mock("@/lib/db", () => ({ prisma: { orgMembership: { count: mocks.countMemberships }, tenantBillingPlan: { findUnique: mocks.readBilling } } }));
vi.mock("@/lib/billing/stripeHelper", () => ({ createCheckoutSession: mocks.createCheckoutSession }));

const originalBillingFlag = process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED;
const originalNextAuthUrl = process.env.NEXTAUTH_URL;

function request(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/billing/checkout-session", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://visionxixlabs.com" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/billing/checkout-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED = "true";
    process.env.NEXTAUTH_URL = "https://visionxixlabs.com";
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.isAdminOrOwner.mockReturnValue(true);
    mocks.currentContext.mockResolvedValue({
      isAuthenticated: true,
      organizationId: "org-1",
      email: "owner@example.com",
      roles: ["owner"],
    });
    mocks.countMemberships.mockResolvedValue(3);
    mocks.readBilling.mockResolvedValue(null);
    mocks.createCheckoutSession.mockResolvedValue({ ok: true, url: "https://checkout.stripe.test/session" });
  });

  afterEach(() => {
    if (originalBillingFlag === undefined) delete process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED;
    else process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED = originalBillingFlag;
    if (originalNextAuthUrl === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = originalNextAuthUrl;
  });

  it("stays unavailable until billing is explicitly enabled", async () => {
    delete process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED;
    const { POST } = await import("../route");
    const response = await POST(request({ planId: "pro" }));
    expect(response.status).toBe(412);
    expect(mocks.currentContext).not.toHaveBeenCalled();
  });

  it("rejects cross-origin cookie-authenticated requests", async () => {
    mocks.isSameOriginRequest.mockReturnValue(false);
    const { POST } = await import("../route");
    const response = await POST(request({ planId: "pro" }));
    expect(response.status).toBe(403);
    expect(mocks.currentContext).not.toHaveBeenCalled();
  });

  it("requires a signed-in workspace identity", async () => {
    mocks.currentContext.mockResolvedValue({ isAuthenticated: false, roles: [] });
    const { POST } = await import("../route");
    const response = await POST(request({ planId: "pro" }));
    expect(response.status).toBe(401);
  });

  it("requires owner or admin authority", async () => {
    mocks.isAdminOrOwner.mockReturnValue(false);
    const { POST } = await import("../route");
    const response = await POST(request({ planId: "pro" }));
    expect(response.status).toBe(403);
    expect(mocks.countMemberships).not.toHaveBeenCalled();
  });

  it("rejects legacy or free plan identifiers", async () => {
    const { POST } = await import("../route");
    for (const planId of ["growth", "starter", "free"]) {
      const response = await POST(request({ planId }));
      expect(response.status).toBe(400);
    }
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 42, "", "org-other"])("rejects unavailable or stale workspace binding %s before financial work", async (expectedOrganizationId) => {
    const { POST } = await import("../route");
    const response = await POST(request({ planId: "pro", expectedOrganizationId }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "billing.workspace_changed" } });
    expect(mocks.countMemberships).not.toHaveBeenCalled();
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects a workspace switch after the page's purchase intent was rendered", async () => {
    mocks.currentContext.mockResolvedValue({ isAuthenticated: true, organizationId: "org-new", email: "owner@example.com", roles: ["owner"] });
    const { POST } = await import("../route");
    const response = await POST(request({ planId: "pro", expectedOrganizationId: "org-1" }));
    expect(response.status).toBe(403);
    expect(mocks.countMemberships).not.toHaveBeenCalled();
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses a customer-only binding before another customer can be charged", async () => {
    mocks.readBilling.mockResolvedValue({ stripeCustomerId: "cus_existing", stripeSubscriptionId: null });
    const { POST } = await import("../route");
    const response = await POST(request({ planId: "pro", expectedOrganizationId: "org-1" }));
    expect(response.status).toBe(412);
    expect(await response.json()).toMatchObject({ error: { code: "billing.subscription_change_required" } });
    expect(mocks.countMemberships).not.toHaveBeenCalled();
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it.each(["active", "past_due", "canceled"])("does not create a replacement subscription for known %s billing history", async (status) => {
    mocks.readBilling.mockResolvedValue({ stripeSubscriptionId: "sub_existing", status });
    const { POST } = await import("../route");
    const response = await POST(request({ planId: "pro", expectedOrganizationId: "org-1" }));
    expect(response.status).toBe(412);
    expect(await response.json()).toMatchObject({ error: { code: "billing.subscription_change_required" } });
    expect(mocks.readBilling).toHaveBeenCalledWith({ where: { organizationId: "org-1" }, select: { stripeCustomerId: true, stripeSubscriptionId: true } });
    expect(mocks.countMemberships).not.toHaveBeenCalled();
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("does not purchase when current subscription history is unavailable", async () => {
    mocks.readBilling.mockRejectedValue(new Error("synthetic unavailable billing history"));
    const { POST } = await import("../route");
    const response = await POST(request({ planId: "pro", expectedOrganizationId: "org-1" }));
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mocks.countMemberships).not.toHaveBeenCalled();
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("uses the server-counted accepted seat quantity", async () => {
    const { POST } = await import("../route");
    const response = await POST(request({ planId: "enterprise", billingInterval: "annual", expectedOrganizationId: "org-1", seatCount: 999 }));
    expect(response.status).toBe(200);
    expect(mocks.countMemberships).toHaveBeenCalledWith({
      where: { organizationId: "org-1", acceptedAt: { not: null } },
    });
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith({
      organizationId: "org-1",
      email: "owner@example.com",
      planId: "enterprise",
      billingInterval: "annual",
      seatCount: 3,
      successUrl: "https://visionxixlabs.com/control/usage-billing?billing=success",
      cancelUrl: "https://visionxixlabs.com/plans?checkout=canceled",
    });
  });
});
