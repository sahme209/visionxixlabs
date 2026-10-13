import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  currentContext: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  createAudit: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.currentContext }));
vi.mock("@/lib/db", () => ({
  prisma: {
    desktopSessionRecord: { findMany: mocks.findMany },
    $transaction: mocks.transaction,
  },
}));

function request(id = "dsk_1", origin = "https://visionxixlabs.com") {
  return new NextRequest(`https://visionxixlabs.com/api/control/audit-security/sessions?id=${id}`, {
    method: "DELETE",
    headers: { origin },
  });
}

describe("control-plane organization desktop sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentContext.mockResolvedValue({
      isAuthenticated: true,
      organizationId: "org-1",
      userId: "user-1",
      email: "owner@example.com",
      roles: ["owner"],
    });
    mocks.findMany.mockResolvedValue([]);
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.createAudit.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      desktopSessionRecord: { updateMany: mocks.updateMany },
      secureAuditRecord: { create: mocks.createAudit },
    }));
  });

  it("denies organization session inventory to non-admin roles", async () => {
    mocks.currentContext.mockResolvedValue({
      isAuthenticated: true,
      organizationId: "org-1",
      userId: "user-2",
      email: "reader@example.com",
      roles: ["read_only"],
    });
    const { GET } = await import("../route");
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("scopes active session inventory to the authenticated organization", async () => {
    const { GET } = await import("../route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: "org-1", revokedAt: null }),
    }));
  });

  it("rejects cross-origin revocation before touching persistence", async () => {
    const { DELETE } = await import("../route");
    const response = await DELETE(request("dsk_1", "https://attacker.example"));
    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("atomically scopes revocation and appends safe audit evidence", async () => {
    const { DELETE } = await import("../route");
    const response = await DELETE(request());
    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "dsk_1", organizationId: "org-1", revokedAt: null }),
    }));
    expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: "org-1",
        actorUserId: "user-1",
        action: "desktop.revoke",
        entityRef: "desktop_session:dsk_1",
      }),
    }));
  });

  it("returns not found when a concurrent request already revoked the session", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    const { DELETE } = await import("../route");
    const response = await DELETE(request());
    expect(response.status).toBe(404);
    expect(mocks.createAudit).not.toHaveBeenCalled();
  });
});
