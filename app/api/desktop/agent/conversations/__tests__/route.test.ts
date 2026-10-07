import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
}));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveRequestDesktopSession }));
vi.mock("@/lib/db", () => ({ prisma: { agentConversation: { create: mocks.create, findMany: mocks.findMany } } }));

function request(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/agent/conversations", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };

describe("GET /api/desktop/agent/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
    mocks.findMany.mockResolvedValue([]);
  });

  it("lists only the caller's conversations in recent order", async () => {
    mocks.findMany.mockResolvedValue([{
      id: "conv_1", title: "Deploy widgets", _count: { turns: 2 },
      createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-02T00:00:00Z"),
    }]);
    const { GET } = await import("../route");
    const res = await GET(new NextRequest("https://visionxixlabs.com/api/desktop/agent/conversations"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.conversations[0]).toMatchObject({ id: "conv_1", title: "Deploy widgets", turnCount: 2 });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-1", userId: "user-1" },
      orderBy: { updatedAt: "desc" },
    }));
  });
});

describe("POST /api/desktop/agent/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const res = await POST(request({}));
    expect(res.status).toBe(401);
  });

  it("creates a conversation scoped to the caller's org", async () => {
    mocks.create.mockResolvedValue({ id: "conv_1", title: null, createdAt: new Date("2026-01-01") });
    const { POST } = await import("../route");
    const res = await POST(request({}));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data.id).toBe("conv_1");
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: "org-1", userId: "user-1" }) }));
  });
});
