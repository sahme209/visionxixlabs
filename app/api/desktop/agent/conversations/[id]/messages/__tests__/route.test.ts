import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  findFirstConversation: vi.fn(),
  createTurn: vi.fn(async () => ({})),
  findManyTurns: vi.fn(async () => []),
  createProposal: vi.fn(async () => ({ id: "ap_1", toolName: "open_github_pull_request", argsJson: {}, riskLevel: "medium", status: "proposed" })),
  runDecisionLoop: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveRequestDesktopSession }));
vi.mock("@/lib/db", () => ({
  prisma: {
    agentConversation: { findFirst: mocks.findFirstConversation },
    agentConversationTurn: { create: mocks.createTurn, findMany: mocks.findManyTurns },
    agentActionProposal: { create: mocks.createProposal },
  },
}));
vi.mock("@/lib/axiom/agentRuntime/decisionLoop", () => ({ runDecisionLoop: mocks.runDecisionLoop }));
vi.mock("@/lib/axiom/agentRuntime/toolExecution", () => ({ executeReadOnlyTool: vi.fn(), isProdEnvironmentTarget: vi.fn() }));

function request(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/agent/conversations/conv_1/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };
const params = { params: Promise.resolve({ id: "conv_1" }) };

describe("POST /api/desktop/agent/conversations/[id]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
    mocks.findFirstConversation.mockResolvedValue({ id: "conv_1", organizationId: "org-1" });
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const res = await POST(request({ message: "hi" }), params);
    expect(res.status).toBe(401);
  });

  it("404s for a conversation outside the caller's org", async () => {
    mocks.findFirstConversation.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(request({ message: "hi" }), params);
    expect(res.status).toBe(404);
  });

  it("rejects an empty message", async () => {
    const { POST } = await import("../route");
    const res = await POST(request({ message: "   " }), params);
    expect(res.status).toBe(400);
  });

  it("returns a final reply and no proposal when the agent just answers", async () => {
    mocks.runDecisionLoop.mockResolvedValue({ kind: "final", message: "You have 3 environments configured." });
    const { POST } = await import("../route");
    const res = await POST(request({ message: "what environments do I have?" }), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.reply).toBe("You have 3 environments configured.");
    expect(body.data.proposal).toBeNull();
  });

  it("never auto-executes — a proposal outcome always comes back pending, never pre-approved", async () => {
    mocks.runDecisionLoop.mockResolvedValue({
      kind: "proposal", message: "I'll open this PR.", toolName: "open_github_pull_request",
      args: { repositoryFullName: "acme/widgets" }, riskLevel: "medium",
    });
    const { POST } = await import("../route");
    const res = await POST(request({ message: "open a PR" }), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.proposal.status).toBe("proposed");
    expect(mocks.createProposal).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "proposed", riskLevel: "medium" }),
    }));
  });

  it("surfaces a governance error (AI disabled) as a plain-English reply instead of a 500", async () => {
    mocks.runDecisionLoop.mockResolvedValue({ kind: "error", error: "workspace_ai_disabled" });
    const { POST } = await import("../route");
    const res = await POST(request({ message: "deploy it" }), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.reply).toMatch(/AI isn't enabled/i);
  });
});
