import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  findFirstProposal: vi.fn(),
  updateProposal: vi.fn(),
  createTurn: vi.fn(async () => ({})),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveRequestDesktopSession }));
vi.mock("@/lib/db", () => ({
  prisma: {
    agentActionProposal: { findFirst: mocks.findFirstProposal, update: mocks.updateProposal },
    agentConversationTurn: { create: mocks.createTurn },
  },
}));

function request() {
  return new NextRequest("https://visionxixlabs.com/api/desktop/agent/actions/ap_1/reject", { method: "POST" });
}
const params = { params: Promise.resolve({ id: "ap_1" }) };
const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };
const proposal = { id: "ap_1", organizationId: "org-1", conversationId: "conv_1", toolName: "open_github_pull_request", status: "proposed" };

describe("POST /api/desktop/agent/actions/[id]/reject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
    mocks.findFirstProposal.mockResolvedValue(proposal);
    mocks.updateProposal.mockImplementation(async ({ data }) => ({ ...proposal, ...data }));
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const res = await POST(request(), params);
    expect(res.status).toBe(401);
  });

  it("404s for a proposal outside the caller's org", async () => {
    mocks.findFirstProposal.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(request(), params);
    expect(res.status).toBe(404);
  });

  it("409s on a proposal that was already decided", async () => {
    mocks.findFirstProposal.mockResolvedValue({ ...proposal, status: "executed" });
    const { POST } = await import("../route");
    const res = await POST(request(), params);
    expect(res.status).toBe(409);
  });

  it("rejects and leaves an audit turn, without ever calling any write action", async () => {
    const { POST } = await import("../route");
    const res = await POST(request(), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.status).toBe("rejected");
    expect(mocks.createTurn).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: "tool_result", content: expect.stringContaining("rejected") }),
    }));
  });
});
