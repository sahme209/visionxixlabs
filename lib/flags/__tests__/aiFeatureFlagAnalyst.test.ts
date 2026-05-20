/**
 * Vitest unit tests for the AI feature-flag analyst fallback path.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { analyzeFeatureFlags, type FeatureFlagSnapshot } from "../aiFeatureFlagAnalyst";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

const F = (key: string, rolloutPct: number, daysSinceFlip: number, callsPerDay: number, ownerTeam: string | null = null): FeatureFlagSnapshot =>
  ({ key, rolloutPct, daysSinceFlip, callsPerDay, ownerTeam });

describe("aiFeatureFlagAnalyst", () => {
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

  it("empty flags → empty recommendations", async () => {
    const r = await analyzeFeatureFlags([]);
    expect(r.recommendations).toEqual([]);
    expect(r.aiUsed).toBe(false);
  });

  it("100% rollout for >=30 days with traffic → promote", async () => {
    const r = await analyzeFeatureFlags([F("flag.fully_rolled", 100, 45, 1000)]);
    expect(r.recommendations[0].action).toBe("promote");
  }, 60_000);

  it("0% rollout >=30 days → retire", async () => {
    const r = await analyzeFeatureFlags([F("flag.dead", 0, 60, 0)]);
    expect(r.recommendations[0].action).toBe("retire");
  }, 60_000);

  it("zero traffic regardless of rollout → retire", async () => {
    const r = await analyzeFeatureFlags([F("flag.no_traffic", 50, 10, 0)]);
    expect(r.recommendations[0].action).toBe("retire");
  }, 60_000);

  it("mid-rollout for >=14 days → investigate", async () => {
    const r = await analyzeFeatureFlags([F("flag.midflight", 50, 20, 100)]);
    expect(r.recommendations[0].action).toBe("investigate");
  }, 60_000);

  it("recent rollout → leave_alone", async () => {
    const r = await analyzeFeatureFlags([F("flag.new", 25, 5, 100)]);
    expect(r.recommendations[0].action).toBe("leave_alone");
  }, 60_000);
});
