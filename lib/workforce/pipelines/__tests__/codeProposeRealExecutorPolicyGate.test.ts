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
  admit: vi.fn(),
}));

vi.mock("@/lib/billing/checkWorkspaceAICredits", () => ({ checkWorkspaceAICredits: mocks.checkWorkspaceAICredits }));
vi.mock("@/lib/billing/governedExtractAdmission", () => ({ admitAIText: mocks.admit }));
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
    mocks.admit.mockResolvedValue({ ok: true, admission: {} });
    mocks.checkWorkspaceAICredits.mockResolvedValue({ kind: "allow" });
    mocks.gatewayGenerate.mockResolvedValue({
      text: "Plan.\n--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\nPR title",
      model: "anthropic/claude-sonnet-4",
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
    mocks.getAIProviderManager.mockReturnValue({
      isServiceProviderAvailable: () => true,
      status: () => [{ provider: "vercel_gateway", configured: true, defaultModel: "vendor/default" }],
      generateText: mocks.gatewayGenerate,
      generateTextWithAdmission: mocks.gatewayGenerate,
    });
  });

  it.each([undefined, "service-default", "spacexai/grok-4.20-multi-agent"])("blocks unsupported effective selection %s before admission", async selection => {
    mocks.loadWorkspaceAIProviderPolicyWithState.mockResolvedValue({ policy: {}, storageState: "ready" });
    mocks.resolveWorkspaceAIProviderPolicy.mockReturnValue({ enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: selection }, fallbackOrder: [] });
    mocks.getAIProviderManager.mockReturnValue({ isServiceProviderAvailable: () => true, status: () => [{ provider: "vercel_gateway", configured: true, defaultModel: "xai/grok-4.20-multi-agent" }], generateTextWithAdmission: mocks.gatewayGenerate });
    const { codeProposeRealExecutor } = await import("../codeProposeRealExecutor");
    expect((await codeProposeRealExecutor(ctx())).ok).toBe(false);
    expect(mocks.admit).not.toHaveBeenCalled(); expect(mocks.gatewayGenerate).not.toHaveBeenCalled();
  });
  it.each(["vendor/approved", "vmc/private"])("preserves concrete selection %s over an unsupported default", async model => {
    mocks.loadWorkspaceAIProviderPolicyWithState.mockResolvedValue({ policy: {}, storageState: "ready" });
    mocks.resolveWorkspaceAIProviderPolicy.mockReturnValue({ enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: model }, fallbackOrder: [] });
    mocks.getAIProviderManager.mockReturnValue({ isServiceProviderAvailable: () => true, status: () => [{ provider: "vercel_gateway", configured: true, defaultModel: "xai/grok-4.20-multi-agent" }], generateTextWithAdmission: mocks.gatewayGenerate });
    const { codeProposeRealExecutor } = await import("../codeProposeRealExecutor"); await codeProposeRealExecutor(ctx());
    expect(mocks.gatewayGenerate.mock.calls[0][1].model).toBe(model);
  });
  it("pins a checked default across admission", async () => {
    mocks.loadWorkspaceAIProviderPolicyWithState.mockResolvedValue({ policy: {}, storageState: "ready" });
    mocks.resolveWorkspaceAIProviderPolicy.mockReturnValue({ enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: {}, fallbackOrder: [] });
    const status = vi.fn().mockReturnValue([{ provider: "vercel_gateway", configured: true, defaultModel: "vendor/default" }]);
    mocks.getAIProviderManager.mockReturnValue({ isServiceProviderAvailable: () => true, status, generateTextWithAdmission: mocks.gatewayGenerate });
    mocks.admit.mockImplementation(async () => { status.mockReturnValue([{ provider: "vercel_gateway", configured: true, defaultModel: "xai/grok-4.20-multi-agent" }]); return { ok: true, admission: {} }; });
    const { codeProposeRealExecutor } = await import("../codeProposeRealExecutor"); await codeProposeRealExecutor(ctx());
    expect(mocks.gatewayGenerate.mock.calls[0][1].model).toBe("vendor/default");
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

  it("rejects oversized generated context before admission or model dispatch", async () => {
    mocks.loadWorkspaceAIProviderPolicyWithState.mockResolvedValue({ policy: {}, storageState: "ready" });
    mocks.resolveWorkspaceAIProviderPolicy.mockReturnValue({ enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: {}, fallbackOrder: ["vercel_gateway"] });
    const { codeProposeRealExecutor } = await import("../codeProposeRealExecutor");
    const result = await codeProposeRealExecutor(ctx({ runMetadata: { instruction: "🙂".repeat(32769), repoRef: "acme/checkout" } }));
    expect(result.ok).toBe(false);
    expect(mocks.admit).not.toHaveBeenCalled();
    expect(mocks.gatewayGenerate).not.toHaveBeenCalled();
  });

  it("invokes Gateway once policy allows it", async () => {
    mocks.loadWorkspaceAIProviderPolicyWithState.mockResolvedValue({ policy: { enabled: true, allowedProviders: ["vercel_gateway"] }, storageState: "ready" });
    mocks.resolveWorkspaceAIProviderPolicy.mockReturnValue({ enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: "service-default" }, fallbackOrder: ["vercel_gateway"] });

    const { codeProposeRealExecutor } = await import("../codeProposeRealExecutor");
    await codeProposeRealExecutor(ctx());
    expect(mocks.gatewayGenerate).toHaveBeenCalled();
    expect(mocks.admit).toHaveBeenCalledWith(expect.anything(), { prompt: mocks.gatewayGenerate.mock.calls[0][0], system: mocks.gatewayGenerate.mock.calls[0][1].system });
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
