/**
 * Vitest unit tests for the AIProviderManager surface that doesn't
 * require real network — env detection, status table shape, and Mock
 * fallback when nothing else is configured.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { _resetAIProviderManagerForTests, getAIProviderManager } from "../AIProviderManager";
import { PROVIDER_PRIORITY } from "../AIModelRegistry";
import type { AIStreamChunk } from "../AIProvider";

describe("AIProviderManager", () => {
  beforeEach(() => {
    // Wipe every relevant env var so we test the "nothing configured" path.
    delete process.env.GITHUB_TOKEN;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.HUGGINGFACE_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    // Force local providers to a unreachable URL so they remain configured
    // (they don't require keys) but fail when called — Mock catches that.
    process.env.OLLAMA_BASE_URL = "http://localhost:11434";
    process.env.LM_STUDIO_BASE_URL = "http://localhost:1234";
    _resetAIProviderManagerForTests();
  });

  it("status() returns one row per provider in PROVIDER_PRIORITY order", () => {
    const mgr = getAIProviderManager();
    const rows = mgr.status();
    expect(rows.length).toBe(PROVIDER_PRIORITY.length);
    expect(rows.map((r) => r.provider)).toEqual(PROVIDER_PRIORITY);
  });

  it("status() reports configured=false for providers missing their key", () => {
    const mgr = getAIProviderManager();
    const rows = mgr.status();
    const github = rows.find((r) => r.provider === "github_models")!;
    const openai = rows.find((r) => r.provider === "openai")!;
    const anthropic = rows.find((r) => r.provider === "anthropic")!;
    const groq = rows.find((r) => r.provider === "groq")!;
    const xai = rows.find((r) => r.provider === "xai")!;
    expect(openai.configured).toBe(false);
    expect(anthropic.configured).toBe(false);
    expect(github.configured).toBe(false);
    expect(groq.configured).toBe(false);
    expect(xai.configured).toBe(false);
  });

  it("Mock is always configured", () => {
    const mgr = getAIProviderManager();
    expect(mgr.status().find((r) => r.provider === "mock")!.configured).toBe(true);
  });

  it("envSnapshot returns booleans, never the secret value", () => {
    process.env.GITHUB_TOKEN = "ghp_super_secret_token_value";
    process.env.OPENAI_API_KEY = "openai_super_secret_value";
    process.env.ANTHROPIC_API_KEY = "anthropic_super_secret_value";
    process.env.XAI_API_KEY = "xai_super_secret_value";
    _resetAIProviderManagerForTests();
    const snap = getAIProviderManager().envSnapshot();
    expect(snap.GITHUB_TOKEN).toBe(true);
    expect(snap.OPENAI_API_KEY).toBe(true);
    expect(snap.ANTHROPIC_API_KEY).toBe(true);
    expect(snap.XAI_API_KEY).toBe(true);
    // No raw secret anywhere in the snapshot
    expect(JSON.stringify(snap)).not.toContain("ghp_super_secret_token_value");
    expect(JSON.stringify(snap)).not.toContain("openai_super_secret_value");
    expect(JSON.stringify(snap)).not.toContain("anthropic_super_secret_value");
    expect(JSON.stringify(snap)).not.toContain("xai_super_secret_value");
  });

  it("generateText falls back to Mock when nothing real is configured", async () => {
    const mgr = getAIProviderManager();
    const r = await mgr.generateText("hello");
    // With no real providers configured AND local Ollama/LMStudio unreachable,
    // we land on the Mock — which always answers.
    expect(["mock"]).toContain(r.provider);
    expect(r.text).toContain("[MOCK");
  }, 60_000);

  it("redacts a secret-shaped prompt before it ever reaches a provider", async () => {
    // Mock's own generateText echoes a slice of the prompt it actually
    // received, so this proves the redaction happened upstream of
    // every provider dispatch, not just at the logging layer.
    const mgr = getAIProviderManager();
    const r = await mgr.generateText("my key is AKIAABCDEFGHIJKLMNOP please use it");
    expect(r.text).not.toContain("AKIAABCDEFGHIJKLMNOP");
    expect(r.text).toContain("[REDACTED-AWS-ACCESS-KEY]");
  }, 60_000);

  it("priority list places governed cloud providers first and mock last", () => {
    const mgr = getAIProviderManager();
    const rows = mgr.status();
    expect(rows[0].provider).toBe("openai");
    expect(rows[rows.length - 1].provider).toBe("mock");
  });

  it("carries the workspace allowlist and fallback order into the runtime chain", () => {
    process.env.GITHUB_TOKEN = "test-github-token";
    process.env.GROQ_API_KEY = "test-groq-key";
    _resetAIProviderManagerForTests();
    const mgr = getAIProviderManager();
    const runtimeChain = (mgr as unknown as {
      chain: (opts: { allowedProviders: readonly string[]; fallbackOrder: readonly string[] }) => Array<{ name: string }>;
    }).chain({ allowedProviders: ["groq"], fallbackOrder: ["groq"] });

    expect(runtimeChain.map((provider) => provider.name)).toEqual(["groq"]);
  });

  it("does not honor a direct provider request outside the workspace allowlist", () => {
    process.env.GITHUB_TOKEN = "test-github-token";
    _resetAIProviderManagerForTests();
    const mgr = getAIProviderManager();
    const runtimeChain = (mgr as unknown as {
      chain: (opts: { only: string; allowedProviders: readonly string[] }) => Array<{ name: string }>;
    }).chain({ only: "github_models", allowedProviders: ["groq"] });

    expect(runtimeChain.map((provider) => provider.name)).toEqual([]);
  });

  it("ends a governed stream without a simulated answer when no provider is allowed", async () => {
    const mgr = getAIProviderManager();
    const chunks: AIStreamChunk[] = [];
    for await (const chunk of mgr.streamText("hello", { allowedProviders: [], fallbackOrder: [] })) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual([{ text: "", done: true, finishReason: "error" }]);
  });
});
