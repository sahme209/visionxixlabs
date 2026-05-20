/**
 * Vitest unit tests for the AI rationale narrator's fallback path.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { narrateRationale } from "../aiRationaleNarrator";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

const SEED = {
  decisionKind: "approve_proposal",
  candidateLabel: "Tighten S3 PAB",
  supportWeight: 3,
  opposeWeight: 1,
  dissenters: ["policy_gate"],
  policyVerdict: "pass" as const,
  boundaryVerdict: "pass" as const,
};

describe("aiRationaleNarrator", () => {
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

  it("falls back to deterministic template when only Mock is available", async () => {
    const r = await narrateRationale(SEED);
    expect(r.aiUsed).toBe(false);
    expect(r.paragraph).toContain("approve_proposal");
    expect(r.paragraph).toContain("Tighten S3 PAB");
    expect(r.paragraph).toContain("support=3");
    expect(r.paragraph).toContain("oppose=1");
  }, 60_000);

  it("includes dissenters list in the fallback", async () => {
    const r = await narrateRationale(SEED);
    expect(r.paragraph).toContain("policy_gate");
  }, 60_000);

  it("omits dissenters line when none", async () => {
    const r = await narrateRationale({ ...SEED, dissenters: [] });
    expect(r.paragraph).not.toContain("Dissenters");
  }, 60_000);

  it("flags policy/boundary verdicts in the fallback", async () => {
    const r = await narrateRationale({ ...SEED, policyVerdict: "fail", boundaryVerdict: "fail" });
    expect(r.paragraph).toContain("policy blocked");
    expect(r.paragraph).toContain("boundary blocked");
  }, 60_000);
});
