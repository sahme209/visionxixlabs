import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  recordAudit: vi.fn(async (
    _repo: import("@/lib/releaseops/auditEventResponder").AuditEventRepo,
    _input: import("@/lib/releaseops/auditEventResponder").AppendAuditEventInput,
  ) => true),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({
  resolveRequestDesktopSession: mocks.resolveRequestDesktopSession,
}));
vi.mock("@/lib/db", () => ({
  prisma: { tenantIdentityProvider: { findFirst: mocks.findFirst, update: mocks.update } },
}));
vi.mock("@/lib/releaseops/auditEventResponder", async () => {
  const actual = await vi.importActual<typeof import("@/lib/releaseops/auditEventResponder")>(
    "@/lib/releaseops/auditEventResponder",
  );
  return { ...actual, appendAuditEvent: mocks.recordAudit };
});

function request() {
  return new NextRequest("https://visionxixlabs.com/api/desktop/identity-providers/idp_1/revoke", { method: "POST" });
}

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };

describe("POST /api/desktop/identity-providers/[id]/revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const res = await POST(request(), { params: Promise.resolve({ id: "idp_1" }) });
    expect(res.status).toBe(401);
  });

  it("404s for a missing provider", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(request(), { params: Promise.resolve({ id: "idp_1" }) });
    expect(res.status).toBe(404);
  });

  it("revokes and audits it", async () => {
    mocks.findFirst.mockResolvedValue({ id: "idp_1", organizationId: "org-1", revokedAt: null });
    mocks.update.mockResolvedValue({ id: "idp_1", status: "revoked" });
    const { POST } = await import("../route");
    const res = await POST(request(), { params: Promise.resolve({ id: "idp_1" }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.status).toBe("revoked");
    const auditCall = mocks.recordAudit.mock.calls[0][1];
    expect(auditCall.kind).toBe("identity.sso_revoked");
  });
});
