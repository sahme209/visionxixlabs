/**
 * resolveRequestDesktopSession previously swallowed every exception (and
 * every soft denial) with zero logging — the outer `catch { return
 * undefined }` had no trace at all. That is a real observability gap: a
 * misconfigured DESKTOP_SESSION_SIGNING_KEY / NEXTAUTH_SECRET (the
 * signing key resolveDesktopToken needs) would throw on every single
 * desktop pairing attempt in production, and none of it would ever show
 * up in logs. This locks in that every denial path now logs a reason,
 * and the catch block logs the real error instead of discarding it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  bearerFromHeader: vi.fn((h: string | null) => (h?.startsWith("Bearer ") ? h.slice(7) : h)),
  verifyDesktopToken: vi.fn(),
  resolveActiveSession: vi.fn(),
  touchDesktopSession: vi.fn(async () => {}),
  findMembership: vi.fn(),
  findUser: vi.fn(),
  ensurePersonalWorkspaceMembership: vi.fn(async () => {}),
  readDesktopCommercialAccess: vi.fn(),
  authenticateApiKey: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { orgMembership: { findUnique: mocks.findMembership }, user: { findUnique: mocks.findUser } },
}));
vi.mock("@/lib/auth/ensurePersonalWorkspaceMembership", () => ({
  ensurePersonalWorkspaceMembership: mocks.ensurePersonalWorkspaceMembership,
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
vi.mock("@/lib/observability/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: mocks.logInfo,
    warn: vi.fn(),
    error: mocks.logError,
    critical: vi.fn(),
    with: vi.fn(),
  }),
}));

import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";

function makeRequest(bearer: string | null): NextRequest {
  const headers = new Headers();
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return new NextRequest("https://example.test/api/desktop/access", { headers });
}

describe("resolveRequestDesktopSession — failure observability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bearerFromHeader.mockImplementation((h: string | null) => (h?.startsWith("Bearer ") ? h.slice(7) : h));
  });

  it("logs the real error instead of silently discarding it when token verification throws", async () => {
    mocks.verifyDesktopToken.mockImplementation(() => {
      throw new Error("desktop.token.no_key: Desktop session signing requires DESKTOP_SESSION_SIGNING_KEY");
    });

    const principal = await resolveRequestDesktopSession(makeRequest("some-token"), {
      requiredScope: "release_gate:read",
      route: "/api/desktop/access",
    });

    expect(principal).toBeUndefined();
    expect(mocks.logError).toHaveBeenCalledTimes(1);
    const [message, metadata] = mocks.logError.mock.calls[0];
    expect(message).toContain("unexpected exception");
    expect(metadata?.errorMessage).toContain("DESKTOP_SESSION_SIGNING_KEY");
    expect(metadata?.route).toBe("/api/desktop/access");
  });

  it("logs a reason when no active session is found for an otherwise well-formed token", async () => {
    mocks.verifyDesktopToken.mockReturnValue({ sessionId: "sess_1" });
    mocks.resolveActiveSession.mockResolvedValue(null);

    const principal = await resolveRequestDesktopSession(makeRequest("axm.desk.sess_1.sig"), {
      requiredScope: "release_gate:read",
      route: "/api/desktop/access",
    });

    expect(principal).toBeUndefined();
    expect(mocks.logInfo).toHaveBeenCalledWith(
      expect.stringContaining("no active session"),
      expect.objectContaining({ route: "/api/desktop/access" }),
    );
  });

  it("logs a reason when workspace membership is missing", async () => {
    mocks.verifyDesktopToken.mockReturnValue({ sessionId: "sess_1" });
    mocks.resolveActiveSession.mockResolvedValue({
      id: "sess_1",
      userId: "user_1",
      organizationId: "org_1",
    });
    mocks.findMembership.mockResolvedValue(null);

    const principal = await resolveRequestDesktopSession(makeRequest("axm.desk.sess_1.sig"), {
      requiredScope: "release_gate:read",
      route: "/api/desktop/access",
      requireWorkspaceMembership: true,
    });

    expect(principal).toBeUndefined();
    expect(mocks.logInfo).toHaveBeenCalledWith(
      expect.stringContaining("membership"),
      expect.objectContaining({ route: "/api/desktop/access", organizationId: "org_1", userId: "user_1" }),
    );
  });

  it("self-heals a missing membership row for the user's own personal workspace, instead of denying forever", async () => {
    mocks.verifyDesktopToken.mockReturnValue({ sessionId: "sess_1" });
    mocks.findUser.mockResolvedValue({ email: "person@example.test" });
    // Self-heal only fires when the session's org actually is this user's
    // own derived personal workspace id, so compute the real one.
    const { deriveWorkspaceIdFromEmail } = await import("@/lib/auth/workspaceId");
    mocks.resolveActiveSession.mockResolvedValue({
      id: "sess_1",
      userId: "user_1",
      organizationId: String(deriveWorkspaceIdFromEmail("person@example.test")),
    });
    mocks.findMembership
      .mockResolvedValueOnce(null) // first check: missing
      .mockResolvedValueOnce({ acceptedAt: new Date(), role: "owner" }); // recheck after heal: present

    const principal = await resolveRequestDesktopSession(makeRequest("axm.desk.sess_1.sig"), {
      requiredScope: "release_gate:read",
      route: "/api/desktop/deployments",
      requireWorkspaceMembership: true,
      requireActiveAccess: false,
    });

    expect(mocks.ensurePersonalWorkspaceMembership).toHaveBeenCalledWith({ userId: "user_1", email: "person@example.test" });
    expect(principal).toMatchObject({ userId: "user_1", credentialKind: "desktop_session" });
    expect(mocks.logInfo).toHaveBeenCalledWith(expect.stringContaining("self-healed"), expect.anything());
  });

  it("does not self-heal into a different (shared/invited) organization than the user's own derived workspace", async () => {
    mocks.verifyDesktopToken.mockReturnValue({ sessionId: "sess_1" });
    mocks.resolveActiveSession.mockResolvedValue({ id: "sess_1", userId: "user_1", organizationId: "someone_elses_shared_org" });
    mocks.findUser.mockResolvedValue({ email: "person@example.test" });
    mocks.findMembership.mockResolvedValue(null);

    const principal = await resolveRequestDesktopSession(makeRequest("axm.desk.sess_1.sig"), {
      requiredScope: "release_gate:read",
      route: "/api/desktop/deployments",
      requireWorkspaceMembership: true,
    });

    expect(mocks.ensurePersonalWorkspaceMembership).not.toHaveBeenCalled();
    expect(principal).toBeUndefined();
  });

  it("logs a reason when an API key hits a route that disallows API keys", async () => {
    const principal = await resolveRequestDesktopSession(makeRequest("vxlk_abc123"), {
      requiredScope: "release_gate:read",
      route: "/api/desktop/access",
      allowApiKey: false,
    });

    expect(principal).toBeUndefined();
    expect(mocks.logInfo).toHaveBeenCalledWith(
      expect.stringContaining("not allowed"),
      expect.objectContaining({ route: "/api/desktop/access" }),
    );
  });

  it("logs a reason when an API key hits an admin-only route", async () => {
    const principal = await resolveRequestDesktopSession(makeRequest("vxlk_abc123"), {
      requiredScope: "release_gate:read",
      route: "/api/desktop/access",
      requireWorkspaceAdmin: true,
    });

    expect(principal).toBeUndefined();
    expect(mocks.logInfo).toHaveBeenCalledWith(
      expect.stringContaining("admin-only"),
      expect.objectContaining({ route: "/api/desktop/access" }),
    );
  });
});
