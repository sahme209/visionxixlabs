/**
 * Vitest unit tests for the AI root-cause suggester.
 *
 * Mock-only fall-through must yield the deterministic 3-candidate
 * fallback ranked by confidence and mentioning the service name.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { suggestRootCauses, type IncidentSeed } from "../aiRootCauseSuggester";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

const SEED: IncidentSeed = {
  incidentLabel: "p95 latency spike in checkout",
  service: "checkout-api",
  observedAt: "2026-05-20T14:00:00.000Z",
  telemetryHints: [
    "p95 latency 1200ms vs baseline 250ms",
    "deploy 14:00 UTC",
    "downstream payments-api saw 5xx burst",
  ],
};

describe("aiRootCauseSuggester", () => {
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

  it("Mock-only fall-through returns 3 deterministic candidates", async () => {
    const r = await suggestRootCauses(SEED);
    expect(r.aiUsed).toBe(false);
    expect(r.candidates.length).toBe(3);
  }, 60_000);

  it("fallback candidates mention the service name", async () => {
    const r = await suggestRootCauses(SEED);
    for (const c of r.candidates) expect(c.cause).toContain("checkout-api");
  }, 60_000);

  it("each candidate has cause + mitigation + confidence in [0,1]", async () => {
    const r = await suggestRootCauses(SEED);
    for (const c of r.candidates) {
      expect(c.cause.length).toBeGreaterThan(0);
      expect(c.suggestedMitigation.length).toBeGreaterThan(0);
      expect(c.confidence).toBeGreaterThanOrEqual(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
    }
  }, 60_000);

  it("mitigation language is advisory (never claims auto-execution)", async () => {
    const r = await suggestRootCauses(SEED);
    for (const c of r.candidates) {
      expect(c.suggestedMitigation.toLowerCase()).toMatch(/advisory|review|stage|consider/);
    }
  }, 60_000);
});
