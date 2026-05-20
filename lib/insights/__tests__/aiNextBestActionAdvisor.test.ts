/**
 * Vitest unit tests for the AI next-best-action advisor fallback.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { adviseNextActions, type NbaSeed } from "../aiNextBestActionAdvisor";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

const SEED: NbaSeed = {
  pendingProposals: 3,
  driftFindings: 2,
  sloBurningServices: 1,
  outboundFailuresLast24h: 0,
  autonomyCyclesLast24h: 24,
  dissentCountLast7d: 2,
};

describe("aiNextBestActionAdvisor", () => {
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

  it("Mock-only fall-through returns at most 3 deterministic actions", async () => {
    const r = await adviseNextActions(SEED);
    expect(r.aiUsed).toBe(false);
    expect(r.actions.length).toBeGreaterThan(0);
    expect(r.actions.length).toBeLessThanOrEqual(3);
  }, 60_000);

  it("fallback prioritizes pending proposals when present", async () => {
    const r = await adviseNextActions(SEED);
    expect(r.actions[0].title.toLowerCase()).toContain("pending");
    expect(r.actions[0].category).toBe("governance");
  }, 60_000);

  it("fallback includes a drift action when drift>0", async () => {
    const r = await adviseNextActions(SEED);
    expect(r.actions.some((a) => a.category === "reliability")).toBe(true);
  }, 60_000);

  it("fallback returns a single governance-low action when nothing is hot", async () => {
    const r = await adviseNextActions({
      pendingProposals: 0, driftFindings: 0, sloBurningServices: 0,
      outboundFailuresLast24h: 0, autonomyCyclesLast24h: 0, dissentCountLast7d: 0,
    });
    expect(r.actions.length).toBe(1);
    expect(r.actions[0].category).toBe("governance");
    expect(r.actions[0].effort).toBe("low");
  }, 60_000);

  it("every action has an allowed category + effort", async () => {
    const r = await adviseNextActions(SEED);
    const cats = ["security", "cost", "reliability", "compliance", "governance"];
    const efforts = ["low", "medium", "high"];
    for (const a of r.actions) {
      expect(cats).toContain(a.category);
      expect(efforts).toContain(a.effort);
    }
  }, 60_000);
});
