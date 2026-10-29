import { beforeEach, describe, expect, it, vi } from "vitest";

const { generate, stream } = vi.hoisted(() => ({ generate: vi.fn(), stream: vi.fn() }));
vi.mock("ai", () => ({ generateText: generate, streamText: stream }));

import { AI_REQUEST_MAX_INPUT_BYTES } from "../inputByteBound";
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

  it("disables SDK retries only for the admitted single-attempt envelope lane", async () => {
    generate.mockResolvedValue({ text: "invalid JSON", finishReason: "stop", usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 }, providerMetadata: { gateway: { generationId: "gen_admitted" } } });
    const provider = new VercelGatewayProvider("provider/model");
    await expect(provider.generateStructuredTextOnce("decide", "{action:string}")).resolves.toMatchObject({ text: "invalid JSON", gatewayGenerationId: "gen_admitted" });
    expect(generate).toHaveBeenLastCalledWith(expect.objectContaining({ maxRetries: 0, maxOutputTokens: 4096 }));
    await provider.generateText("ordinary");
    expect(generate.mock.calls[1][0]).not.toHaveProperty("maxRetries");
  });

  it("generic single-attempt text preserves system/temperature and validated output bound with SDK retries disabled", async () => {
    generate.mockResolvedValue({ text: "answer", finishReason: "stop", usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 }, providerMetadata: { gateway: { generationId: "gen_text_once" } } });
    const provider = new VercelGatewayProvider("provider/model");
    await expect(provider.generateTextOnce("prompt", { system: "Keep it concise", temperature: 0.4, maxTokens: 20, organizationId: "org" })).resolves.toMatchObject({ text: "answer", gatewayGenerationId: "gen_text_once" });
    expect(generate).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0, maxOutputTokens: 20, temperature: 0.4, system: "Keep it concise", providerOptions: { gateway: expect.objectContaining({ user: "org" }) } }));
  });

  it("carries a server-approved concrete override to the single-attempt SDK model field", async () => {
    generate.mockResolvedValue({ text: '{"action":"respond"}', finishReason: "stop", usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 }, providerMetadata: { gateway: { generationId: "gen_selected_model" } } });
    await new VercelGatewayProvider("vendor/default").generateStructuredTextOnce("prompt", "{}", { model: "vendor/approved", maxTokens: 4096, organizationId: "org" });
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ model: "vendor/approved", maxRetries: 0, maxOutputTokens: 4096 }));
  });

  it.each([0, -1, 4097, Infinity, 1.5])("refuses an admitted output bound of %s before SDK dispatch", value => {
    expect(() => new VercelGatewayProvider("provider/model").generateStructuredTextOnce("decide", "{}", { maxTokens: value })).toThrow();
    expect(generate).not.toHaveBeenCalled();
  });

  it("fails closed when Gateway omits the authoritative metering id", async () => {
    generate.mockResolvedValue({ text: "response", finishReason: "stop", usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 } });
    await expect(new VercelGatewayProvider("provider/model").generateText("hello")).rejects.toMatchObject({ kind: "bad_response" });
  });

  it.each(["text", "summary", "stream", "structured", "classification"])("redacts composed %s instructions at the SDK boundary", async (operation) => {
    const syntheticSecret = `ghp_${"a".repeat(36)}`;
    const options = { system: `Keep safe instructions; token ${syntheticSecret}`, organizationId: "org-1" };
    generate.mockResolvedValue({ text: '{"label":"safe","score":1}', finishReason: "stop", usage: {}, providerMetadata: { gateway: { generationId: "gen_redaction" } } });
    const provider = new VercelGatewayProvider("provider/model");
    if (operation === "text") await provider.generateText("safe prompt", options);
    if (operation === "summary") await provider.summarize("safe prompt", options);
    if (operation === "stream") for await (const _ of provider.streamText("safe prompt", options)) { /* consume */ }
    if (operation === "structured") await provider.extractStructuredData("safe prompt", `{example: "${syntheticSecret}"}`, options);
    if (operation === "classification") await provider.classify("safe prompt", ["safe", syntheticSecret], options);
    const sent = generate.mock.calls[0][0];
    expect(sent.system).not.toContain(syntheticSecret);
    expect(sent.system).toContain("REDACTED");
    expect(sent.prompt).toBe("safe prompt");
    expect(sent.providerOptions.gateway.user).toBe("org-1");
    expect(options.system).toContain(syntheticSecret);
  });

  it("redacts prompt content even when a caller invokes the provider directly", async () => {
    const syntheticSecret = `ghp_${"b".repeat(36)}`;
    generate.mockResolvedValue({ text: "safe", finishReason: "stop", usage: {}, providerMetadata: { gateway: { generationId: "gen_direct" } } });
    await new VercelGatewayProvider("provider/model").generateText(`Inspect ${syntheticSecret}`);
    expect(generate.mock.calls[0][0].prompt).not.toContain(syntheticSecret);
    expect(generate.mock.calls[0][0].prompt).toContain("REDACTED");
    expect(generate.mock.calls[0][0].system).toBeUndefined();
  });
});

describe("Gateway aggregate input guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AI_GATEWAY_API_KEY = "gateway-test-key";
    generate.mockResolvedValue({ text: "ok", finishReason: "stop", usage: {}, providerMetadata: { gateway: { generationId: "gen_bound" } } });
  });
  it("accepts an exact UTF-8 aggregate limit and preserves output limits", async () => {
    await new VercelGatewayProvider("vendor/model").generateTextOnce("🙂".repeat((AI_REQUEST_MAX_INPUT_BYTES - 4) / 4), { system: "test" });
    expect(generate).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 4096 }));
  });
  it("accepts the exact aggregate bound on the streaming SDK path", async () => {
    stream.mockReturnValue({ fullStream: (async function* () { yield { type: "finish", finishReason: "stop" }; })(), totalUsage: Promise.resolve({ inputTokens: 1, outputTokens: 1 }), providerMetadata: Promise.resolve({ gateway: { generationId: "gen_stream_bound" } }) });
    for await (const _ of new VercelGatewayProvider("vendor/model").streamTextOnce("a".repeat(AI_REQUEST_MAX_INPUT_BYTES - 1), { system: "b" })) { /* consume */ }
    expect(stream).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 4096, maxRetries: 0 }));
  });
  it.each(["text", "once", "stream", "schema"])("rejects oversized %s before any SDK call", async operation => {
    const provider = new VercelGatewayProvider("vendor/model");
    const prompt = "🙂".repeat(AI_REQUEST_MAX_INPUT_BYTES / 4);
    const run = async () => {
      if (operation === "text") await provider.generateText(prompt, { system: "x" });
      if (operation === "once") await provider.generateTextOnce("ok", { system: prompt });
      if (operation === "schema") await provider.generateStructuredTextOnce("ok", prompt);
      if (operation === "stream") for await (const _ of provider.streamTextOnce(prompt, { system: "x" })) { /* consume */ }
    };
    await expect(run()).rejects.toThrow();
    expect(generate).not.toHaveBeenCalled();
    expect(stream).not.toHaveBeenCalled();
  });
});
