/**
 * Vitest unit tests for the AI resource auto-tagger fallback path.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { suggestResourceTags, type ResourceForTagging, type TaggingPolicy } from "../aiResourceTagger";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

const POLICY: TaggingPolicy = {
  requiredKeys: ["cost_center", "env"],
  allowedValues: {
    cost_center: ["marketing", "engineering", "sales"],
    env: ["prod", "stage", "dev"],
  },
};

const R = (id: string, service: string, existing: Record<string, string> = {}): ResourceForTagging => ({
  id, service, resourceType: "aws_s3_bucket", existingTags: existing,
});

describe("aiResourceTagger", () => {
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

  it("empty resources → empty rows", async () => {
    const r = await suggestResourceTags({ resources: [], policy: POLICY });
    expect(r.rows).toEqual([]);
  });

  it("service-name match suggests value", async () => {
    const r = await suggestResourceTags({
      resources: [R("a", "engineering-build")],
      policy: POLICY,
    });
    expect(r.rows[0].suggestions.cost_center).toBe("engineering");
  }, 60_000);

  it("no match → unsureKeys lists the key", async () => {
    const r = await suggestResourceTags({
      resources: [R("a", "obscure-batch-runner")],
      policy: POLICY,
    });
    expect(r.rows[0].unsureKeys).toContain("cost_center");
  }, 60_000);

  it("existing tag keys are not re-suggested", async () => {
    const r = await suggestResourceTags({
      resources: [R("a", "engineering-build", { cost_center: "engineering" })],
      policy: POLICY,
    });
    expect(r.rows[0].suggestions.cost_center).toBeUndefined();
  }, 60_000);

  it("aiUsed=false on Mock fallback", async () => {
    const r = await suggestResourceTags({
      resources: [R("a", "engineering-build")],
      policy: POLICY,
    });
    expect(r.aiUsed).toBe(false);
  }, 60_000);
});
