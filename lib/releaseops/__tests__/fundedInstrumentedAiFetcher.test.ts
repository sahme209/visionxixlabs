import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  admit: vi.fn(), generate: vi.fn(), fundedGenerate: vi.fn(), record: vi.fn(), log: vi.fn(), legacyCredit: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/billing/governedExtractAdmission", () => ({ admitAIText: m.admit }));
vi.mock("@/lib/billing/recordAIUsageEvent", () => ({ recordAIUsageEvent: m.record }));
vi.mock("@/lib/billing/checkWorkspaceAICredits", () => ({ checkWorkspaceAICredits: m.legacyCredit }));
vi.mock("../aiCallLogResponder", () => ({ persistAiCallLog: m.log, lookupCircuitState: async () => "closed" }));
vi.mock("@/lib/ai/AIProviderManager", () => ({
  getAIProviderManager: () => ({
    generateText: m.generate, generateTextWithAdmission: m.fundedGenerate,
    status: () => [{ provider: "vercel_gateway", configured: true, defaultModel: "openai/gpt-4o-mini" }],
  }),
}));
vi.mock("@/lib/ai/workspaceProviderPolicy", () => ({
  loadWorkspaceAIProviderPolicyWithState: async () => ({ storageState: "ready" }),
  resolveWorkspaceAIProviderPolicy: () => ({ enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: {}, fallbackOrder: ["vercel_gateway"] }),
}));

import { makeAiNativeVoterAsync, __clearAiVoterCache } from "../aiNativeAdvisorVoter";
import { makeLiveRationaleFetcher } from "../aiRationaleFetcher";

const options = { engineName: "triage_rationale", organizationId: "workspace_1", actorUserId: "member_1" };
const prompt = "Summarize the supplied release evidence.";
const response = {
  text: "Evidence summary", provider: "vercel_gateway", model: "openai/gpt-4o-mini", gatewayGenerationId: "fixture-generation",
  usage: { promptTokens: 4, completionTokens: 2 },
};

describe("funded ReleaseOps AI", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("AXIOM_WORKSPACE_AI_USAGE_BUDGETS", "true");
    vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "");
    __clearAiVoterCache();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("reserves for the initiating actor and uses a single admitted call and one usage writer", async () => {
    const admission = Object.freeze({});
    m.admit.mockResolvedValue({ ok: true, admission });
    m.fundedGenerate.mockResolvedValue(response);
    await expect(makeLiveRationaleFetcher(options)(prompt)).resolves.toEqual({ text: response.text, modelHint: response.model });
    const scope = m.admit.mock.calls[0][0];
    expect(scope).toMatchObject({ organizationId: options.organizationId, userId: options.actorUserId, source: "releaseops" });
    expect(scope.idempotencyKey).toBe(scope.correlationId);
    expect(m.fundedGenerate).toHaveBeenCalledExactlyOnceWith(prompt, expect.objectContaining({
      organizationId: options.organizationId, correlationId: scope.correlationId, model: response.model, only: "vercel_gateway",
    }), admission);
    expect(m.generate).not.toHaveBeenCalled();
    expect(m.record).not.toHaveBeenCalled();
    expect(m.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ organizationId: options.organizationId, outcome: "ok" }));
  });

  it("does not dispatch or trip the provider breaker when the workspace budget denies a hold", async () => {
    m.admit.mockResolvedValue({ ok: false, error: "ai_workspace_budget_exceeded" });
    await expect(makeLiveRationaleFetcher(options)(prompt)).rejects.toThrow("ai_workspace_budget_exceeded");
    expect(m.fundedGenerate).not.toHaveBeenCalled();
    expect(m.generate).not.toHaveBeenCalled();
    expect(m.record).not.toHaveBeenCalled();
    expect(m.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ outcome: "short_circuit", errorMessage: "ai_workspace_budget_exceeded" }));
  });

  it("requires a prepaid reservation under public billing with the optional budget controls off", async () => {
    vi.stubEnv("AXIOM_WORKSPACE_AI_USAGE_BUDGETS", "");
    vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "axiom_public_anniversary_v1");
    m.legacyCredit.mockResolvedValue({ kind: "allow" });
    m.admit.mockResolvedValue({ ok: false, error: "ai_credit_pool_exhausted" });
    await expect(makeLiveRationaleFetcher(options)(prompt)).rejects.toThrow("ai_credit_pool_exhausted");
    expect(m.admit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      organizationId: options.organizationId, userId: options.actorUserId,
    }), { prompt });
    expect(m.legacyCredit).not.toHaveBeenCalled();
    expect(m.generate).not.toHaveBeenCalled();
    expect(m.fundedGenerate).not.toHaveBeenCalled();
    expect(m.record).not.toHaveBeenCalled();
  });

  it("falls back to the existing rule-based council vote after a budget refusal", async () => {
    m.admit.mockResolvedValue({ ok: false, error: "ai_workspace_budget_exceeded" });
    const vote = await makeAiNativeVoterAsync(options.organizationId, options.actorUserId)({
      release: { id: "release_1", status: "ready", releaseTag: "v1", commitSha: "abc", plannedWindowStart: null, plannedWindowEnd: null },
      readiness: null,
      policyViolations: { blocking: 0, warning: 0, advisory: 0 },
      pendingManualFixes: { total: 0, inProd: 0 },
      recentIncidents: { open: 0, openCritical: 0, mitigated: 0 },
      branchProtection: { snapshotsTotal: 1, weakOrNone: 0, forcePushAllowedOnMain: false },
      previousReleaseStatus: "deployed", hasEvidencePack: false, isInPlannedFreeze: false, now: new Date(),
    });
    expect(vote.rationale).toContain("ai_workspace_budget_exceeded");
    expect(m.admit).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: options.organizationId, userId: options.actorUserId,
    }), expect.anything());
    expect(m.generate).not.toHaveBeenCalled();
    expect(m.fundedGenerate).not.toHaveBeenCalled();
  });

  it.each(["true", ""])("refuses actorless workspace inference with budget flag %j", async flag => {
    vi.stubEnv("AXIOM_WORKSPACE_AI_USAGE_BUDGETS", flag);
    await expect(makeLiveRationaleFetcher({ organizationId: options.organizationId })(prompt)).rejects.toThrow("workspace_ai_billing_actor_required");
    expect(m.admit).not.toHaveBeenCalled();
    expect(m.generate).not.toHaveBeenCalled();
    expect(m.fundedGenerate).not.toHaveBeenCalled();
    expect(m.legacyCredit).not.toHaveBeenCalled();
    expect(m.record).not.toHaveBeenCalled();
    expect(m.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      outcome: "short_circuit", errorMessage: "workspace_ai_billing_actor_required",
    }));
  });

  it("leaves the existing legacy usage writer in place before rollout", async () => {
    vi.stubEnv("AXIOM_WORKSPACE_AI_USAGE_BUDGETS", "");
    m.legacyCredit.mockResolvedValue({ kind: "allow" });
    m.generate.mockResolvedValue(response);
    m.record.mockResolvedValue({ recorded: true });
    await expect(makeLiveRationaleFetcher(options)(prompt)).resolves.toMatchObject({ text: response.text });
    expect(m.admit).not.toHaveBeenCalled();
    expect(m.record).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ externalUsageId: response.gatewayGenerationId, organizationId: options.organizationId }));
  });
});
