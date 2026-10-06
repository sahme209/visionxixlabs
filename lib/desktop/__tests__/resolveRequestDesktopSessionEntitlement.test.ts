/**
 * Locks in: operational desktop routes require active commercial
 * entitlement by default (requireActiveAccess defaults to true), while
 * routes that explicitly opt out (e.g. /api/desktop/access,
 * /api/desktop/billing/portal) can resolve a session without one. This is
 * the half of the sign-in/pairing/entitlement split that keeps pairing
 * itself entitlement-agnostic while operational calls stay gated.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  verifyDesktopToken: vi.fn(),
  resolveActiveSession: vi.fn(),
  touchDesktopSession: vi.fn(async () => {}),
  bearerFromHeader: vi.fn((h: string | null) => h),
  readDesktopCommercialAccess: vi.fn(),
  findMembership: vi.fn(),
  authenticateApiKey: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { orgMembership: { findUnique: mocks.findMembership } } }));
vi.mock("@/lib/security/authenticateApiKey", () => ({ authenticateApiKey: mocks.authenticateApiKey }));
vi.mock("../desktopToken", () => ({
  bearerFromHeader: mocks.bearerFromHeader,
  verifyDesktopToken: mocks.verifyDesktopToken,
}));
vi.mock("../desktopSession", () => ({
  resolveActiveSession: mocks.resolveActiveSession,
  touchDesktopSession: mocks.touchDesktopSession,
}));
vi.mock("../desktopCommercialAccess", () => ({
  readDesktopCommercialAccess: mocks.readDesktopCommercialAccess,
}));

function request(bearer: string | null) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/deployments", {
    headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
  });
}

describe("resolveRequestDesktopSession entitlement default", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bearerFromHeader.mockImplementation((h: string | null) => h);
    mocks.verifyDesktopToken.mockReturnValue({ sessionId: "sess-1", signature: "sig" });
    mocks.resolveActiveSession.mockResolvedValue({
      id: "sess-1",
      userId: "user-1",
      organizationId: "org-1",
      deviceLabel: "Mac",
      platform: "macos-arm",
    });
    mocks.findMembership.mockResolvedValue({ acceptedAt: new Date(), role: "owner" });
  });

  it("rejects a non-entitled session on an operational route by default", async () => {
    mocks.readDesktopCommercialAccess.mockResolvedValue({ allowed: false, code: "production_access_required" });
    const { resolveRequestDesktopSession } = await import("../resolveRequestDesktopSession");
    const principal = await resolveRequestDesktopSession(request("token-1"), {
      requiredScope: "release_gate:read",
      route: "/api/desktop/deployments",
    });
    expect(principal).toBeUndefined();
  });

  it("accepts an entitled session on an operational route", async () => {
    mocks.readDesktopCommercialAccess.mockResolvedValue({ allowed: true, code: "active" });
    const { resolveRequestDesktopSession } = await import("../resolveRequestDesktopSession");
    const principal = await resolveRequestDesktopSession(request("token-1"), {
      requiredScope: "release_gate:read",
      route: "/api/desktop/deployments",
    });
    expect(principal).toMatchObject({ organizationId: "org-1", credentialKind: "desktop_session" });
  });

  it("does not require entitlement when a route explicitly opts out (requireActiveAccess: false)", async () => {
    mocks.readDesktopCommercialAccess.mockResolvedValue({ allowed: false, code: "production_access_required" });
    const { resolveRequestDesktopSession } = await import("../resolveRequestDesktopSession");
    const principal = await resolveRequestDesktopSession(request("token-1"), {
      requiredScope: "release_gate:read",
      route: "/api/desktop/access",
      requireActiveAccess: false,
    });
    expect(principal).toMatchObject({ organizationId: "org-1" });
    expect(mocks.readDesktopCommercialAccess).not.toHaveBeenCalled();
  });
});
