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
  bearerFromHeader: vi.fn((h: string | null) => h),
  verifyDesktopToken: vi.fn(),
  resolveActiveSession: vi.fn(),
  touchDesktopSession: vi.fn(async () => {}),
  findMembership: vi.fn(),
  readDesktopCommercialAccess: vi.fn(),
  authenticateApiKey: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { orgMembership: { findUnique: mocks.findMembership } },
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
    mocks.bearerFromHeader.mockImplementation((h: string | null) => h);
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
});
