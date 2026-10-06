/**
 * Vitest unit tests for the AI workflow translator.
 *
 * With only Mock available, the translator must return draft=null
 * (Mock can't produce a valid workflow) and a typed rejectionReason.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { translateWorkflowIntent } from "../aiWorkflowTranslator";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

// This engine now resolves the workspace's AI provider policy and
// budget before calling the AI manager (previously called it with no
// workspace scoping at all). Mock both at the module boundary so this
// test exercises the translator's own logic deterministically, instead
// of depending on real Prisma state for a workspace that doesn't exist.
const TEST_ORG_ID = "org_test_workflow_translator";

// Resolve to "no allowed providers" — this test's whole premise is the
// no-real-provider-available path. Passing through the env-derived
// serviceEnabled list here would make the translator pass an explicit
// allowedProviders array to the AI manager, which (unlike an absent
// allowedProviders) excludes the mock provider from the fallback chain
// entirely — turning an unreachable Ollama/LM Studio call into a thrown
// error instead of the deterministic mock response this test expects.
vi.mock("@/lib/ai/workspaceProviderPolicy", () => ({
  loadWorkspaceAIProviderPolicyWithState: vi.fn(async () => ({ policy: null, storageState: "ready" })),
  resolveWorkspaceAIProviderPolicy: vi.fn(() => ({
    enabled: true,
    allowedProviders: [],
    modelSelections: {},
    fallbackOrder: [],
  })),
}));
vi.mock("@/lib/billing/checkWorkspaceAICredits", () => ({
  checkWorkspaceAICredits: vi.fn(async () => ({ kind: "allow", reason: null, threshold: "below_70", remainingCents: 100_000, projectedRatio: 0 })),
}));

describe("aiWorkflowTranslator", () => {
  beforeEach(() => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.HUGGINGFACE_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    process.env.OLLAMA_BASE_URL = "http://127.0.0.1:1";
    process.env.LM_STUDIO_BASE_URL = "http://127.0.0.1:2";
    _resetAIProviderManagerForTests();
  });

  it("rejects empty intent immediately", async () => {
    const r = await translateWorkflowIntent("", TEST_ORG_ID);
    expect(r.draft).toBeNull();
    expect(r.aiUsed).toBe(false);
    expect(r.rejectionReason).toBe("empty_intent");
  });

  it("rejects whitespace-only intent", async () => {
    const r = await translateWorkflowIntent("   \n  ", TEST_ORG_ID);
    expect(r.draft).toBeNull();
    expect(r.rejectionReason).toBe("empty_intent");
  });

  it("falls back to draft=null when only Mock is available", async () => {
    const r = await translateWorkflowIntent("when an S3 bucket goes public, page security", TEST_ORG_ID);
    expect(r.draft).toBeNull();
    expect(r.aiUsed).toBe(false);
    expect(r.rejectionReason).toBe("ai_unavailable_or_mock");
  }, 60_000);
});
