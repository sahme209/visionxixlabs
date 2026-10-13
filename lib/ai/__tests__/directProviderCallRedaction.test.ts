import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(async () => ({
    text: "ok",
    provider: "vercel_gateway",
    model: "anthropic/claude-sonnet-4",
    latencyMs: 1,
    finishReason: "stop",
    usage: { promptTokens: 4, completionTokens: 2, totalTokens: 6 },
  })),
}));

vi.mock("../AIProviderManager", () => ({
  getAIProviderManager: () => ({ generateText: mocks.generateText }),
}));

import { callProvider } from "../directProviderCall";

describe("callProvider — Gateway-only compatibility", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["anthropic", "openai"] as const)("routes legacy %s hints through Vercel Gateway", async (legacyProvider) => {
    const result = await callProvider(legacyProvider, "analyze this repository", { maxTokens: 100, temperature: 0.2 });
    expect(mocks.generateText).toHaveBeenCalledWith("analyze this repository", {
      maxTokens: 100,
      temperature: 0.2,
      only: "vercel_gateway",
    });
    expect(result.model).toBe("anthropic/claude-sonnet-4");
  });
});
