import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  decryptScopedCredential: vi.fn(),
  encryptScopedCredential: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveRequestDesktopSession }));
vi.mock("@/lib/db", () => ({ prisma: { tenantIntegrationConnection: { findUnique: mocks.findUnique, update: mocks.update } } }));
vi.mock("@/lib/security/credentialVault", () => ({ decryptScopedCredential: mocks.decryptScopedCredential, encryptScopedCredential: mocks.encryptScopedCredential }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.recordAudit }));

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };

describe("POST /api/desktop/integrations/linear/validate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
    mocks.findUnique.mockResolvedValue({ id: "connection-1", status: "pending", encryptedCredential: "ciphertext" });
    mocks.decryptScopedCredential.mockReturnValue(JSON.stringify({ accessToken: "access-secret", refreshToken: "refresh-secret", expiresAt: Date.now() + 3_600_000 }));
    mocks.encryptScopedCredential.mockReturnValue("rotated-ciphertext");
    mocks.update.mockResolvedValue({});
    mocks.recordAudit.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { viewer: { id: "linear-app-user" } } }), { status: 200 })));
  });

  it("requires a desktop admin session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const response = await POST(new NextRequest("https://visionxixlabs.com/api/desktop/integrations/linear/validate", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("marks Linear active only after a live identity read and returns no credential", async () => {
    const { POST } = await import("../route");
    const response = await POST(new NextRequest("https://visionxixlabs.com/api/desktop/integrations/linear/validate", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { status: "active" } });
    expect(JSON.stringify(body)).not.toContain("access-secret");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "connection-1" },
      data: expect.objectContaining({ status: "active", externalAccountId: "linear-app-user", encryptedCredential: "rotated-ciphertext" }),
    }));
  });
});
