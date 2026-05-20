/**
 * Vitest unit tests for the AI rollback narrator fallback path.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { narrateRollbackDecision } from "../aiRollbackNarrator";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

describe("aiRollbackNarrator", () => {
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

  it("Mock-only fallback includes verdict + service + reasons + 'advisory'", async () => {
    const r = await narrateRollbackDecision({
      service: "checkout-api",
      minutesSinceDeploy: 12,
      rec: {
        verdict: "recommend_rollback",
        reasons: ["p95 latency 2.0× pre-deploy", "error rate +3.5pp"],
        confidence: 0.8,
      },
    });
    expect(r.aiUsed).toBe(false);
    expect(r.paragraph).toContain("recommend rollback");
    expect(r.paragraph).toContain("checkout-api");
    expect(r.paragraph).toContain("12m");
    expect(r.paragraph).toContain("p95 latency");
    expect(r.paragraph.toLowerCase()).toContain("advisory");
  }, 60_000);

  it("handles no_rollback verdict cleanly", async () => {
    const r = await narrateRollbackDecision({
      service: "checkout-api",
      minutesSinceDeploy: 2,
      rec: { verdict: "no_rollback", reasons: ["only 2m since deploy"], confidence: 0 },
    });
    expect(r.paragraph).toContain("no rollback");
  }, 60_000);

  it("handles empty reasons list", async () => {
    const r = await narrateRollbackDecision({
      service: "x",
      minutesSinceDeploy: 30,
      rec: { verdict: "no_rollback", reasons: [], confidence: 0 },
    });
    expect(r.paragraph).toContain("no signals tripped");
  }, 60_000);
});
