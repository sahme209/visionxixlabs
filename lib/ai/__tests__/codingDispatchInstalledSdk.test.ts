import { afterEach, expect, it, vi } from "vitest";

// Installed SDK and adapter stay real. Every attempted HTTP request is captured
// by this throwing replacement, installed before their modules are imported.
const wire = vi.hoisted(() => {
  const fetch = vi.fn(async () => { throw new TypeError("synthetic-offline-stop"); });
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("AI_SDK_DEFAULT_PROVIDER", undefined);
  return { fetch, consume: vi.fn() };
});
// Only the canonical capability consumer is substituted with one isolated
// instance. This does not mint or enable production quote authority.
vi.mock("../codingRequestQuote", async original => ({
  ...await original<typeof import("../codingRequestQuote")>(),
  consumeCodingProviderDispatchForRequest: wire.consume,
}));
import { createIsolatedCodingQuoteProtocol, parseSyntheticCodingPricing, prepareCodingRequestEnvelope } from "../codingRequestQuote";
import { boundedAIInput } from "../inputByteBound";
import { VercelGatewayProvider } from "../providers/VercelGatewayProvider";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("sends the exact quoted redacted request through the installed SDK/adapter once, stopping at the offline transport", async () => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "synthetic-not-a-provider-credential");
  vi.stubEnv("VERCEL_OIDC_TOKEN", "");
  vi.stubEnv("AI_GATEWAY_MODEL", "anthropic/claude-sonnet-5");
  const at = Date.now(), model = "anthropic/claude-sonnet-5";
  const syntheticSecret = `ghp_${"a".repeat(36)}`;
  const prompt = `Synthetic code task ${syntheticSecret}`;
  const system = `Synthetic instructions ${syntheticSecret}`;
  const payload = boundedAIInput(prompt, system);
  const prepared = prepareCodingRequestEnvelope({
    organizationId: "synthetic-org", userId: "synthetic-actor", correlationId: "synthetic-correlation", runId: "synthetic-run", stageRunId: "synthetic-stage", claimGeneration: "synthetic-generation", phase: "initial", idempotencyKey: "synthetic-key", task: "generate_text", model,
    ...payload, temperature: 0.2, maxOutputTokens: 4096, maxRetries: 0, adapterContract: "coding_gateway_text_v1", routing: { only: ["anthropic"], thinking: "disabled", region: "default", cache: "none" },
  });
  const protocol = createIsolatedCodingQuoteProtocol();
  const pricing = parseSyntheticCodingPricing({ schema: "synthetic_coding_pricing_v1", model, currency: "USD", unit: "nano_dollars_per_token", inputRate: "100", outputRate: "200", requestFee: "0", ancillaryFee: "0", route: "anthropic", region: "default", retrievedAt: at - 100, expiresAt: at + 120000 });
  const reserved = protocol.consumeForReservation(protocol.quote(prepared, pricing, 1000, at), prepared, at);
  const dispatch = protocol.consumeManager(protocol.consumeForDispatch(reserved.handle, prepared, at), prepared, at);
  wire.consume.mockImplementation((handle, actual, now) => protocol.consumeProviderForRequest(handle, actual, now));
  const captured: Array<{ url: string; model: string | null; body: Record<string, unknown> }> = [];
  wire.fetch.mockImplementation(async (...args: unknown[]) => {
    const [input, init] = args as [RequestInfo | URL, RequestInit];
    captured.push({ url: String(input), model: new Headers(init.headers).get("ai-language-model-id"), body: JSON.parse(String(init.body)) });
    // There is deliberately no successful synthetic provider response, usage,
    // metering receipt or billing claim in this wire-serialization check.
    throw new TypeError("synthetic-offline-stop");
  });
  const provider = new VercelGatewayProvider(model);
  const options = { organizationId: "synthetic-org", correlationId: "synthetic-correlation", model, system, maxTokens: 4096, temperature: 0.2, codingDispatch: dispatch };
  await expect(provider.generateTextOnce(prompt, options)).rejects.toMatchObject({ kind: "network" });
  expect(wire.consume).toHaveBeenCalledOnce();
  expect(wire.fetch).toHaveBeenCalledOnce();
  expect(captured).toHaveLength(1);
  expect(captured[0].url).toBe("https://ai-gateway.vercel.sh/v3/ai/language-model");
  expect(captured[0].model).toBe(model);
  expect(captured[0].body).toMatchObject({
    maxOutputTokens: 4096, temperature: 0.2,
    prompt: [
      { role: "system", content: payload.system },
      { role: "user", content: [{ type: "text", text: payload.prompt }] },
    ],
    providerOptions: { gateway: { only: ["anthropic"], user: "synthetic-org", tags: ["product:axiom-agent", "correlation:synthetic-correlation"] }, anthropic: { thinking: { type: "disabled" } } },
  });
  expect(captured[0].body.prompt).toEqual([
    { role: "system", content: payload.system },
    { role: "user", content: [{ type: "text", text: payload.prompt }] },
  ]);
  expect(captured[0].body.providerOptions).toEqual({
    gateway: { only: ["anthropic"], user: "synthetic-org", tags: ["product:axiom-agent", "correlation:synthetic-correlation"] },
    anthropic: { thinking: { type: "disabled" } },
  });
  expect(captured[0].body.tools).toBeUndefined();
  expect(captured[0].body.toolChoice).toBeUndefined();
  expect(JSON.stringify(captured[0].body)).not.toContain(syntheticSecret);
  // The final dispatch was consumed before the failed transport. It cannot be
  // reused to obtain a second SDK/HTTP attempt, even with unchanged options.
  await expect(provider.generateTextOnce(prompt, options)).rejects.toThrow();
  expect(wire.fetch).toHaveBeenCalledOnce();
});
