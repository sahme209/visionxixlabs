/**
 * Vitest unit tests for the AI workflow translator.
 *
 * With only Mock available, the translator must return draft=null
 * (Mock can't produce a valid workflow) and a typed rejectionReason.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { translateWorkflowIntent } from "../aiWorkflowTranslator";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

describe("aiWorkflowTranslator", () => {
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

  it("rejects empty intent immediately", async () => {
    const r = await translateWorkflowIntent("");
    expect(r.draft).toBeNull();
    expect(r.aiUsed).toBe(false);
    expect(r.rejectionReason).toBe("empty_intent");
  });

  it("rejects whitespace-only intent", async () => {
    const r = await translateWorkflowIntent("   \n  ");
    expect(r.draft).toBeNull();
    expect(r.rejectionReason).toBe("empty_intent");
  });

  it("falls back to draft=null when only Mock is available", async () => {
    const r = await translateWorkflowIntent("when an S3 bucket goes public, page security");
    expect(r.draft).toBeNull();
    expect(r.aiUsed).toBe(false);
    expect(r.rejectionReason).toBe("ai_unavailable_or_mock");
  }, 60_000);
});
