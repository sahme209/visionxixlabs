/**
 * Vitest unit tests for the AI risk classifier (deterministic fallback).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { classifyRisk } from "../aiRiskClassifier";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

describe("aiRiskClassifier", () => {
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

  it("falls back to deterministic severity when only Mock is available", async () => {
    const r = await classifyRisk({
      resourceLabel: "S3 bucket axiom-public",
      controlLabel: "S3 PAB block-public-acls",
      evidenceSnippet: "Bucket ACL grants READ to AllUsers.",
    });
    expect(r.aiUsed).toBe(false);
    expect(r.severity).toBe("high");
    expect(r.rootCause).toContain("block-public-acls");
  }, 60_000);

  it("upgrades to critical when evidence mentions 0.0.0.0/0", async () => {
    const r = await classifyRisk({
      resourceLabel: "Security group sg-123",
      controlLabel: "Ingress rule audit",
      evidenceSnippet: "Open ingress 22 from 0.0.0.0/0",
    });
    expect(r.severity).toBe("critical");
  }, 60_000);

  it("medium for encryption keywords in control label", async () => {
    const r = await classifyRisk({
      resourceLabel: "RDS instance prod-1",
      controlLabel: "RDS encryption-at-rest required",
      evidenceSnippet: "Storage encryption disabled.",
    });
    expect(r.severity).toBe("medium");
  }, 60_000);

  it("low for log/audit keywords", async () => {
    const r = await classifyRisk({
      resourceLabel: "Account 12345",
      controlLabel: "CloudTrail log retention",
      evidenceSnippet: "Trail retention set below baseline.",
    });
    expect(r.severity).toBe("low");
  }, 60_000);

  it("info default for unmatched controls", async () => {
    const r = await classifyRisk({
      resourceLabel: "x",
      controlLabel: "miscellaneous baseline",
      evidenceSnippet: "no notable signal",
    });
    expect(r.severity).toBe("info");
  }, 60_000);
});
