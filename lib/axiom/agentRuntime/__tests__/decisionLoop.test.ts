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
});
