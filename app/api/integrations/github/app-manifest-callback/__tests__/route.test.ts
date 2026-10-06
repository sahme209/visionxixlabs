/**
 * GitHub App Manifest callback — the one-time platform-operator setup
 * route. Locks in: admin gating, successful exchange -> encrypted upsert
 * -> redirect with ?created=1, and a failed exchange redirecting to a
 * plain-language ?error=manifest_exchange_failed without leaking raw
 * error detail. GitHub's manifest-flow redirect carries only `?code=...`
 * and no state to verify, so the admin's own session is the sole gate.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { RecordInput } from "@/lib/audit/secureAudit";

const mocks = vi.hoisted(() => ({
  currentContext: vi.fn(),
  isAdminOrOwner: vi.fn(),
  trustedAxiomUrl: vi.fn((path: string) => `https://visionxixlabs.com${path}`),
  upsertPlatformGithubAppCredential: vi.fn(),
  recordAudit: vi.fn(async (_input: RecordInput) => {}),
  fetchMock: vi.fn(),
}));

vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.currentContext }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: mocks.isAdminOrOwner }));
vi.mock("@/lib/integrations/trustedCallbackUrl", () => ({ trustedAxiomUrl: mocks.trustedAxiomUrl }));
vi.mock("@/lib/connectors/github/platformGithubAppCredential", () => ({
  upsertPlatformGithubAppCredential: mocks.upsertPlatformGithubAppCredential,
}));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.recordAudit }));

vi.stubGlobal("fetch", mocks.fetchMock);

function request(query: Record<string, string>) {
  const url = new URL("https://visionxixlabs.com/api/integrations/github/app-manifest-callback");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

function redirectPath(res: Response): string | null {
  const location = res.headers.get("location");
  if (!location) return null;
  const url = new URL(location);
  return `${url.pathname}${url.search}`;
}

const adminCtx = { isAuthenticated: true, organizationId: "org-1", userId: "user-1", email: "admin@example.com", roles: ["owner"] };

describe("GET /api/integrations/github/app-manifest-callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unauthenticated request", async () => {
    mocks.currentContext.mockResolvedValue({ isAuthenticated: false, roles: [] });

    const { GET } = await import("../route");
    const res = await GET(request({ code: "abc123" }));

    expect(redirectPath(res)).toBe("/dashboard/github-app?error=auth_required");
    expect(mocks.fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-admin, authenticated user", async () => {
    mocks.currentContext.mockResolvedValue({ ...adminCtx, roles: ["read_only"] });
    mocks.isAdminOrOwner.mockReturnValue(false);

    const { GET } = await import("../route");
    const res = await GET(request({ code: "abc123" }));

    expect(redirectPath(res)).toBe("/dashboard/github-app?error=workspace_owner_required");
    expect(mocks.fetchMock).not.toHaveBeenCalled();
  });

  it("redirects with a plain-language error when the code is missing", async () => {
    mocks.currentContext.mockResolvedValue(adminCtx);
    mocks.isAdminOrOwner.mockReturnValue(true);

    const { GET } = await import("../route");
    const res = await GET(request({}));

    expect(redirectPath(res)).toBe("/dashboard/github-app?error=manifest_exchange_failed");
    expect(mocks.fetchMock).not.toHaveBeenCalled();
  });

  it("exchanges the code, encrypts + upserts the credential, audits, and redirects with ?created=1", async () => {
    mocks.currentContext.mockResolvedValue(adminCtx);
    mocks.isAdminOrOwner.mockReturnValue(true);
    mocks.fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 42,
        slug: "axiom-agent",
        name: "Axiom Agent",
        client_id: "client_123",
        client_secret: "shh-secret",
        webhook_secret: "shh-webhook",
        pem: "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----",
        html_url: "https://github.com/apps/axiom-agent",
      }),
    });
    mocks.upsertPlatformGithubAppCredential.mockResolvedValue({
      appId: 42, slug: "axiom-agent", name: "Axiom Agent", htmlUrl: "https://github.com/apps/axiom-agent", createdAt: new Date().toISOString(),
    });

    const { GET } = await import("../route");
    const res = await GET(request({ code: "one-time-code" }));

    expect(mocks.fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/app-manifests/one-time-code/conversions",
      expect.objectContaining({ method: "POST" }),
    );
    // No Authorization header — this exchange is keyed by the one-time code itself.
    const [, fetchOpts] = mocks.fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(fetchOpts.headers.Authorization).toBeUndefined();

    expect(mocks.upsertPlatformGithubAppCredential).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 42,
        slug: "axiom-agent",
        clientSecret: "shh-secret",
        webhookSecret: "shh-webhook",
        privateKeyPem: expect.stringContaining("BEGIN RSA PRIVATE KEY"),
        createdByUserId: "user-1",
      }),
    );
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "github_app.manifest_created",
        outcome: "success",
        detail: { appId: 42, slug: "axiom-agent", name: "Axiom Agent" },
      }),
    );
    // Secrets must never reach the audit detail.
    const auditCall = mocks.recordAudit.mock.calls[0]?.[0] as { detail?: Record<string, unknown> };
    expect(JSON.stringify(auditCall.detail)).not.toContain("shh-secret");
    expect(JSON.stringify(auditCall.detail)).not.toContain("shh-webhook");
    expect(JSON.stringify(auditCall.detail)).not.toContain("BEGIN RSA PRIVATE KEY");

    expect(redirectPath(res)).toBe("/dashboard/github-app?created=1");
  });

  it("redirects to a plain-language error when GitHub's exchange fails, without leaking raw error detail", async () => {
    mocks.currentContext.mockResolvedValue(adminCtx);
    mocks.isAdminOrOwner.mockReturnValue(true);
    mocks.fetchMock.mockResolvedValue({ ok: false, status: 404 });

    const { GET } = await import("../route");
    const res = await GET(request({ code: "stale-code" }));

    expect(redirectPath(res)).toBe("/dashboard/github-app?error=manifest_exchange_failed");
    expect(mocks.upsertPlatformGithubAppCredential).not.toHaveBeenCalled();
  });

  it("redirects to the error path when the network call throws", async () => {
    mocks.currentContext.mockResolvedValue(adminCtx);
    mocks.isAdminOrOwner.mockReturnValue(true);
    mocks.fetchMock.mockRejectedValue(new Error("ECONNRESET"));

    const { GET } = await import("../route");
    const res = await GET(request({ code: "bad-network" }));

    expect(redirectPath(res)).toBe("/dashboard/github-app?error=manifest_exchange_failed");
  });

  it("redirects to the error path when the upsert itself throws", async () => {
    mocks.currentContext.mockResolvedValue(adminCtx);
    mocks.isAdminOrOwner.mockReturnValue(true);
    mocks.fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 42, slug: "axiom-agent", name: "Axiom Agent", client_id: "client_123",
        client_secret: "shh-secret", webhook_secret: "shh-webhook", pem: "pem-data",
        html_url: "https://github.com/apps/axiom-agent",
      }),
    });
    mocks.upsertPlatformGithubAppCredential.mockRejectedValue(new Error("db down"));

    const { GET } = await import("../route");
    const res = await GET(request({ code: "one-time-code" }));

    expect(redirectPath(res)).toBe("/dashboard/github-app?error=manifest_exchange_failed");
  });
});
