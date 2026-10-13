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
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.AI_GATEWAY_MODEL;
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

  it("status() reports Gateway unavailable when auth and model are missing", () => {
    const mgr = getAIProviderManager();
    const rows = mgr.status();
    expect(rows).toEqual([{ provider: "vercel_gateway", configured: false, defaultModel: "service-default", priority: 0 }]);
  });

  it("does not advertise direct or local providers", () => {
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.LM_STUDIO_BASE_URL;
    _resetAIProviderManagerForTests();

    const rows = getAIProviderManager().status();
    expect(rows.some((row) => row.provider === "ollama" || row.provider === "lm_studio" || row.provider === "openai")).toBe(false);
  });

  it("does not advertise a mock provider", () => {
    const mgr = getAIProviderManager();
    expect(mgr.status().some((r) => r.provider === "mock")).toBe(false);
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

  it("fails closed when Gateway is not configured", async () => {
    const mgr = getAIProviderManager();
    await expect(mgr.generateText("hello")).rejects.toMatchObject({ kind: "not_configured" });
  });

  it("advertises only the governed Gateway runtime", () => {
    const mgr = getAIProviderManager();
    const rows = mgr.status();
    expect(rows.map((row) => row.provider)).toEqual(["vercel_gateway"]);
  });

  it("carries the workspace allowlist and fallback order into the runtime chain", () => {
    process.env.AI_GATEWAY_API_KEY = "test-gateway-key";
    process.env.AI_GATEWAY_MODEL = "test/model";
    _resetAIProviderManagerForTests();
    const mgr = getAIProviderManager();
    const runtimeChain = (mgr as unknown as {
      chain: (opts: { allowedProviders: readonly string[]; fallbackOrder: readonly string[] }) => Array<{ name: string }>;
    }).chain({ allowedProviders: ["vercel_gateway"], fallbackOrder: ["vercel_gateway"] });

    expect(runtimeChain.map((provider) => provider.name)).toEqual(["vercel_gateway"]);
  });

  it("does not honor a direct provider request outside the workspace allowlist", () => {
    process.env.AI_GATEWAY_API_KEY = "test-gateway-key";
    process.env.AI_GATEWAY_MODEL = "test/model";
    _resetAIProviderManagerForTests();
    const mgr = getAIProviderManager();
    const runtimeChain = (mgr as unknown as {
      chain: (opts: { only: string; allowedProviders: readonly string[] }) => Array<{ name: string }>;
    }).chain({ only: "openai", allowedProviders: ["openai"] });

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
