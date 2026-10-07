import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  findFirstConversation: vi.fn(),
  updateConversation: vi.fn(async () => ({})),
  transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
  createTurn: vi.fn(async () => ({})),
  findManyTurns: vi.fn(async () => []),
  createProposal: vi.fn(async () => ({ id: "ap_1", toolName: "open_github_pull_request", argsJson: {}, riskLevel: "medium", status: "proposed" })),
  runDecisionLoop: vi.fn(),
  prepareProposalArgsForReview: vi.fn(),
  findManySkills: vi.fn(async (): Promise<Array<{ skillId: string; status: string }>> => []),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveRequestDesktopSession }));
vi.mock("@/lib/db", () => ({
  prisma: {
    agentConversation: { findFirst: mocks.findFirstConversation, update: mocks.updateConversation },
    agentConversationTurn: { create: mocks.createTurn, findMany: mocks.findManyTurns },
    agentActionProposal: { create: mocks.createProposal },
    agentSkillInstallation: { findMany: mocks.findManySkills },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/axiom/agentRuntime/decisionLoop", () => ({ runDecisionLoop: mocks.runDecisionLoop }));
vi.mock("@/lib/axiom/agentRuntime/toolExecution", () => ({ executeReadOnlyTool: vi.fn(), isProdEnvironmentTarget: vi.fn() }));
vi.mock("@/lib/axiom/agentRuntime/proposalReview", () => ({ prepareProposalArgsForReview: mocks.prepareProposalArgsForReview }));

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
    mocks.findFirstConversation.mockResolvedValue({ id: "conv_1", organizationId: "org-1", userId: "user-1", title: null });
    mocks.prepareProposalArgsForReview.mockImplementation(async (_organizationId: string, _toolName: string, args: Record<string, unknown>) => ({ ok: true, args }));
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
    expect(mocks.updateConversation).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "conv_1" },
      data: expect.objectContaining({ title: "what environments do I have?" }),
    }));
  });

  it("forwards the selected provider to the governed decision loop", async () => {
    mocks.runDecisionLoop.mockResolvedValue({ kind: "final", message: "Ready." });
    const { POST } = await import("../route");
    const res = await POST(request({ message: "hello", preferredProvider: "anthropic" }), params);
    expect(res.status).toBe(200);
    expect(mocks.runDecisionLoop).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-1",
      preferredProvider: "anthropic",
    }));
  });

  it("rejects a disabled slash skill before calling an AI provider", async () => {
    mocks.findManySkills.mockResolvedValue([{ skillId: "release-readiness", status: "disabled" }]);
    const { POST } = await import("../route");
    const res = await POST(request({ message: "/release-readiness check this release" }), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.reply).toMatch(/not enabled/i);
    expect(mocks.runDecisionLoop).not.toHaveBeenCalled();
  });

  it("prioritizes an explicitly invoked enabled skill in Agent context", async () => {
    mocks.findManySkills.mockResolvedValue([{ skillId: "release-readiness", status: "enabled" }]);
    mocks.runDecisionLoop.mockResolvedValue({ kind: "final", message: "Checking readiness." });
    const { POST } = await import("../route");
    const res = await POST(request({ message: "/release-readiness check this release" }), params);
    expect(res.status).toBe(200);
    expect(mocks.runDecisionLoop).toHaveBeenCalledWith(expect.objectContaining({
      skillContext: expect.stringContaining("Explicitly invoked skill: Release readiness check"),
    }));
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

  it("does not persist a file action when a trustworthy review snapshot cannot be prepared", async () => {
    mocks.runDecisionLoop.mockResolvedValue({
      kind: "proposal", message: "I'll edit this file.", toolName: "commit_github_file",
      args: { repositoryFullName: "acme/widgets", branch: "fix", path: "src/app.ts", content: "new" }, riskLevel: "medium",
    });
    mocks.prepareProposalArgsForReview.mockResolvedValue({ ok: false, error: "file_review_unavailable" });
    const { POST } = await import("../route");
    const res = await POST(request({ message: "edit it" }), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.proposal).toBeNull();
    expect(body.data.reply).toMatch(/trustworthy approval preview/i);
    expect(mocks.createProposal).not.toHaveBeenCalled();
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
