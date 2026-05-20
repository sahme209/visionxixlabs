/**
 * Vitest unit tests for the AI PR-description writer fallback path.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { writePrDescription } from "../aiPrDescriptionWriter";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

describe("aiPrDescriptionWriter", () => {
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

  it("Mock-only fall-through emits a structured markdown body", async () => {
    const r = await writePrDescription({
      title: "feat: add insights dashboard",
      commits: [
        { sha: "abc1234", subject: "Add /dashboard/tenant-insights" },
        { sha: "def5678", subject: "Wire AI synthesizer fallback" },
      ],
    });
    expect(r.aiUsed).toBe(false);
    expect(r.body).toContain("## Summary");
    expect(r.body).toContain("## Test plan");
    expect(r.body).toContain("## Risk");
    expect(r.body).toContain("Add /dashboard/tenant-insights");
  }, 60_000);

  it("falls back gracefully with empty commits", async () => {
    const r = await writePrDescription({ title: "", commits: [] });
    expect(r.body).toContain("Untitled PR");
    expect(r.body).toContain("(no commits)");
  }, 60_000);

  it("includes risk notes when supplied", async () => {
    const r = await writePrDescription({
      title: "feat: thing",
      commits: [{ sha: "abc", subject: "do thing" }],
      riskNotes: ["touches IAM policy file", "CI was flaky last run"],
    });
    expect(r.body).toContain("touches IAM policy file");
    expect(r.body).toContain("CI was flaky last run");
  }, 60_000);
});
