/**
 * Vitest unit tests for the AI postmortem drafter fallback path.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { draftPostmortem, type PostmortemSeed } from "../aiPostmortemDrafter";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

const SEED: PostmortemSeed = {
  title: "checkout-api p95 spike",
  startedAtIso: "2026-05-20T14:00:00.000Z",
  resolvedAtIso: "2026-05-20T14:42:00.000Z",
  impactSummary: "1.4% of checkout requests saw >2s latency for 42 minutes.",
  timeline: [
    { tsIso: "2026-05-20T14:00:00.000Z", summary: "deploy lands" },
    { tsIso: "2026-05-20T14:05:00.000Z", summary: "alerts fire" },
    { tsIso: "2026-05-20T14:42:00.000Z", summary: "rollback completes" },
  ],
  rootCauseHint: "regression in CheckoutPipeline cache TTL",
  affectedServices: ["checkout-api"],
};

describe("aiPostmortemDrafter", () => {
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

  it("Mock-only fallback emits structured markdown sections", async () => {
    const r = await draftPostmortem(SEED);
    expect(r.aiUsed).toBe(false);
    expect(r.body).toContain("# checkout-api p95 spike");
    expect(r.body).toContain("## Summary");
    expect(r.body).toContain("## Timeline");
    expect(r.body).toContain("## Impact");
    expect(r.body).toContain("## Root cause");
    expect(r.body).toContain("## Action items");
  }, 60_000);

  it("timeline bullets render in fallback", async () => {
    const r = await draftPostmortem(SEED);
    expect(r.body).toContain("deploy lands");
    expect(r.body).toContain("rollback completes");
  }, 60_000);

  it("falls back to placeholder copy when seed is sparse", async () => {
    const r = await draftPostmortem({
      title: "x", startedAtIso: "2026-05-20T00:00:00.000Z",
      resolvedAtIso: "2026-05-20T00:10:00.000Z",
      impactSummary: "", timeline: [], affectedServices: [],
    });
    expect(r.body).toContain("(impact summary not supplied)");
    expect(r.body).toContain("(no events recorded)");
  }, 60_000);

  it("rootCauseHint shows up when provided", async () => {
    const r = await draftPostmortem(SEED);
    expect(r.body).toContain("CheckoutPipeline cache TTL");
  }, 60_000);

  it("never throws on empty title", async () => {
    const r = await draftPostmortem({ ...SEED, title: "" });
    expect(typeof r.body).toBe("string");
    expect(r.body.length).toBeGreaterThan(0);
  }, 60_000);
});
