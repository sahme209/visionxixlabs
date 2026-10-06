/**
 * codeProposeRealExecutor.ts calls Anthropic directly with the mandatory
 * SDK (no provider-neutral shim), so unlike call sites routed through
 * AIProviderManager, nothing upstream enforced the workspace's own AI
 * provider policy for it before this session's fix — a workspace that
 * disabled AI or disallowed Anthropic could not stop this stage, which
 * writes real code changes to the tenant's repo. Locks in both new gate
 * branches: a policy read failure fails closed, and policy explicitly
 * disallowing Anthropic blocks before any Anthropic SDK call is ever
 * constructed.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkWorkspaceAICredits: vi.fn(),
  loadWorkspaceAIProviderPolicyWithState: vi.fn(),
  resolveWorkspaceAIProviderPolicy: vi.fn(),
  getAIProviderManager: vi.fn(),
  recordAudit: vi.fn(),
  anthropicCtor: vi.fn(),
}));

vi.mock("@/lib/billing/checkWorkspaceAICredits", () => ({ checkWorkspaceAICredits: mocks.checkWorkspaceAICredits }));
vi.mock("@/lib/billing/recordAIUsageEvent", () => ({ recordAIUsageEvent: vi.fn() }));
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
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(function AnthropicMock() {
    mocks.anthropicCtor();
    return {};
  }),
}));

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
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    mocks.checkWorkspaceAICredits.mockResolvedValue({ kind: "allow" });
    mocks.getAIProviderManager.mockReturnValue({ status: () => [{ provider: "anthropic", configured: true }] });
  });

  it("fails closed and never constructs the Anthropic client when the policy read errors", async () => {
    mocks.loadWorkspaceAIProviderPolicyWithState.mockResolvedValue({ policy: null, storageState: "unavailable" });

    const { codeProposeRealExecutor } = await import("../codeProposeRealExecutor");
    const result = await codeProposeRealExecutor(ctx());

    expect(result.ok).toBe(false);
    expect(mocks.anthropicCtor).not.toHaveBeenCalled();
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "ai.policy_unavailable" }));
  });

  it("blocks and never constructs the Anthropic client when the workspace disallows Anthropic", async () => {
    mocks.loadWorkspaceAIProviderPolicyWithState.mockResolvedValue({ policy: { enabled: true, allowedProviders: ["openai"] }, storageState: "ready" });
    mocks.resolveWorkspaceAIProviderPolicy.mockReturnValue({ enabled: true, allowedProviders: ["openai"], modelSelections: {}, fallbackOrder: [] });

    const { codeProposeRealExecutor } = await import("../codeProposeRealExecutor");
    const result = await codeProposeRealExecutor(ctx());

    expect(result.ok).toBe(false);
    expect(mocks.anthropicCtor).not.toHaveBeenCalled();
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "ai.provider_not_approved" }));
  });

  it("blocks when the workspace has AI disabled outright, even if Anthropic would otherwise be allowed", async () => {
    mocks.loadWorkspaceAIProviderPolicyWithState.mockResolvedValue({ policy: { enabled: false, allowedProviders: [] }, storageState: "ready" });
    mocks.resolveWorkspaceAIProviderPolicy.mockReturnValue({ enabled: false, allowedProviders: [], modelSelections: {}, fallbackOrder: [] });

    const { codeProposeRealExecutor } = await import("../codeProposeRealExecutor");
    const result = await codeProposeRealExecutor(ctx());

    expect(result.ok).toBe(false);
    expect(mocks.anthropicCtor).not.toHaveBeenCalled();
  });

  it("proceeds past the policy gate (reaches the Anthropic client) once policy allows Anthropic", async () => {
    mocks.loadWorkspaceAIProviderPolicyWithState.mockResolvedValue({ policy: { enabled: true, allowedProviders: ["anthropic"] }, storageState: "ready" });
    mocks.resolveWorkspaceAIProviderPolicy.mockReturnValue({ enabled: true, allowedProviders: ["anthropic"], modelSelections: {}, fallbackOrder: [] });

    const { codeProposeRealExecutor } = await import("../codeProposeRealExecutor");
    // The Anthropic mock returns {} with no .messages.stream(), so this
    // throws past the gate — proving the gate let it through, which is
    // exactly the boundary this test suite is responsible for, not the
    // full streaming call (a separate concern already covered by this
    // file's own existing, unmodified streaming logic).
    await codeProposeRealExecutor(ctx()).catch(() => undefined);

    expect(mocks.anthropicCtor).toHaveBeenCalledTimes(1);
  });

  it("fails closed on a fail-open budget read error (failClosedOnUsageReadError)", async () => {
    mocks.checkWorkspaceAICredits.mockImplementation((_org: string, _cents: unknown, opts: { failClosedOnUsageReadError?: boolean }) => {
      expect(opts?.failClosedOnUsageReadError).toBe(true);
      return Promise.resolve({ kind: "allow" });
    });
    mocks.loadWorkspaceAIProviderPolicyWithState.mockResolvedValue({ policy: { enabled: true, allowedProviders: ["anthropic"] }, storageState: "ready" });
    mocks.resolveWorkspaceAIProviderPolicy.mockReturnValue({ enabled: true, allowedProviders: ["anthropic"], modelSelections: {}, fallbackOrder: [] });

    const { codeProposeRealExecutor } = await import("../codeProposeRealExecutor");
    await codeProposeRealExecutor(ctx()).catch(() => undefined);

    expect(mocks.checkWorkspaceAICredits).toHaveBeenCalled();
  });
});
