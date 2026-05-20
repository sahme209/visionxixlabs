/**
 * Vitest unit tests for the tenant insights synthesizer fallback path.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { synthesizeInsights, type InsightsSeed } from "../tenantInsightsSynthesizer";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

const SEED: InsightsSeed = {
  tenantId: "tenant-42",
  windowDays: 7,
  proposalsDecided: 10,
  proposalsApproved: 6,
  proposalsApplied: 4,
  proposalsRejected: 4,
  autonomyCycles: 120,
  outboundSends: 50,
  outboundFailures: 3,
  dissentCount: 5,
  topAuthorAgent: "improver",
};

describe("tenantInsightsSynthesizer", () => {
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
    const r = await synthesizeInsights(SEED);
    expect(r.aiUsed).toBe(false);
    expect(r.paragraph).toContain("7 day");
    expect(r.paragraph).toContain("10 proposal");
    expect(r.paragraph).toContain("6 approved");
    expect(r.paragraph).toContain("4 applied");
    expect(r.paragraph).toContain("4 rejected");
    expect(r.paragraph).toContain("120 autonomy");
    expect(r.paragraph).toContain("5 council dissenter");
  }, 60_000);

  it("mentions topAuthorAgent when present", async () => {
    const r = await synthesizeInsights(SEED);
    expect(r.paragraph).toContain("improver");
  }, 60_000);

  it("omits topAuthorAgent line when null", async () => {
    const r = await synthesizeInsights({ ...SEED, topAuthorAgent: null });
    expect(r.paragraph).not.toContain("Most active improver");
  }, 60_000);

  it("renders outbound ratio correctly when sends > 0", async () => {
    const r = await synthesizeInsights(SEED);
    expect(r.paragraph).toContain("47/50 sends ok");
  }, 60_000);

  it("uses 'no outbound sends' wording when sends == 0", async () => {
    const r = await synthesizeInsights({ ...SEED, outboundSends: 0, outboundFailures: 0 });
    expect(r.paragraph).toContain("no outbound sends");
  }, 60_000);
});
