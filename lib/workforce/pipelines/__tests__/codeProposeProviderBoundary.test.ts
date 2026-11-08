import { testTextPolicyRow, isTextPolicyQuery } from "@/test/textPolicyFixture";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// Only storage and the final SDK transport are synthetic. The executor,
// admission capability, manager and provider output validation are real.
const f = vi.hoisted(() => ({ sdk: vi.fn(), reserve: vi.fn(), claim: vi.fn(), write: vi.fn(), transaction: vi.fn() }));
vi.mock("ai", () => ({ generateText: f.sdk }));
vi.mock("@/lib/db", () => ({ prisma: {
  $transaction: f.transaction,
  pipelineStageRun: { findFirst: async () => null, aggregate: async () => ({ _sum: { costCents: 0 } }) },
  usageEvent: { findUnique: async () => ({ id: "usage", organizationId: "org", provider: "vercel_gateway", model: "anthropic/claude-sonnet-5", inputTokens: 5, outputTokens: 2 }) },
} }));
vi.mock("@/lib/billing/aiCreditReservation", () => ({ reserveAICredits: f.reserve, claimLegacyAICreditDispatch: f.claim }));
vi.mock("@/lib/billing/recordAIUsageEvent", () => ({ recordAIUsageEvent: f.write, recordReservedAIUsageEventV2: vi.fn() }));
vi.mock("@/lib/billing/checkWorkspaceAICredits", () => ({ checkWorkspaceAICredits: async () => ({ kind: "allow" }) }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: vi.fn() }));
vi.mock("../budgetConfigStore", () => ({ loadBudgetConfig: async () => ({}) }));
vi.mock("@/lib/ai/workspaceProviderPolicy", async original => ({ ...await original<typeof import("@/lib/ai/workspaceProviderPolicy")>(),
  loadWorkspaceAIProviderPolicyWithState: async () => ({ storageState: "ready", policy: {
    enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: "anthropic/claude-sonnet-5" }, fallbackOrder: ["vercel_gateway"],
  } }), resolveWorkspaceAIProviderPolicy: ({ stored }: { stored: unknown }) => stored,
}));
import { codeProposeRealExecutor } from "../codeProposeRealExecutor";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AI_GATEWAY_MODEL", "anthropic/claude-sonnet-5"); vi.stubEnv("AI_GATEWAY_API_KEY", "synthetic-key");
  f.reserve.mockResolvedValue({ ok: true, reused: false, reservation: { id: "hold" } });
  f.claim.mockResolvedValue(true);
  f.transaction.mockImplementation(async fn => fn({
    $queryRawUnsafe: async (sql: string) => isTextPolicyQuery(sql) ? [testTextPolicyRow] : [{ id: "hold", organizationId: "org", status: "dispatch_unknown", usageEventId: null }],
    usageEvent: { findUnique: async () => null, create: vi.fn() },
    aIUsageReservation: { updateMany: async () => ({ count: 1 }) },
  }));
  f.write.mockResolvedValue({ recorded: true, usageEventId: "usage", pendingSettlement: true });
  f.sdk.mockResolvedValue({ text: "--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new\n", finishReason: "stop", usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 }, providerMetadata: { gateway: { generationId: "synthetic_coding_generation" } } });
});
afterEach(() => vi.unstubAllEnvs());
it("reaches the real admitted provider with the existing output ceiling, one SDK attempt and one durable writer", async () => {
  const result = await codeProposeRealExecutor({ organizationId: "org", runId: "run", stageRunId: "stage_run", pipelineId: "pipeline", stageId: "stage", stageKind: "code_propose", correlationId: "correlation", triggeredBy: "member", runMetadata: { instruction: "Prepare a patch", repoRef: "owned/repo" } });
  expect(result).toMatchObject({ ok: true });
  expect(f.sdk).toHaveBeenCalledOnce();
  expect(f.sdk).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0, maxOutputTokens: 4096 }));
  expect(f.reserve).toHaveBeenCalledOnce(); expect(f.claim).toHaveBeenCalledOnce(); expect(f.write).toHaveBeenCalledOnce();
  expect(f.claim.mock.invocationCallOrder[0]).toBeLessThan(f.sdk.mock.invocationCallOrder[0]);
  expect(f.write).toHaveBeenCalledWith(expect.objectContaining({ metadata: { route: "pipeline/code_propose" } }), expect.anything());
});
