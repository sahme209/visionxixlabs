/**
 * GitHub App install-callback — the one route that turns a GitHub
 * redirect into a tenant-bound installation record. Locks in the
 * security-critical behaviors: a consumed/expired/unknown state never
 * captures an installation; a state whose bound redirectUri doesn't
 * match the trusted callback path is rejected the same way (no
 * distinguishable error that would help an attacker probe state
 * validity vs. callback validity); the organizationId used to persist
 * the installation always comes from the server-side authorization
 * record, never from any request-supplied value; and an unexpected
 * setup_action can't ride a validly-consumed state into creating or
 * reviving an installation.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  consumeTenantIntegrationAuthorization: vi.fn(),
  matchesTrustedIntegrationCallbackUrl: vi.fn(),
  trustedAxiomUrl: vi.fn((path: string) => `https://visionxixlabs.com${path}`),
  buildInstallationCaptureResponse: vi.fn(),
  appendAuditEvent: vi.fn(async () => {}),
}));

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/integrations/tenantConnectionRepo", () => ({
  consumeTenantIntegrationAuthorization: mocks.consumeTenantIntegrationAuthorization,
}));
vi.mock("@/lib/integrations/trustedCallbackUrl", () => ({
  matchesTrustedIntegrationCallbackUrl: mocks.matchesTrustedIntegrationCallbackUrl,
  trustedAxiomUrl: mocks.trustedAxiomUrl,
}));
vi.mock("@/lib/releaseops/githubInstallationResponder", () => ({
  buildInstallationCaptureResponse: mocks.buildInstallationCaptureResponse,
}));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({
  appendAuditEvent: mocks.appendAuditEvent,
}));

function request(query: Record<string, string>) {
  const url = new URL("https://visionxixlabs.com/api/integrations/github/install-callback");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

function redirectStatus(res: Response): string | null {
  const location = res.headers.get("location");
  if (!location) return null;
  return new URL(location).searchParams.get("status");
}

const validAttempt = {
  organizationId: "org-legit",
  redirectUri: "https://visionxixlabs.com/api/integrations/github/install-callback",
  initiatedByUserId: "user-1",
};

describe("GET /api/integrations/github/install-callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.matchesTrustedIntegrationCallbackUrl.mockReturnValue(true);
  });

  it("rejects an unknown/expired/consumed state without attempting installation capture", async () => {
    mocks.consumeTenantIntegrationAuthorization.mockResolvedValue({ ok: false, reason: "expired" });

    const { GET } = await import("../route");
    const res = await GET(request({ installation_id: "123", setup_action: "install", state: "bad-state" }));

    expect(redirectStatus(res)).toBe("invalid_state");
    expect(mocks.buildInstallationCaptureResponse).not.toHaveBeenCalled();
  });

  it("rejects a validly-consumed state whose redirectUri doesn't match the trusted callback (same error as invalid state — no oracle)", async () => {
    mocks.consumeTenantIntegrationAuthorization.mockResolvedValue({ ok: true, attempt: validAttempt });
    mocks.matchesTrustedIntegrationCallbackUrl.mockReturnValue(false);

    const { GET } = await import("../route");
    const res = await GET(request({ installation_id: "123", setup_action: "install", state: "good-state" }));

    expect(redirectStatus(res)).toBe("invalid_state");
    expect(mocks.buildInstallationCaptureResponse).not.toHaveBeenCalled();
  });

  it("acknowledges a 'request to install' action without persisting anything", async () => {
    mocks.consumeTenantIntegrationAuthorization.mockResolvedValue({ ok: true, attempt: validAttempt });

    const { GET } = await import("../route");
    const res = await GET(request({ setup_action: "request", state: "good-state" }));

    expect(redirectStatus(res)).toBe("approval_requested");
    expect(mocks.buildInstallationCaptureResponse).not.toHaveBeenCalled();
  });

  it("rejects an unexpected setup_action even with an otherwise-valid, consumed state", async () => {
    mocks.consumeTenantIntegrationAuthorization.mockResolvedValue({ ok: true, attempt: validAttempt });

    const { GET } = await import("../route");
    const res = await GET(request({ installation_id: "123", setup_action: "delete", state: "good-state" }));

    expect(redirectStatus(res)).toBe("error");
    expect(mocks.buildInstallationCaptureResponse).not.toHaveBeenCalled();
  });

  it("rejects a missing installation_id on an otherwise-valid install action", async () => {
    mocks.consumeTenantIntegrationAuthorization.mockResolvedValue({ ok: true, attempt: validAttempt });

    const { GET } = await import("../route");
    const res = await GET(request({ setup_action: "install", state: "good-state" }));

    expect(redirectStatus(res)).toBe("missing_installation");
    expect(mocks.buildInstallationCaptureResponse).not.toHaveBeenCalled();
  });

  it("captures the installation under the state's bound organizationId, never a request-supplied value, and audits it", async () => {
    mocks.consumeTenantIntegrationAuthorization.mockResolvedValue({ ok: true, attempt: validAttempt });
    mocks.buildInstallationCaptureResponse.mockResolvedValue({
      body: { ok: true, data: { installation: { id: "install-row-1" }, created: true } },
    });

    const { GET } = await import("../route");
    // Note: no organizationId is ever present on the inbound request — GitHub's
    // callback contract only sends installation_id/setup_action/state. This
    // asserts the route can't be tricked into using a different org even if
    // one were smuggled in via an extra query param.
    const res = await GET(request({ installation_id: "456", setup_action: "install", state: "good-state", organizationId: "org-attacker" }));

    expect(mocks.buildInstallationCaptureResponse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ organizationId: "org-legit", githubInstallationId: "456" }),
    );
    expect(mocks.appendAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ organizationId: "org-legit", kind: "github_installation.capture" }),
    );
    expect(redirectStatus(res)).toBe("installation_recorded");
  });

  it("redirects to an 'error' status without throwing when installation capture itself fails", async () => {
    mocks.consumeTenantIntegrationAuthorization.mockResolvedValue({ ok: true, attempt: validAttempt });
    mocks.buildInstallationCaptureResponse.mockResolvedValue({ body: { ok: false, error: "migration_pending" } });

    const { GET } = await import("../route");
    const res = await GET(request({ installation_id: "789", setup_action: "install", state: "good-state" }));

    expect(redirectStatus(res)).toBe("error");
    expect(mocks.appendAuditEvent).not.toHaveBeenCalled();
  });
});
