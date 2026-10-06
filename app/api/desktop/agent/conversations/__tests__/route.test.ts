import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveRequestDesktopSession }));
vi.mock("@/lib/db", () => ({ prisma: { agentConversation: { create: mocks.create } } }));

function request(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/agent/conversations", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };

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
