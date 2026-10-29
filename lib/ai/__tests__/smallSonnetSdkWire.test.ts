import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createGateway } from "@ai-sdk/gateway";
const wire = vi.hoisted(() => ({ model: undefined as unknown, requests: [] as Array<{ url: string; headers: Headers; body: Record<string, unknown> }>, fail: false }));
vi.mock("ai", async original => {
  const actual = await original<typeof import("ai")>();
  return { ...actual,
    generateText: (options: Parameters<typeof actual.generateText>[0]) => actual.generateText({ ...options, model: wire.model as Parameters<typeof actual.generateText>[0]["model"] }),
    streamText: (options: Parameters<typeof actual.streamText>[0]) => actual.streamText({ ...options, model: wire.model as Parameters<typeof actual.streamText>[0]["model"] }),
  };
});
import { VercelGatewayProvider } from "../providers/VercelGatewayProvider";
import { prepareSmallSonnetRequest, authorizeSmallSonnetDispatch, smallSonnetPayload, SMALL_SONNET_MODEL } from "@/lib/billing/smallSonnetRequest";
import { smallSonnetPricingFixture } from "@/lib/billing/__tests__/fixtures/smallSonnetPricing";
const scope = { organizationId: "org", userId: "member", correlationId: "sdk-wire" };
const request = { model: SMALL_SONNET_MODEL, text: "Synthetic SDK wire check", schemaHint: "{action:string}" };
const text = '{"action":"respond","message":"Synthetic wire answer"}';
const usage = { inputTokens: { total: 5, noCache: 5, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 2, text: 2, reasoning: undefined } };
beforeEach(() => {
  wire.requests = []; wire.fail = false;
  vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "axiom_public_anniversary_v1"); vi.stubEnv("AXIOM_AI_MAX_REQUEST_CREDITS_CENTS", ""); vi.stubEnv("AI_GATEWAY_API_KEY", "synthetic-key");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(smallSonnetPricingFixture()))));
  const gateway = createGateway({ apiKey: "synthetic-key", baseURL: "https://gateway.invalid/v1/ai", fetch: async (url, init) => {
    // Fixed synthetic transport. No branch can reach a network or paid model.
    expect(String(url)).toBe("https://gateway.invalid/v1/ai/language-model");
    const headers = new Headers(init?.headers), body = JSON.parse(String(init?.body));
    wire.requests.push({ url: String(url), headers, body });
    if (wire.fail) return new Response(JSON.stringify({ error: "synthetic unavailable" }), { status: 503, headers: { "content-type": "application/json" } });
    const providerMetadata = { gateway: { generationId: "synthetic-wire-generation" } };
    if (headers.get("ai-language-model-streaming") === "true") {
      const parts = [{ type: "stream-start", warnings: [] }, { type: "text-start", id: "text" }, { type: "text-delta", id: "text", delta: text }, { type: "text-end", id: "text" }, { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage, providerMetadata }];
      return new Response(parts.map(part => `data: ${JSON.stringify(part)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } });
    }
    return new Response(JSON.stringify({ content: [{ type: "text", text }], finishReason: { unified: "stop", raw: "stop" }, usage, providerMetadata, warnings: [] }), { headers: { "content-type": "application/json" } });
  } });
  wire.model = gateway(SMALL_SONNET_MODEL);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
async function options() {
  const quote = await prepareSmallSonnetRequest(scope, request); if (!quote) throw Error("synthetic quote unavailable");
  return { ...scope, model: SMALL_SONNET_MODEL, maxTokens: 4096, smallAgentDispatch: authorizeSmallSonnetDispatch(quote, { ...scope, ...request, maxTokens: 4096 }) };
}
it.each([false, true])("installed SDK/Gateway serializes the exact restricted route without paid IO (streaming=%s)", async streaming => {
  const provider = new VercelGatewayProvider(SMALL_SONNET_MODEL), admitted = await options();
  if (streaming) {
    const chunks = []; for await (const chunk of provider.streamTextOnce(request.text, { ...admitted, system: smallSonnetPayload(request.text, request.schemaHint).system }, "json")) chunks.push(chunk);
    expect(chunks.at(-1)).toMatchObject({ done: true, response: { gatewayGenerationId: "synthetic-wire-generation" } });
  } else {
    expect(await provider.generateStructuredTextOnce(request.text, request.schemaHint, admitted)).toMatchObject({ gatewayGenerationId: "synthetic-wire-generation", text });
  }
  expect(wire.requests).toHaveLength(1);
  const sent = wire.requests[0];
  expect(sent.headers.get("ai-language-model-id")).toBe(SMALL_SONNET_MODEL);
  expect(sent.headers.get("ai-language-model-streaming")).toBe(String(streaming));
  expect(sent.body).toMatchObject({ maxOutputTokens: 4096, providerOptions: { gateway: { only: ["anthropic"], user: "org" }, anthropic: { thinking: { type: "disabled" } } } });
  expect(sent.body.tools).toBeUndefined();
  expect((sent.body.responseFormat as { type?: string } | undefined)?.type).not.toBe("json");
  expect(sent.body.prompt).toEqual([{ role: "system", content: smallSonnetPayload(request.text, request.schemaHint).system }, { role: "user", content: [{ type: "text", text: request.text }] }]);
});
it.each([false, true])("the actual SDK does not retry a failed bounded HTTP request (streaming=%s)", async streaming => {
  wire.fail = true;
  const provider = new VercelGatewayProvider(SMALL_SONNET_MODEL), admitted = await options();
  if (streaming) await expect(provider.streamTextOnce(request.text, { ...admitted, system: smallSonnetPayload(request.text, request.schemaHint).system }).next()).rejects.toThrow();
  else await expect(provider.generateStructuredTextOnce(request.text, request.schemaHint, admitted)).rejects.toThrow();
  expect(wire.requests).toHaveLength(1);
});
