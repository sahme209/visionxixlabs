import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  currentContext: vi.fn(),
  isAdminOrOwner: vi.fn(),
  isSameOriginRequest: vi.fn(),
  readBillingPlan: vi.fn(),
  createBillingPortalSession: vi.fn(),
}));

vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.currentContext }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: mocks.isAdminOrOwner }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: mocks.isSameOriginRequest }));
vi.mock("@/lib/billing/tenantBillingStore", () => ({ readBillingPlan: mocks.readBillingPlan }));
vi.mock("@/lib/billing/stripeHelper", () => ({ createBillingPortalSession: mocks.createBillingPortalSession }));

const originalBillingFlag = process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED;
const originalNextAuthUrl = process.env.NEXTAUTH_URL;

function request() {
  return new NextRequest("https://visionxixlabs.com/api/billing/portal-session", {
    method: "POST",
    headers: { origin: "https://visionxixlabs.com" },
  });
}

describe("POST /api/billing/portal-session", () => {
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
    mocks.readBillingPlan.mockResolvedValue({ stripeCustomerId: "cus_1" });
    mocks.createBillingPortalSession.mockResolvedValue({ ok: true, url: "https://billing.stripe.test/session" });
  });

  afterEach(() => {
    if (originalBillingFlag === undefined) delete process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED;
    else process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED = originalBillingFlag;
    if (originalNextAuthUrl === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = originalNextAuthUrl;
  });

  it("stays unavailable until self-service billing is explicitly enabled", async () => {
    delete process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED;
    const { POST } = await import("../route");
    const response = await POST(request());
    expect(response.status).toBe(412);
    expect(mocks.currentContext).not.toHaveBeenCalled();
  });

  it("requires same-origin owner or admin authority", async () => {
    const { POST } = await import("../route");
    mocks.isSameOriginRequest.mockReturnValue(false);
    expect((await POST(request())).status).toBe(403);

    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.isAdminOrOwner.mockReturnValue(false);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.readBillingPlan).not.toHaveBeenCalled();
  });

  it("opens only the workspace customer and returns to the account companion", async () => {
    const { POST } = await import("../route");
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.readBillingPlan).toHaveBeenCalledWith("org-1");
    expect(mocks.createBillingPortalSession).toHaveBeenCalledWith({
      customerId: "cus_1",
      returnUrl: "https://visionxixlabs.com/account?billing=return",
    });
  });
});
