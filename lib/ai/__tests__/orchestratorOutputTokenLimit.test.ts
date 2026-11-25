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
import { generateOperatorEngineOutput } from "@/lib/cloudOperator/generate";
import type { OperatorProfile } from "@/lib/cloudOperator/types";

const profile: OperatorProfile = {
  projectType: "Test service",
  hostingProvider: "AWS",
  monthlySpend: "100",
  trafficLevel: "Low",
  hasCiCd: "no",
  publicExposure: "Internal Only",
  complianceNeeds: "",
  gitProvider: "GitHub",
  primaryGoal: "Launch faster",
};

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

  it("generates an Operator plan through the real token gate without a workspace credit identity", async () => {
    const launch = { architecturePlan: "Deploy the sample service to a staging environment." };
    mocked.generateText.mockResolvedValueOnce({
      text: JSON.stringify({ launch }),
      model: "openai/gpt-4o-mini",
    });
    const result = await generateOperatorEngineOutput(profile, "free");
    expect(result.launch).toEqual(launch);
    expect(result.scores).toBeDefined();
    expect(mocked.generateText).toHaveBeenCalledExactlyOnceWith(expect.any(String), expect.objectContaining({
      maxTokens: 4096,
      only: "vercel_gateway",
    }));
    expect(mocked.generateText.mock.calls[0][1]).not.toHaveProperty("organizationId");
  });

  it.each(["", "{\"launch\":", "null", "{}", '{"launch":{"architecturePlan":" "}}'])(
    "leaves generation failed when an Operator response has no usable architecture plan (%j)",
    async text => {
      mocked.generateText.mockResolvedValueOnce({ text, model: "openai/gpt-4o-mini" });
      await expect(generateOperatorEngineOutput(profile, "free")).rejects.toThrow("cloud_operator_output_unverified");
      expect(mocked.generateText).toHaveBeenCalledTimes(1);
    },
  );

  it.each([0, -1, 4097, 1.5, Number.NaN, Number.POSITIVE_INFINITY, null])(
    "rejects invalid or over-limit caller values before provider dispatch (%s)",
    async (maxTokens) => {
      await expect(generate({ taskType: "CHAT_FAST", userPrompt: "hello", maxTokens: maxTokens as number })).rejects.toThrow(/output token limit/i);
      expect(mocked.generateText).not.toHaveBeenCalled();
    },
  );
});
