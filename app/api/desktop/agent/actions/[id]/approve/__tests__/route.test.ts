import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  findFirstProposal: vi.fn(),
  updateProposal: vi.fn(),
  createTurn: vi.fn(async () => ({})),
  executeApprovedAction: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveRequestDesktopSession }));
vi.mock("@/lib/db", () => ({
  prisma: {
    agentActionProposal: { findFirst: mocks.findFirstProposal, update: mocks.updateProposal },
    agentConversationTurn: { create: mocks.createTurn },
  },
}));
vi.mock("@/lib/axiom/agentRuntime/actionApprovalResponder", () => ({ executeApprovedAction: mocks.executeApprovedAction }));

function request() {
  return new NextRequest("https://visionxixlabs.com/api/desktop/agent/actions/ap_1/approve", { method: "POST" });
}
const params = { params: Promise.resolve({ id: "ap_1" }) };
const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };
const proposal = { id: "ap_1", organizationId: "org-1", conversationId: "conv_1", toolName: "open_github_pull_request", argsJson: {}, status: "proposed" };

describe("POST /api/desktop/agent/actions/[id]/approve", () => {
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

  it("409s on a proposal that was already decided — approval is one-shot", async () => {
    mocks.findFirstProposal.mockResolvedValue({ ...proposal, status: "rejected" });
    const { POST } = await import("../route");
    const res = await POST(request(), params);
    expect(res.status).toBe(409);
    expect(mocks.executeApprovedAction).not.toHaveBeenCalled();
  });

  it("executes the real action and marks it executed on success", async () => {
    mocks.executeApprovedAction.mockResolvedValue({ ok: true, result: { number: 42, htmlUrl: "https://github.com/acme/widgets/pull/42" } });
    const { POST } = await import("../route");
    const res = await POST(request(), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.status).toBe("executed");
    expect(mocks.executeApprovedAction).toHaveBeenCalledWith(expect.anything(), "org-1", "open_github_pull_request", {});
  });

  it("marks the proposal failed, not silently swallowed, when GitHub rejects the action", async () => {
    mocks.executeApprovedAction.mockResolvedValue({ ok: false, error: "pull_request_create_failed: github_422" });
    const { POST } = await import("../route");
    const res = await POST(request(), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.status).toBe("failed");
    expect(body.data.errorMessage).toBe("pull_request_create_failed: github_422");
  });
});
