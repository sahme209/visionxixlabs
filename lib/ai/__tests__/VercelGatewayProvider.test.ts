import { beforeEach, describe, expect, it, vi } from "vitest";

const generate = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ generateText: generate }));

import { VercelGatewayProvider } from "../providers/VercelGatewayProvider";

describe("VercelGatewayProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AI_GATEWAY_API_KEY = "gateway-test-key";
    delete process.env.VERCEL_OIDC_TOKEN;
  });

  it("fails closed without a configured model", async () => {
    const provider = new VercelGatewayProvider(undefined);
    await expect(provider.generateText("hello")).rejects.toMatchObject({ kind: "not_configured" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("routes text through the configured Gateway model with workspace attribution", async () => {
    generate.mockResolvedValue({
      text: "real response",
      finishReason: "stop",
      usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
      providerMetadata: { gateway: { generationId: "gen_test" } },
    });
    const response = await new VercelGatewayProvider("provider/model").generateText("hello", { organizationId: "org-1", correlationId: "corr-1" });
    expect(response).toMatchObject({ text: "real response", provider: "vercel_gateway", model: "provider/model", finishReason: "stop", gatewayGenerationId: "gen_test" });
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ model: "provider/model", prompt: "hello", providerOptions: { gateway: expect.objectContaining({ user: "org-1" }) } }));
  });

  it("parses a structured Gateway response", async () => {
    generate.mockResolvedValue({ text: "```json\n{\"action\":\"answer\"}\n```", finishReason: "stop", usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 }, providerMetadata: { gateway: { generationId: "gen_structured" } } });
    const response = await new VercelGatewayProvider("provider/model").extractStructuredData<{ action: string }>("decide", "{action:string}");
    expect(response.data).toEqual({ action: "answer" });
    expect(response.gatewayGenerationId).toBe("gen_structured");
  });

  it("fails closed when Gateway omits the authoritative metering id", async () => {
    generate.mockResolvedValue({ text: "response", finishReason: "stop", usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 } });
    await expect(new VercelGatewayProvider("provider/model").generateText("hello")).rejects.toMatchObject({ kind: "bad_response" });
  });
});
