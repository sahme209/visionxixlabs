import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  resolveTenantScopedToken: vi.fn(),
  recordAudit: vi.fn(async () => {}),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({
  resolveRequestDesktopSession: mocks.resolveRequestDesktopSession,
}));
vi.mock("@/lib/connectors/github/resolveTenantScopedToken", async () => {
  const actual = await vi.importActual<typeof import("@/lib/connectors/github/resolveTenantScopedToken")>(
    "@/lib/connectors/github/resolveTenantScopedToken",
  );
  return { ...actual, resolveTenantScopedToken: mocks.resolveTenantScopedToken };
});
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.recordAudit }));

function request(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/github/clone-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };

describe("POST /api/desktop/github/clone-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets" }));
    expect(res.status).toBe(401);
  });

  it("mints a clone URL with the token embedded, and audits without the token", async () => {
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "ghs_SECRET" });
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.cloneUrl).toBe("https://x-access-token:ghs_SECRET@github.com/acme/widgets.git");

    const auditCall = mocks.recordAudit.mock.calls[0]?.[0] as { detail?: Record<string, unknown> };
    expect(JSON.stringify(auditCall.detail)).not.toContain("ghs_SECRET");
    expect(auditCall.action).toBe("github.clone_token_minted");
  });

  it("returns 409 when the tenant has no connected installation", async () => {
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: false, error: "github_not_connected" });
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets" }));
    expect(res.status).toBe(409);
  });
});
