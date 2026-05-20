/**
 * Vitest unit tests for the AI release-note generator fallback path.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { generateReleaseNotes, type CommitSummary } from "../aiReleaseNoteGenerator";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

const C = (sha: string, subject: string, area?: string, prNumber?: number): CommitSummary =>
  ({ sha, subject, area: area ?? null, prNumber: prNumber ?? null });

describe("aiReleaseNoteGenerator", () => {
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

  it("empty commits → no bullets, aiUsed=false", async () => {
    const r = await generateReleaseNotes([]);
    expect(r.bullets).toEqual([]);
    expect(r.aiUsed).toBe(false);
  });

  it("Mock-only fallback returns one bullet per commit, capped at 5", async () => {
    const commits = Array.from({ length: 8 }, (_, i) => C(`sha${i}`, `commit ${i}`));
    const r = await generateReleaseNotes(commits);
    expect(r.bullets.length).toBe(5);
    expect(r.aiUsed).toBe(false);
  }, 60_000);

  it("fallback bullet includes area tag and PR ref when supplied", async () => {
    const r = await generateReleaseNotes([C("abc1234", "Add tenant insights", "insights", 42)]);
    expect(r.bullets[0]).toContain("[insights]");
    expect(r.bullets[0]).toContain("(#42)");
  }, 60_000);

  it("fallback omits area tag when not supplied", async () => {
    const r = await generateReleaseNotes([C("abc1234", "Fix typo")]);
    expect(r.bullets[0]).toBe("Fix typo");
  }, 60_000);
});
