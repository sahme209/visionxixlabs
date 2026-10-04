/**
 * GitHub installation transition route — covers the auth/role/origin
 * gates, and the two behaviors added alongside them this session:
 * purging the cached installation token on suspend/revoke (so a
 * revoked installation can't keep serving API calls off a stale
 * cached token for its ~1h window) and dual-writing revoke into the
 * canonical secureAudit taxonomy. Both must be best-effort — a failure
 * in either must never break the transition response itself.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  currentContext: vi.fn(),
  isSameOriginRequest: vi.fn(() => true),
  isAdminOrOwner: vi.fn(() => true),
  buildInstallationTransitionResponse: vi.fn(),
  appendAuditEvent: vi.fn(async () => {}),
  purgeInstallationTokenCache: vi.fn(),
  findInstallation: vi.fn(),
  recordAudit: vi.fn(async () => {}),
}));

vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.currentContext }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: mocks.isSameOriginRequest }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: mocks.isAdminOrOwner }));
vi.mock("@/lib/db", () => ({ prisma: { gitHubInstallation: { findUnique: mocks.findInstallation } } }));
vi.mock("@/lib/releaseops/githubInstallationResponder", () => ({
  buildInstallationTransitionResponse: mocks.buildInstallationTransitionResponse,
  INSTALL_TRANSITIONS: ["suspend", "revoke", "reactivate"],
}));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: mocks.appendAuditEvent }));
vi.mock("@/lib/connectors/github/githubAppAuth", () => ({
  purgeInstallationTokenCache: mocks.purgeInstallationTokenCache,
}));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.recordAudit }));
vi.mock("@/lib/domain/ids", () => ({ newCorrelationId: () => "corr-1" }));

function request(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/dashboard/github-installation-transition", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const authedCtx = {
  isAuthenticated: true,
  organizationId: "org-1",
  userId: "user-1",
  email: "owner@example.test",
  roles: ["owner"],
};

const successBody = (prev: string, next: string) => ({
  ok: true,
  data: { id: "install-row-1", previousStatus: prev, status: next, action: next === "revoked" ? "revoke" : "suspend" },
});

describe("POST /api/dashboard/github-installation-transition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.isAdminOrOwner.mockReturnValue(true);
    mocks.currentContext.mockResolvedValue(authedCtx);
  });

  it("rejects a cross-origin request before touching auth or the DB", async () => {
    mocks.isSameOriginRequest.mockReturnValue(false);
    const { POST } = await import("../route");
    const res = await POST(request({ installationRowId: "install-row-1", action: "revoke" }));
    expect(res.status).toBe(403);
    expect(mocks.currentContext).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    mocks.currentContext.mockResolvedValue({ isAuthenticated: false, roles: [] });
    const { POST } = await import("../route");
    const res = await POST(request({ installationRowId: "install-row-1", action: "revoke" }));
    expect(res.status).toBe(401);
  });

  it("requires owner/admin — a member without that role is rejected", async () => {
    mocks.isAdminOrOwner.mockReturnValue(false);
    const { POST } = await import("../route");
    const res = await POST(request({ installationRowId: "install-row-1", action: "revoke" }));
    expect(res.status).toBe(403);
    expect(mocks.buildInstallationTransitionResponse).not.toHaveBeenCalled();
  });

  it("rejects an invalid action", async () => {
    const { POST } = await import("../route");
    const res = await POST(request({ installationRowId: "install-row-1", action: "delete" }));
    expect(res.status).toBe(400);
  });

  it("on revoke: purges the token cache by numeric installation id and dual-writes the canonical audit", async () => {
    mocks.buildInstallationTransitionResponse.mockResolvedValue({ status: 200, body: successBody("active", "revoked") });
    mocks.findInstallation.mockResolvedValue({ githubInstallationId: "98765" });

    const { POST } = await import("../route");
    const res = await POST(request({ installationRowId: "install-row-1", action: "revoke" }));

    expect(res.status).toBe(200);
    expect(mocks.appendAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: "github_installation.revoke" }));
    expect(mocks.purgeInstallationTokenCache).toHaveBeenCalledWith(98765);
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "connector.disconnect", outcome: "success", entityRef: "github_installation:install-row-1" }),
    );
  });

  it("on suspend: purges the token cache but does NOT write the canonical connector.disconnect audit", async () => {
    mocks.buildInstallationTransitionResponse.mockResolvedValue({ status: 200, body: successBody("active", "suspended") });
    mocks.findInstallation.mockResolvedValue({ githubInstallationId: "11111" });

    const { POST } = await import("../route");
    await POST(request({ installationRowId: "install-row-1", action: "suspend" }));

    expect(mocks.purgeInstallationTokenCache).toHaveBeenCalledWith(11111);
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("on reactivate: neither purges the cache nor writes the canonical audit", async () => {
    mocks.buildInstallationTransitionResponse.mockResolvedValue({ status: 200, body: successBody("revoked", "active") });

    const { POST } = await import("../route");
    await POST(request({ installationRowId: "install-row-1", action: "reactivate" }));

    expect(mocks.purgeInstallationTokenCache).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("a cache-purge failure is best-effort and does not break the response", async () => {
    mocks.buildInstallationTransitionResponse.mockResolvedValue({ status: 200, body: successBody("active", "revoked") });
    mocks.findInstallation.mockRejectedValue(new Error("db unavailable"));

    const { POST } = await import("../route");
    const res = await POST(request({ installationRowId: "install-row-1", action: "revoke" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("does not audit or purge anything when the transition itself fails (e.g. cross-org or illegal transition)", async () => {
    mocks.buildInstallationTransitionResponse.mockResolvedValue({ status: 403, body: { ok: false, error: "cross_org_installation" } });

    const { POST } = await import("../route");
    const res = await POST(request({ installationRowId: "install-row-1", action: "revoke" }));

    expect(res.status).toBe(403);
    expect(mocks.appendAuditEvent).not.toHaveBeenCalled();
    expect(mocks.purgeInstallationTokenCache).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });
});
