import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), list: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolve }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/releaseops/applicationListResponder", () => ({ buildApplicationListResponse: mocks.list }));
vi.mock("@/lib/releaseops/applicationCreateResponder", () => ({ buildApplicationCreateResponse: mocks.create }));

const session = { id: "session-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };
const get = () => new NextRequest("https://app.test/api/desktop/applications");
const post = (body: object) => new NextRequest("https://app.test/api/desktop/applications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("paired desktop applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolve.mockResolvedValue(session);
    mocks.list.mockResolvedValue({ status: 200, body: { ok: true, data: { applications: [], summary: {} } } });
    mocks.create.mockResolvedValue({ status: 201, body: { ok: true, data: { created: true, slug: "checkout" } } });
  });

  it("requires a desktop session to list applications", async () => {
    mocks.resolve.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    expect((await GET(get())).status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("scopes application reads to the paired workspace", async () => {
    const { GET } = await import("../route");
    expect((await GET(get())).status).toBe(200);
    expect(mocks.list.mock.calls[0][1]).toBe("org-1");
    expect(mocks.resolve).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ requiredScope: "pipeline:read", allowApiKey: false }));
  });

  it("admin-gates application registration and preserves tenant data", async () => {
    const { POST } = await import("../route");
    expect((await POST(post({ slug: "checkout", name: "Checkout", ownerTeamLabel: "payments" }))).status).toBe(201);
    expect(mocks.resolve).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ requireWorkspaceAdmin: true }));
    expect(mocks.create.mock.calls[0][1]).toMatchObject({ organizationId: "org-1", slug: "checkout", name: "Checkout", ownerTeamLabel: "payments" });
  });

  it("rejects incomplete registration before calling the responder", async () => {
    const { POST } = await import("../route");
    expect((await POST(post({ slug: "checkout" }))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
