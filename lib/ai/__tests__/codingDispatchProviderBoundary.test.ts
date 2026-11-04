import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AIRequestOptions } from "../AIProvider";
const m = vi.hoisted(() => ({ sdk: vi.fn(), stream: vi.fn(), messages: vi.fn() }));
vi.mock("ai", () => ({ generateText: m.sdk, streamText: m.stream }));
vi.mock("../providers/sonnet55Messages", () => ({ sendSmallSonnet55Messages: m.messages }));
import { VercelGatewayProvider } from "../providers/VercelGatewayProvider";
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("AI_GATEWAY_API_KEY", "synthetic"); });
it.each([
  { smallAgentDispatch: {} },
  { smallAgent55Dispatch: {} },
  { smallAgentDispatch: {}, smallAgent55Dispatch: {} },
])("rejects mixed coding/extraction handles before selecting any transport: %j", async extraction => {
  const options = { model: "anthropic/claude-sonnet-5", maxTokens: 4096, temperature: 0.2, codingDispatch: {}, ...extraction } as unknown as AIRequestOptions;
  await expect(new VercelGatewayProvider("anthropic/claude-sonnet-5").generateTextOnce("synthetic", options)).rejects.toThrow("coding dispatch cannot be mixed with extraction dispatch");
  expect(m.sdk).not.toHaveBeenCalled(); expect(m.stream).not.toHaveBeenCalled(); expect(m.messages).not.toHaveBeenCalled();
});
it("does not accept coding dispatch on streaming", async () => {
  const options = { codingDispatch: {} } as unknown as AIRequestOptions;
  await expect(new VercelGatewayProvider("anthropic/claude-sonnet-5").streamTextOnce("synthetic", options).next()).rejects.toThrow("coding dispatch does not authorize streaming");
  expect(m.sdk).not.toHaveBeenCalled(); expect(m.stream).not.toHaveBeenCalled(); expect(m.messages).not.toHaveBeenCalled();
});
