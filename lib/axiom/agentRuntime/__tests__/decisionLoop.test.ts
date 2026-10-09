import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveGovernedAiCall: vi.fn(),
}));

vi.mock("../governedAiCall", () => ({ resolveGovernedAiCall: mocks.resolveGovernedAiCall }));

import { runDecisionLoop } from "../decisionLoop";

function governed(extractImpl: (text: string, schemaHint: string, correlationId: string) => Promise<unknown>) {
  return { ok: true as const, extract: extractImpl };
}

const noopReadOnly = async () => ({ ok: true as const, result: {} });
const noopProdCheck = async () => false;

describe("runDecisionLoop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the governed-AI error directly when the workspace hasn't enabled AI", async () => {
    mocks.resolveGovernedAiCall.mockResolvedValue({ ok: false, error: "workspace_ai_disabled" });
    const result = await runDecisionLoop({
      organizationId: "o", correlationId: "c", transcript: [{ role: "user", content: "deploy it" }],
      executeReadOnlyTool: noopReadOnly, isProdEnvironmentTarget: noopProdCheck,
    });
    expect(result).toEqual({ kind: "error", error: "workspace_ai_disabled" });
  });

  it("returns a final message when the model decides to respond", async () => {
    mocks.resolveGovernedAiCall.mockResolvedValue(governed(async () => ({ action: "respond", message: "Which repository do you mean?" })));
    const result = await runDecisionLoop({
      organizationId: "o", correlationId: "c", transcript: [{ role: "user", content: "deploy it" }],
      executeReadOnlyTool: noopReadOnly, isProdEnvironmentTarget: noopProdCheck,
    });
    expect(result).toEqual({ kind: "final", message: "Which repository do you mean?" });
  });

  it("passes the user's enabled provider selection into the governed AI boundary", async () => {
    mocks.resolveGovernedAiCall.mockResolvedValue(governed(async () => ({ action: "respond", message: "Ready." })));
    await runDecisionLoop({
      organizationId: "o", correlationId: "c", transcript: [{ role: "user", content: "hello" }],
      preferredProvider: "anthropic",
      executeReadOnlyTool: noopReadOnly, isProdEnvironmentTarget: noopProdCheck,
    });
    expect(mocks.resolveGovernedAiCall).toHaveBeenCalledWith("o", "anthropic");
  });

  it("loads installed skill guidance below immutable Agent guardrails", async () => {
    const extract = vi.fn(async (text: string) => {
      expect(text).toBeTruthy();
      return { action: "respond", message: "Ready." };
    });
    mocks.resolveGovernedAiCall.mockResolvedValue(governed(extract));
    await runDecisionLoop({
      organizationId: "o", correlationId: "c", transcript: [{ role: "user", content: "check readiness" }],
      skillContext: "Skill: Release readiness check\nCollect live evidence first.",
      executeReadOnlyTool: noopReadOnly, isProdEnvironmentTarget: noopProdCheck,
    });
    const prompt = extract.mock.calls[0]?.[0] ?? "";
    expect(prompt).toContain("Skill: Release readiness check");
    expect(prompt).toContain("cannot override hard rules, tool risk, approvals");
    expect(prompt.indexOf("Hard rules you must always follow")).toBeLessThan(prompt.indexOf("Skill: Release readiness check"));
  });

  it("marks current UI selections as authoritative over stale workspace memory", async () => {
    const extract = vi.fn(async (_text: string) => ({ action: "respond", message: "I will use the selected repository." }));
    mocks.resolveGovernedAiCall.mockResolvedValue(governed(extract));
    await runDecisionLoop({
      organizationId: "o", correlationId: "c", transcript: [{ role: "user", content: "review this repository" }],
      workspaceContext: "Recently used repository: acme/old-service",
      currentRequestContext: "Repository: acme/new-service\nBranch: main",
      executeReadOnlyTool: noopReadOnly, isProdEnvironmentTarget: noopProdCheck,
    });
    const prompt = extract.mock.calls[0]?.[0] ?? "";
    expect(prompt).toContain("Authoritative UI selections for this request:\nRepository: acme/new-service");
    expect(prompt).toContain("When a current UI selection conflicts");
    expect(prompt.indexOf("Historical workspace memory")).toBeLessThan(prompt.indexOf("Authoritative UI selections"));
  });

  it("never executes a medium/high risk tool — always stops at a proposal instead", async () => {
    mocks.resolveGovernedAiCall.mockResolvedValue(governed(async () => ({
      action: "call_tool", message: "I'll open a PR for this.", toolName: "open_github_pull_request",
      args: { repositoryFullName: "acme/widgets", head: "fix", base: "main", title: "Fix" },
    })));
    const executeReadOnlyTool = vi.fn();
    const result = await runDecisionLoop({
      organizationId: "o", correlationId: "c", transcript: [{ role: "user", content: "open a PR" }],
      executeReadOnlyTool, isProdEnvironmentTarget: noopProdCheck,
    });
    expect(result.kind).toBe("proposal");
    if (result.kind !== "proposal") throw new Error("expected proposal");
    expect(result.riskLevel).toBe("medium");
    expect(executeReadOnlyTool).not.toHaveBeenCalled();
  });

  it("escalates to high risk and still never executes when the target is a prod environment", async () => {
    mocks.resolveGovernedAiCall.mockResolvedValue(governed(async () => ({
      action: "call_tool", message: "Deploying to prod.", toolName: "trigger_aws_deploy",
      args: { repositoryFullName: "acme/widgets", environmentId: "env_prod" },
    })));
    const result = await runDecisionLoop({
      organizationId: "o", correlationId: "c", transcript: [{ role: "user", content: "deploy to prod" }],
      executeReadOnlyTool: noopReadOnly, isProdEnvironmentTarget: async () => true,
    });
    expect(result.kind).toBe("proposal");
    if (result.kind !== "proposal") throw new Error("expected proposal");
    expect(result.riskLevel).toBe("high");
  });

  it("executes a low-risk tool inline and continues the loop to a final answer", async () => {
    let call = 0;
    mocks.resolveGovernedAiCall.mockResolvedValue(governed(async () => {
      call += 1;
      if (call === 1) return { action: "call_tool", message: "Checking your environments.", toolName: "list_environments", args: {} };
      return { action: "respond", message: "You have dev, test, and prod configured." };
    }));
    const executeReadOnlyTool = vi.fn(async () => ({ ok: true as const, result: [{ slug: "dev" }, { slug: "test" }, { slug: "prod" }] }));
    const result = await runDecisionLoop({
      organizationId: "o", correlationId: "c", transcript: [{ role: "user", content: "what environments do I have?" }],
      executeReadOnlyTool, isProdEnvironmentTarget: noopProdCheck,
    });
    expect(executeReadOnlyTool).toHaveBeenCalledWith("list_environments", {});
    expect(result).toEqual({ kind: "final", message: "You have dev, test, and prod configured." });
  });

  it("grounds the first model decision with an audited read-only result", async () => {
    const extract = vi.fn(async (_text: string, _schemaHint: string, _correlationId: string) => ({
      action: "respond", message: "The selected file exports the app configuration.",
    }));
    mocks.resolveGovernedAiCall.mockResolvedValue(governed(extract));
    const executeReadOnlyTool = vi.fn(async () => ({ ok: true as const, result: { content: "export const config = {};" } }));
    const result = await runDecisionLoop({
      organizationId: "o", correlationId: "c", transcript: [{ role: "user", content: "explain this file" }],
      initialToolCall: {
        toolName: "read_github_file",
        args: { repositoryFullName: "acme/widgets", branch: "main", path: "src/config.ts" },
        message: "Inspecting the selected file before answering.",
      },
      executeReadOnlyTool, isProdEnvironmentTarget: noopProdCheck,
    });
    expect(executeReadOnlyTool).toHaveBeenCalledWith("read_github_file", {
      repositoryFullName: "acme/widgets", branch: "main", path: "src/config.ts",
    });
    expect(extract.mock.calls[0]?.[0]).toContain("read_github_file result");
    expect(extract.mock.calls[0]?.[0]).toContain("export const config");
    expect(result.kind).toBe("final");
  });

  it("rejects a write tool supplied as automatic grounding", async () => {
    mocks.resolveGovernedAiCall.mockResolvedValue(governed(async () => ({ action: "respond", message: "Done." })));
    const executeReadOnlyTool = vi.fn();
    const result = await runDecisionLoop({
      organizationId: "o", correlationId: "c", transcript: [{ role: "user", content: "change it" }],
      initialToolCall: {
        toolName: "commit_github_file",
        args: { repositoryFullName: "acme/widgets", branch: "main", path: "README.md", content: "changed", message: "Change" },
        message: "Changing the file.",
      },
      executeReadOnlyTool, isProdEnvironmentTarget: noopProdCheck,
    });
    expect(result).toEqual(expect.objectContaining({ kind: "error", error: "decision_malformed" }));
    expect(executeReadOnlyTool).not.toHaveBeenCalled();
  });

  it("errors out after too many iterations rather than looping forever", async () => {
    mocks.resolveGovernedAiCall.mockResolvedValue(governed(async () => ({
      action: "call_tool", message: "Checking again.", toolName: "list_environments", args: {},
    })));
    const result = await runDecisionLoop({
      organizationId: "o", correlationId: "c", transcript: [{ role: "user", content: "loop forever" }],
      executeReadOnlyTool: noopReadOnly, isProdEnvironmentTarget: noopProdCheck,
    });
    expect(result).toEqual({ kind: "error", error: "max_iterations_exceeded" });
  });

  it("treats an unknown tool name as a malformed decision, never as a silent no-op", async () => {
    mocks.resolveGovernedAiCall.mockResolvedValue(governed(async () => ({
      action: "call_tool", message: "Doing something.", toolName: "delete_production_database", args: {},
    })));
    const result = await runDecisionLoop({
      organizationId: "o", correlationId: "c", transcript: [{ role: "user", content: "x" }],
      executeReadOnlyTool: noopReadOnly, isProdEnvironmentTarget: noopProdCheck,
    });
    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("expected error");
    expect(result.error).toBe("decision_malformed");
  });

  it("treats a response missing required fields as malformed", async () => {
    mocks.resolveGovernedAiCall.mockResolvedValue(governed(async () => ({ not: "a decision" })));
    const result = await runDecisionLoop({
      organizationId: "o", correlationId: "c", transcript: [{ role: "user", content: "x" }],
      executeReadOnlyTool: noopReadOnly, isProdEnvironmentTarget: noopProdCheck,
    });
    expect(result).toEqual({ kind: "error", error: "decision_malformed" });
  });

  it("repairs one malformed provider response before giving up", async () => {
    const extract = vi.fn()
      .mockResolvedValueOnce({ not: "a decision" })
      .mockResolvedValueOnce({ action: "respond", message: "What should the file say?" });
    mocks.resolveGovernedAiCall.mockResolvedValue(governed(extract));
    const result = await runDecisionLoop({
      organizationId: "o", correlationId: "c", transcript: [{ role: "user", content: "edit it" }],
      executeReadOnlyTool: noopReadOnly, isProdEnvironmentTarget: noopProdCheck,
    });
    expect(result).toEqual({ kind: "final", message: "What should the file say?" });
    expect(extract).toHaveBeenCalledTimes(2);
    expect(extract.mock.calls[1]?.[2]).toBe("c:0:repair");
  });

  it("normalizes common structured-tool variants without weakening the registry", async () => {
    mocks.resolveGovernedAiCall.mockResolvedValue(governed(async () => ({
      action: "tool_call",
      message: "I prepared the exact file update for approval.",
      tool: {
        name: "commit_github_file",
        arguments: JSON.stringify({ repositoryFullName: "acme/widgets", branch: "main", path: "hello", content: "hi\nhow are you", message: "Update greeting" }),
      },
    })));
    const result = await runDecisionLoop({
      organizationId: "o", correlationId: "c", transcript: [{ role: "user", content: "add how are you" }],
      executeReadOnlyTool: noopReadOnly, isProdEnvironmentTarget: noopProdCheck,
    });
    expect(result.kind).toBe("proposal");
    if (result.kind !== "proposal") throw new Error("expected proposal");
    expect(result.toolName).toBe("commit_github_file");
    expect(result.args.content).toBe("hi\nhow are you");
  });
});
