import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  recordAudit: vi.fn(async (
    _repo: import("@/lib/releaseops/auditEventResponder").AuditEventRepo,
    _input: import("@/lib/releaseops/auditEventResponder").AppendAuditEventInput,
  ) => true),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({
  resolveRequestDesktopSession: mocks.resolveRequestDesktopSession,
}));
vi.mock("@/lib/db", () => ({
  prisma: { tenantIdentityProvider: { findMany: mocks.findMany, findUnique: mocks.findUnique, create: mocks.create } },
}));
vi.mock("@/lib/releaseops/auditEventResponder", async () => {
  const actual = await vi.importActual<typeof import("@/lib/releaseops/auditEventResponder")>(
    "@/lib/releaseops/auditEventResponder",
  );
  return { ...actual, appendAuditEvent: mocks.recordAudit };
});

function getRequest() {
  return new NextRequest("https://visionxixlabs.com/api/desktop/identity-providers", { method: "GET" });
}
function postRequest(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/identity-providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };
const VALID_BODY = {
  protocol: "oidc", issuerOrEntityId: "https://idp.acme.com", metadataDocument: "{}",
  managedDomains: ["acme.com"], roleMapping: [{ claimKey: "groups", claimValue: "admins", role: "admin" }], requireMfaClaim: true,
};

describe("GET /api/desktop/identity-providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it("lists providers for the session's org", async () => {
    mocks.findMany.mockResolvedValue([]);
    const { GET } = await import("../route");
    const res = await GET(getRequest());
    expect(res.status).toBe(200);
  });
});

describe("POST /api/desktop/identity-providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("rejects invalid payloads", async () => {
    const { POST } = await import("../route");
    const res = await POST(postRequest({ protocol: "oidc" }));
    expect(res.status).toBe(400);
  });

  it("creates the provider and audits it without granting any role", async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue({
      id: "idp_1", organizationId: "org-1", protocol: "oidc", status: "pending",
      issuerOrEntityId: VALID_BODY.issuerOrEntityId, managedDomains: VALID_BODY.managedDomains,
      roleMappingJson: VALID_BODY.roleMapping, requireMfaClaim: true, lastTestAssertionAt: null, revokedAt: null, createdAt: new Date(),
    });
    const { POST } = await import("../route");
    const res = await POST(postRequest(VALID_BODY));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data.status).toBe("pending");
    const auditCall = mocks.recordAudit.mock.calls[0][1];
    expect(auditCall.kind).toBe("identity.sso_configured");
  });
});
