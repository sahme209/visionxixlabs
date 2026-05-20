/**
 * Vitest unit tests for the AI-powered incident summarizer.
 *
 * With no real provider keys set, the manager falls through to Mock —
 * which the summarizer must detect and treat as "AI not used", so the
 * caller gets the deterministic fallback instead of the [MOCK ...]
 * marker text.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { summarizeIncident } from "../aiIncidentSummarizer";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

describe("aiIncidentSummarizer", () => {
  beforeEach(() => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.HUGGINGFACE_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    process.env.OLLAMA_BASE_URL = "http://127.0.0.1:1";   // unreachable
    process.env.LM_STUDIO_BASE_URL = "http://127.0.0.1:2"; // unreachable
    _resetAIProviderManagerForTests();
  });

  it("falls back to deterministic clip when only Mock is available", async () => {
    const r = await summarizeIncident({ headline: "Approval packet ready", severity: "high" });
    expect(r.aiUsed).toBe(false);
    expect(r.provider).toBeNull();
    expect(r.summary).toContain("[HIGH]");
    expect(r.summary).toContain("Approval packet ready");
  }, 60_000);

  it("prefixes severity tag from input", async () => {
    const r = await summarizeIncident({ headline: "Drift detected", severity: "critical" });
    expect(r.summary.startsWith("[CRITICAL]")).toBe(true);
  }, 60_000);

  it("clips very long detail to MAX_OUT chars", async () => {
    const detail = "x".repeat(1000);
    const r = await summarizeIncident({ headline: "Long event", detail });
    expect(r.summary.length).toBeLessThanOrEqual(250);
    expect(r.summary.endsWith("...")).toBe(true);
  }, 60_000);

  it("never throws even with empty headline", async () => {
    const r = await summarizeIncident({ headline: "" });
    expect(typeof r.summary).toBe("string");
    expect(r.aiUsed).toBe(false);
  }, 60_000);
});
