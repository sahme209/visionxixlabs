/**
 * Vitest unit tests for the AI explain-this module fallback path.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { explainSubject } from "../aiExplainer";
import { _resetAIProviderManagerForTests } from "../AIProviderManager";

describe("aiExplainer", () => {
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

  it("falls back to template when only Mock is available", async () => {
    const r = await explainSubject({ kind: "security_finding", label: "S3 PAB drift" });
    expect(r.aiUsed).toBe(false);
    expect(r.text).toContain("security_finding");
    expect(r.text).toContain("S3 PAB drift");
  }, 60_000);

  it("includes context snippet in the fallback", async () => {
    const r = await explainSubject({
      kind: "alert", label: "p95 latency spike",
      context: "Service checkout-api exceeded p95 SLO at 14:02 UTC.",
    });
    expect(r.text).toContain("checkout-api");
  }, 60_000);

  it("tags audience in the fallback", async () => {
    const r = await explainSubject({ kind: "metric", label: "throughput", audience: "executive" });
    expect(r.text).toContain("executive");
  }, 60_000);
});
