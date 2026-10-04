/**
 * P0 regression: a desktop session that is structurally valid (correct
 * signature, not expired, not revoked) must never be reported as
 * "invalid or has expired" just because the workspace has no accepted
 * OrgMembership row yet or no commercial entitlement. Those are reported
 * as data in `access`/`identity`, not as an auth failure — pairing
 * identity and operational entitlement are separate gates.
 *
 * This was the exact failure a real user hit after a successful browser
 * approval: PairDesktopClient said "Agent is authorized," but the
 * desktop's first /api/desktop/access call came back 401 with "Your
 * saved desktop sign-in is invalid or has expired," because
 * resolveRequestDesktopSession's default hard membership requirement was
 * never relaxed for this specific read-only status endpoint, even though
 * requireActiveAccess was already (correctly) relaxed here.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  bearerFromHeader: vi.fn((h: string | null) => h),
  verifyDesktopToken: vi.fn(),
  resolveActiveSession: vi.fn(),
  touchDesktopSession: vi.fn(async () => {}),
  findMembership: vi.fn(),
  readDesktopCommercialAccess: vi.fn(),
  findUser: vi.fn(),
  authenticateApiKey: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    orgMembership: { findUnique: mocks.findMembership },
    user: { findUnique: mocks.findUser },
  },
}));
vi.mock("@/lib/security/authenticateApiKey", () => ({ authenticateApiKey: mocks.authenticateApiKey }));
vi.mock("@/lib/desktop/desktopToken", () => ({
  bearerFromHeader: mocks.bearerFromHeader,
  verifyDesktopToken: mocks.verifyDesktopToken,
}));
vi.mock("@/lib/desktop/desktopSession", () => ({
  resolveActiveSession: mocks.resolveActiveSession,
  touchDesktopSession: mocks.touchDesktopSession,
}));
vi.mock("@/lib/desktop/desktopCommercialAccess", () => ({
  readDesktopCommercialAccess: mocks.readDesktopCommercialAccess,
}));

function request(bearer: string) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/access", {
    headers: { authorization: `Bearer ${bearer}` },
  });
}

const validSession = {
  id: "sess-1",
  userId: "user-1",
  organizationId: "org-1",
  deviceLabel: "Sam's Mac",
  platform: "macos-arm",
};

describe("GET /api/desktop/access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyDesktopToken.mockReturnValue({ sessionId: "sess-1", signature: "sig" });
    mocks.resolveActiveSession.mockResolvedValue({ ...validSession });
    mocks.findUser.mockResolvedValue({ email: "pilot@example.test", name: "Pilot User" });
  });

  it("reports a restricted (unentitled) state for a valid session with no workspace membership yet, instead of failing auth", async () => {
    // The exact bug: membership bootstrap is best-effort (lib/auth.ts) and
    // can lag behind or fail independently of a successful sign-in/pairing.
    mocks.findMembership.mockResolvedValue(null);
    mocks.readDesktopCommercialAccess.mockResolvedValue({ allowed: false, code: "production_access_required" });

    const { GET } = await import("../route");
    const res = await GET(request("axm.desk.sess-1.sig"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.access.allowed).toBe(false);
    expect(body.data.identity.organizationId).toBe("org-1");
  });

  it("reports a restricted (unentitled) state for a valid, member-bound session with no commercial entitlement", async () => {
    mocks.findMembership.mockResolvedValue({ acceptedAt: new Date(), role: "owner" });
    mocks.readDesktopCommercialAccess.mockResolvedValue({ allowed: false, code: "production_access_required" });

    const { GET } = await import("../route");
    const res = await GET(request("axm.desk.sess-1.sig"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.access.allowed).toBe(false);
  });

  it("reports the operational workspace state for an entitled, paired user", async () => {
    mocks.findMembership.mockResolvedValue({ acceptedAt: new Date(), role: "owner" });
    mocks.readDesktopCommercialAccess.mockResolvedValue({ allowed: true, code: "active" });

    const { GET } = await import("../route");
    const res = await GET(request("axm.desk.sess-1.sig"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.access.allowed).toBe(true);
  });

  it("still rejects a genuinely invalid/expired/revoked session as 401 (membership relaxation does not weaken token/session validity)", async () => {
    mocks.resolveActiveSession.mockResolvedValue(undefined); // expired/revoked/unknown
    const { GET } = await import("../route");
    const res = await GET(request("axm.desk.sess-1.sig"));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.userMessage).toMatch(/invalid or has expired/i);
    // Membership/entitlement must never even be consulted for a dead session.
    expect(mocks.findMembership).not.toHaveBeenCalled();
    expect(mocks.readDesktopCommercialAccess).not.toHaveBeenCalled();
  });

  it("still rejects a token with a bad/forged signature as 401", async () => {
    mocks.verifyDesktopToken.mockImplementation(() => {
      throw new Error("Desktop token signature does not match.");
    });
    const { GET } = await import("../route");
    const res = await GET(request("axm.desk.someone-elses-session.badsig"));
    expect(res.status).toBe(401);
    expect(mocks.resolveActiveSession).not.toHaveBeenCalled();
  });
});
