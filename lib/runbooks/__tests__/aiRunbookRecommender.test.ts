/**
 * Vitest unit tests for the AI runbook recommender fallback.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { recommendRunbook, type RunbookCandidate } from "../aiRunbookRecommender";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

const CATALOG: RunbookCandidate[] = [
  { id: "rb-rollback", title: "Rollback last deploy", category: "incident_response", description: "Stages a one-version rollback (operator must approve)." },
  { id: "rb-pab",      title: "Tighten S3 PAB",      category: "remediation",         description: "Sets Public Access Block on the affected bucket." },
];

describe("aiRunbookRecommender", () => {
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

  it("Mock-only fall-through picks the first catalog entry", async () => {
    const r = await recommendRunbook({ problem: "p95 latency spike", catalog: CATALOG });
    expect(r.aiUsed).toBe(false);
    expect(r.bestId).toBe("rb-rollback");
  }, 60_000);

  it("returns empty bestId for an empty catalog", async () => {
    const r = await recommendRunbook({ problem: "x", catalog: [] });
    expect(r.aiUsed).toBe(false);
    expect(r.bestId).toBe("");
  });

  it("rationale is never empty", async () => {
    const r = await recommendRunbook({ problem: "x", catalog: CATALOG });
    expect(r.rationale.length).toBeGreaterThan(0);
  }, 60_000);
});
