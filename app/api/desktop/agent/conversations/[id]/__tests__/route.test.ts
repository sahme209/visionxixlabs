import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  findFirst: vi.fn(),
  findManyTurns: vi.fn(),
  findManyActions: vi.fn(),
}));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveRequestDesktopSession }));
vi.mock("@/lib/db", () => ({
  prisma: {
    agentConversation: { findFirst: mocks.findFirst },
    agentConversationTurn: { findMany: mocks.findManyTurns },
    agentActionProposal: { findMany: mocks.findManyActions },
  },
}));

function request() {
  return new NextRequest("https://visionxixlabs.com/api/desktop/agent/conversations/conv_1", { method: "GET" });
}
const params = { params: Promise.resolve({ id: "conv_1" }) };
const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };

describe("GET /api/desktop/agent/conversations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
    mocks.findManyTurns.mockResolvedValue([]);
    mocks.findManyActions.mockResolvedValue([]);
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    const res = await GET(request(), params);
    expect(res.status).toBe(401);
  });

  it("404s for a conversation outside the caller's org", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const { GET } = await import("../route");
    const res = await GET(request(), params);
    expect(res.status).toBe(404);
  });

  it("returns turns and actions for the caller's own conversation", async () => {
    mocks.findFirst.mockResolvedValue({ id: "conv_1", organizationId: "org-1", title: null });
    mocks.findManyTurns.mockResolvedValue([{ id: "t1", role: "user", content: "hi", actionProposalId: null, createdAt: new Date("2026-01-01") }]);
    const { GET } = await import("../route");
    const res = await GET(request(), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.turns).toHaveLength(1);
  });
});
