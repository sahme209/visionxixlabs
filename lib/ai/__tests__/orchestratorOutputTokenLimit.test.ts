import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  generateText: vi.fn(),
  logAIInvocation: vi.fn(),
}));

vi.mock("../AIProviderManager", () => ({
  getAIProviderManager: () => ({
    status: () => [{ provider: "vercel_gateway", configured: true, defaultModel: "spacexai/grok-4.20-multi-agent", priority: 0 }],
    generateText: mocked.generateText,
  }),
}));
vi.mock("../instrumentation", () => ({ logAIInvocation: mocked.logAIInvocation }));

import { generate } from "../orchestrator";

describe("orchestrator output-token bound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.generateText.mockResolvedValue({
      text: "bounded fixture response",
      model: "spacexai/grok-4.20-multi-agent",
      usage: { promptTokens: 12, completionTokens: 8 },
    });
    mocked.logAIInvocation.mockResolvedValue(undefined);
  });

  it("always supplies the server-owned default cap when callers omit maxTokens", async () => {
    await generate({ taskType: "CHAT_FAST", userPrompt: "hello" });
    expect(mocked.generateText).toHaveBeenCalledWith("hello", expect.objectContaining({ maxTokens: 4096 }));
  });

  it("preserves a valid smaller caller limit", async () => {
    await generate({ taskType: "CHAT_FAST", userPrompt: "hello", maxTokens: 512 });
    expect(mocked.generateText).toHaveBeenCalledWith("hello", expect.objectContaining({ maxTokens: 512 }));
  });

  it.each([0, -1, 4097, 1.5, Number.NaN, Number.POSITIVE_INFINITY, null])(
    "rejects invalid or over-limit caller values before provider dispatch (%s)",
    async (maxTokens) => {
      await expect(generate({ taskType: "CHAT_FAST", userPrompt: "hello", maxTokens: maxTokens as number })).rejects.toThrow(/output token limit/i);
      expect(mocked.generateText).not.toHaveBeenCalled();
    },
  );
});
