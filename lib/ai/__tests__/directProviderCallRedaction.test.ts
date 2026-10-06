/**
 * callProvider() bypasses AIProviderManager entirely (per-engineer
 * direct routing — see the module's own docstring), so it needs its
 * own redaction pass before a prompt leaves the service. Locks in that
 * a secret-shaped prompt never reaches either the anthropic or openai
 * provider call unredacted.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateTextOptions } from "../providers/types";

const mocks = vi.hoisted(() => ({
  anthropicGenerate: vi.fn(async (_args: GenerateTextOptions) => ({ text: "ok", usage: null })),
  openaiGenerate: vi.fn(async (_args: GenerateTextOptions) => ({ text: "ok", usage: null })),
}));

vi.mock("../providers/anthropic", () => ({ generateText: mocks.anthropicGenerate }));
vi.mock("../providers/openai", () => ({ generateText: mocks.openaiGenerate }));

import { callProvider } from "../directProviderCall";

describe("callProvider — redaction before dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const SECRET_PROMPT = "my key is AKIAABCDEFGHIJKLMNOP please use it";

  it("redacts before calling the anthropic provider", async () => {
    await callProvider("anthropic", SECRET_PROMPT, { maxTokens: 100, temperature: 0.2 });
    expect(mocks.anthropicGenerate).toHaveBeenCalledTimes(1);
    const sentPrompt = mocks.anthropicGenerate.mock.calls[0][0].prompt;
    expect(sentPrompt).not.toContain("AKIAABCDEFGHIJKLMNOP");
    expect(sentPrompt).toContain("[REDACTED-AWS-ACCESS-KEY]");
  });

  it("redacts before calling the openai provider", async () => {
    await callProvider("openai", SECRET_PROMPT, { maxTokens: 100, temperature: 0.2 });
    expect(mocks.openaiGenerate).toHaveBeenCalledTimes(1);
    const sentPrompt = mocks.openaiGenerate.mock.calls[0][0].prompt;
    expect(sentPrompt).not.toContain("AKIAABCDEFGHIJKLMNOP");
    expect(sentPrompt).toContain("[REDACTED-AWS-ACCESS-KEY]");
  });
});
