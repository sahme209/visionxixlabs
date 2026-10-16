import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  membership: vi.fn(), verifyToken: vi.fn(), session: vi.fn(), touch: vi.fn(),
  access: vi.fn(), apiKey: vi.fn(), readPlan: vi.fn(), portal: vi.fn(), bootstrap: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { orgMembership: { findUnique: mocks.membership }, user: { findUnique: vi.fn(async () => null) } } }));
vi.mock("@/lib/desktop/desktopToken", () => ({ bearerFromHeader: (header: string | null) => header?.replace(/^Bearer /, "") ?? null, verifyDesktopToken: mocks.verifyToken }));
vi.mock("@/lib/desktop/desktopSession", () => ({ resolveActiveSession: mocks.session, touchDesktopSession: mocks.touch }));
vi.mock("@/lib/desktop/desktopCommercialAccess", () => ({ readDesktopCommercialAccess: mocks.access }));
vi.mock("@/lib/security/authenticateApiKey", () => ({ authenticateApiKey: mocks.apiKey }));
vi.mock("@/lib/auth/ensurePersonalWorkspaceMembership", () => ({ ensurePersonalWorkspaceMembership: mocks.bootstrap }));
vi.mock("@/lib/billing/tenantBillingStore", () => ({ readBillingPlan: mocks.readPlan }));
vi.mock("@/lib/billing/stripeHelper", () => ({ createBillingPortalSession: mocks.portal }));
import { POST } from "../route";

const request = (token = "paired-token") => new NextRequest("https://visionxixlabs.com/api/desktop/billing/portal", { method: "POST", headers: { authorization: `Bearer ${token}` } });

describe("desktop billing portal current management authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyToken.mockReturnValue({ sessionId: "session-1" });
    mocks.session.mockResolvedValue({ id: "session-1", userId: "user-1", organizationId: "org-1" });
    mocks.membership.mockResolvedValue({ acceptedAt: new Date(), role: "owner" });
    mocks.readPlan.mockResolvedValue({ stripeCustomerId: "cus_test_workspace" });
    mocks.portal.mockResolvedValue({ ok: true, url: "https://billing.stripe.com/p/session/test" });
  });

  it.each(["read_only", "operator", "finance_viewer", "security_reviewer"])("denies accepted %s before plan or provider reads", async (role) => {
    mocks.membership.mockResolvedValue({ acceptedAt: new Date(), role });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.readPlan).not.toHaveBeenCalled();
    expect(mocks.portal).not.toHaveBeenCalled();
  });

  it.each(["owner", "admin"])("allows current %s even when commercial access is inactive", async (role) => {
    mocks.membership.mockResolvedValue({ acceptedAt: new Date(), role });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.portal).toHaveBeenCalledWith({ customerId: "cus_test_workspace", returnUrl: "https://visionxixlabs.com/desktop/billing/return" });
    expect(mocks.access).not.toHaveBeenCalled();
  });

  it("rechecks role on each request so an unchanged paired token loses management after downgrade", async () => {
    expect((await POST(request())).status).toBe(200);
    mocks.readPlan.mockClear(); mocks.portal.mockClear();
    mocks.membership.mockResolvedValue({ acceptedAt: new Date(), role: "read_only" });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.membership).toHaveBeenCalledTimes(2);
    expect(mocks.readPlan).not.toHaveBeenCalled(); expect(mocks.portal).not.toHaveBeenCalled();
  });

  it("rejects API keys before authentication or billing IO", async () => {
    expect((await POST(request("vxlk_test"))).status).toBe(401);
    expect(mocks.apiKey).not.toHaveBeenCalled(); expect(mocks.readPlan).not.toHaveBeenCalled(); expect(mocks.portal).not.toHaveBeenCalled();
  });

  it("fails closed on a current membership read outage", async () => {
    mocks.membership.mockRejectedValue(new Error("private membership outage"));
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("private membership outage");
    expect(mocks.readPlan).not.toHaveBeenCalled(); expect(mocks.portal).not.toHaveBeenCalled();
  });
});
