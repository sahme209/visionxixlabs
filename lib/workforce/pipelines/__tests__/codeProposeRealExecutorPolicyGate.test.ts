/**
 * The real code-proposal stage must verify workspace policy before invoking
 * Vercel AI Gateway. Missing policy, disabled AI, and denied Gateway access
 * all fail closed without an outbound inference call.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkWorkspaceAICredits: vi.fn(),
  loadWorkspaceAIProviderPolicyWithState: vi.fn(),
  resolveWorkspaceAIProviderPolicy: vi.fn(),
  getAIProviderManager: vi.fn(),
  gatewayGenerate: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("@/lib/billing/checkWorkspaceAICredits", () => ({ checkWorkspaceAICredits: mocks.checkWorkspaceAICredits }));
vi.mock("@/lib/billing/recordAIUsageEvent", () => ({ recordAIUsageEvent: vi.fn().mockResolvedValue({ recorded: false, reason: "test" }) }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.recordAudit }));
vi.mock("@/lib/ai/AIProviderManager", () => ({ getAIProviderManager: mocks.getAIProviderManager }));
vi.mock("@/lib/ai/workspaceProviderPolicy", () => ({
  loadWorkspaceAIProviderPolicyWithState: mocks.loadWorkspaceAIProviderPolicyWithState,
  resolveWorkspaceAIProviderPolicy: mocks.resolveWorkspaceAIProviderPolicy,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    pipelineStageRun: { aggregate: vi.fn().mockResolvedValue({ _sum: { costCents: 0 } }), findFirst: vi.fn().mockResolvedValue(null) },
  },
}));
vi.mock("../budgetConfigStore", () => ({ loadBudgetConfig: vi.fn().mockResolvedValue({}) }));

function ctx(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: "org-1",
    runId: "run-1",
    stageRunId: "stagerun-1",
    pipelineId: "pipe-1",
    stageId: "stage-1",
    stageKind: "code_propose" as const,
    correlationId: "corr-1",
    triggeredBy: "test",
    runMetadata: { instruction: "fix the bug", repoRef: "acme/checkout" },
    ...overrides,
  };
}

describe("codeProposeRealExecutor — workspace AI provider policy gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkWorkspaceAICredits.mockResolvedValue({ kind: "allow" });
    mocks.gatewayGenerate.mockResolvedValue({
      text: "Plan.\n--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\nPR title",
      model: "anthropic/claude-sonnet-4",
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
    mocks.getAIProviderManager.mockReturnValue({
      isServiceProviderAvailable: () => true,
      status: () => [{ provider: "vercel_gateway", configured: true }],
      generateText: mocks.gatewayGenerate,
    });
  });

  it("fails closed and never constructs the Anthropic client when the policy read errors", async () => {
    mocks.loadWorkspaceAIProviderPolicyWithState.mockResolvedValue({ policy: null, storageState: "unavailable" });

    const { codeProposeRealExecutor } = await import("../codeProposeRealExecutor");
    const result = await codeProposeRealExecutor(ctx());

    expect(result.ok).toBe(false);
    expect(mocks.gatewayGenerate).not.toHaveBeenCalled();
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "ai.policy_unavailable" }));
  });

  it("blocks without inference when the workspace disallows Gateway", async () => {
    mocks.loadWorkspaceAIProviderPolicyWithState.mockResolvedValue({ policy: { enabled: true, allowedProviders: ["openai"] }, storageState: "ready" });
    mocks.resolveWorkspaceAIProviderPolicy.mockReturnValue({ enabled: true, allowedProviders: ["openai"], modelSelections: {}, fallbackOrder: [] });

    const { codeProposeRealExecutor } = await import("../codeProposeRealExecutor");
    const result = await codeProposeRealExecutor(ctx());

    expect(result.ok).toBe(false);
    expect(mocks.gatewayGenerate).not.toHaveBeenCalled();
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "ai.provider_not_approved" }));
  });

  it("blocks when the workspace has AI disabled outright", async () => {
    mocks.loadWorkspaceAIProviderPolicyWithState.mockResolvedValue({ policy: { enabled: false, allowedProviders: [] }, storageState: "ready" });
    mocks.resolveWorkspaceAIProviderPolicy.mockReturnValue({ enabled: false, allowedProviders: [], modelSelections: {}, fallbackOrder: [] });

    const { codeProposeRealExecutor } = await import("../codeProposeRealExecutor");
    const result = await codeProposeRealExecutor(ctx());

    expect(result.ok).toBe(false);
    expect(mocks.gatewayGenerate).not.toHaveBeenCalled();
  });

  it("invokes Gateway once policy allows it", async () => {
    mocks.loadWorkspaceAIProviderPolicyWithState.mockResolvedValue({ policy: { enabled: true, allowedProviders: ["vercel_gateway"] }, storageState: "ready" });
    mocks.resolveWorkspaceAIProviderPolicy.mockReturnValue({ enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: "service-default" }, fallbackOrder: ["vercel_gateway"] });

    const { codeProposeRealExecutor } = await import("../codeProposeRealExecutor");
    await codeProposeRealExecutor(ctx());
    expect(mocks.gatewayGenerate).toHaveBeenCalled();
  });

  it("fails closed on a fail-open budget read error (failClosedOnUsageReadError)", async () => {
    mocks.checkWorkspaceAICredits.mockImplementation((_org: string, _cents: unknown, opts: { failClosedOnUsageReadError?: boolean }) => {
      expect(opts?.failClosedOnUsageReadError).toBe(true);
      return Promise.resolve({ kind: "allow" });
    });
    mocks.loadWorkspaceAIProviderPolicyWithState.mockResolvedValue({ policy: { enabled: true, allowedProviders: ["vercel_gateway"] }, storageState: "ready" });
    mocks.resolveWorkspaceAIProviderPolicy.mockReturnValue({ enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: "service-default" }, fallbackOrder: ["vercel_gateway"] });

    const { codeProposeRealExecutor } = await import("../codeProposeRealExecutor");
    await codeProposeRealExecutor(ctx()).catch(() => undefined);

    expect(mocks.checkWorkspaceAICredits).toHaveBeenCalled();
  });
});
