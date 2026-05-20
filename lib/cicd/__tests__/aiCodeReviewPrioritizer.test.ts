/**
 * Vitest unit tests for the AI code-review prioritizer fallback path.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { prioritizeReviewFindings, type ReviewFinding } from "../aiCodeReviewPrioritizer";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

const F = (id: string, kind: ReviewFinding["kind"], detail = "", file = "src/x.ts"): ReviewFinding =>
  ({ id, kind, file, detail });

describe("aiCodeReviewPrioritizer", () => {
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

  it("empty findings → empty rows", async () => {
    const r = await prioritizeReviewFindings({ findings: [] });
    expect(r.rows).toEqual([]);
  });

  it("security finding → p0_blocking (fallback)", async () => {
    const r = await prioritizeReviewFindings({ findings: [F("f1", "security")] });
    expect(r.rows[0].priority).toBe("p0_blocking");
    expect(r.aiUsed).toBe(false);
  }, 60_000);

  it("type_error → p1_must_review", async () => {
    const r = await prioritizeReviewFindings({ findings: [F("f1", "type_error")] });
    expect(r.rows[0].priority).toBe("p1_must_review");
  }, 60_000);

  it("test_gap → p1_must_review", async () => {
    const r = await prioritizeReviewFindings({ findings: [F("f1", "test_gap")] });
    expect(r.rows[0].priority).toBe("p1_must_review");
  }, 60_000);

  it("doc_drift → p2_consider", async () => {
    const r = await prioritizeReviewFindings({ findings: [F("f1", "doc_drift")] });
    expect(r.rows[0].priority).toBe("p2_consider");
  }, 60_000);

  it("lint with 'deprecated' keyword → p2_consider", async () => {
    const r = await prioritizeReviewFindings({ findings: [F("f1", "lint", "use of deprecated API")] });
    expect(r.rows[0].priority).toBe("p2_consider");
  }, 60_000);

  it("style finding → p3_nit", async () => {
    const r = await prioritizeReviewFindings({ findings: [F("f1", "style", "trailing whitespace")] });
    expect(r.rows[0].priority).toBe("p3_nit");
  }, 60_000);

  it("every row has a non-empty rationale", async () => {
    const r = await prioritizeReviewFindings({
      findings: [F("a", "security"), F("b", "lint"), F("c", "doc_drift")],
    });
    for (const row of r.rows) expect(row.rationale.length).toBeGreaterThan(0);
  }, 60_000);
});
