/**
 * Vitest unit tests for the AI help re-ranker fallback path.
 *
 * With only Mock available, reranker MUST fall back to the first
 * deterministic candidate rather than echoing Mock's stub data.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { rerankHelpCandidates, type RerankCandidate } from "../aiHelpReranker";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

const CANDS: RerankCandidate[] = [
  { id: "h-1", title: "Approve a runbook", category: "runbooks", snippet: "How to approve a recipe." },
  { id: "h-2", title: "Cron health basics", category: "cron",     snippet: "What the cron health page shows." },
];

describe("aiHelpReranker", () => {
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

  it("falls back to first candidate when only Mock is available", async () => {
    const r = await rerankHelpCandidates({ query: "How do I approve?", candidates: CANDS });
    expect(r.aiUsed).toBe(false);
    expect(r.bestId).toBe("h-1");
    expect(r.provider).toBeNull();
  }, 60_000);

  it("returns empty fallback shape for empty candidate list", async () => {
    const r = await rerankHelpCandidates({ query: "anything", candidates: [] });
    expect(r.aiUsed).toBe(false);
    expect(r.bestId).toBe("");
    expect(r.rationale.toLowerCase()).toContain("no candidates");
  });

  it("returns a non-empty rationale even on fallback", async () => {
    const r = await rerankHelpCandidates({ query: "anything", candidates: CANDS });
    expect(r.rationale.length).toBeGreaterThan(0);
  }, 60_000);
});
