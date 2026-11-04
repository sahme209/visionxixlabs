import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AIRequestOptions } from "../AIProvider";
const m = vi.hoisted(() => ({ sdk: vi.fn(), consume: vi.fn() }));
vi.mock("ai", () => ({ generateText: m.sdk, streamText: vi.fn() }));
// Test-only instance substitution. Production imports the closed canonical consumer.
vi.mock("../codingRequestQuote", async original => ({ ...await original<typeof import("../codingRequestQuote")>(), consumeCodingProviderDispatchForRequest: m.consume }));
import { createIsolatedCodingQuoteProtocol, parseSyntheticCodingPricing, prepareCodingRequestEnvelope } from "../codingRequestQuote";
import { VercelGatewayProvider } from "../providers/VercelGatewayProvider";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const model = "anthropic/claude-sonnet-5";
const now = 1_800_000_000_000;
function fixture(system: string | undefined) {
  const protocol = createIsolatedCodingQuoteProtocol();
  const prepared = prepareCodingRequestEnvelope({ organizationId: "org", userId: "actor", correlationId: "corr", runId: "run", stageRunId: "stage", claimGeneration: "generation", phase: "initial", idempotencyKey: "key", task: "generate_text", model, prompt: "prompt", ...(system === undefined ? {} : { system }), temperature: 0.2, maxOutputTokens: 4096, maxRetries: 0, adapterContract: "coding_gateway_text_v1", routing: { only: ["anthropic"], thinking: "disabled", region: "default", cache: "none" } });
  const pricing = parseSyntheticCodingPricing({ schema: "synthetic_coding_pricing_v1", model, currency: "USD", unit: "nano_dollars_per_token", inputRate: "100", outputRate: "200", requestFee: "0", ancillaryFee: "0", route: "anthropic", region: "default", retrievedAt: now - 1, expiresAt: now + 120000 });
  const reserved = protocol.consumeForReservation(protocol.quote(prepared, pricing, 1000, now), prepared, now);
  const dispatch = protocol.consumeManager(protocol.consumeForDispatch(reserved.handle, prepared, now), prepared, now);
  m.consume.mockImplementation((handle, actual, at) => protocol.consumeProviderForRequest(handle, actual, at));
  return { options: { organizationId: "org", correlationId: "corr", model, ...(system === undefined ? {} : { system }), maxTokens: 4096, temperature: 0.2, codingDispatch: dispatch } as AIRequestOptions };
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("AI_GATEWAY_API_KEY", "synthetic"); vi.spyOn(Date, "now").mockReturnValue(now);
  m.sdk.mockResolvedValue({ text: "synthetic", finishReason: "stop", usage: {}, providerMetadata: { gateway: { generationId: "synthetic-generation" } } });
});
it.each(["system", undefined])("dispatches exactly the checked payload with fixed routing, disabled thinking and zero retries (%s)", async system => {
  const f = fixture(system);
  const provider = new VercelGatewayProvider(model);
  await provider.generateTextOnce("prompt", f.options);
  expect(m.sdk).toHaveBeenCalledOnce();
  expect(m.sdk).toHaveBeenCalledWith(expect.objectContaining({ model, prompt: "prompt", temperature: 0.2, maxOutputTokens: 4096, maxRetries: 0, providerOptions: { anthropic: { thinking: { type: "disabled" } }, gateway: { only: ["anthropic"], user: "org", tags: ["product:axiom-agent", "correlation:corr"] } } }));
  if (system === undefined) expect(m.sdk.mock.calls[0][0]).not.toHaveProperty("system");
  else expect(m.sdk.mock.calls[0][0].system).toBe(system);
  await expect(provider.generateTextOnce("prompt", f.options)).rejects.toThrow();
  expect(m.sdk).toHaveBeenCalledOnce();
});
it.each([
  { model: "anthropic/other" }, { maxTokens: 100 }, { temperature: 0.3 }, { system: "changed" }, { system: "" }, { organizationId: "other" }, { correlationId: "other" },
])("refuses a changed final request before SDK dispatch: %j", async change => {
  const f = fixture("system");
  await expect(new VercelGatewayProvider(model).generateTextOnce("prompt", { ...f.options, ...change })).rejects.toThrow();
  expect(m.sdk).not.toHaveBeenCalled();
  // The mismatched handle was consumed; restoring options cannot retry it.
  await expect(new VercelGatewayProvider(model).generateTextOnce("prompt", f.options)).rejects.toThrow();
  expect(m.sdk).not.toHaveBeenCalled();
});
it("refuses changed prompt bytes and expiry before SDK dispatch", async () => {
  const f = fixture("system");
  await expect(new VercelGatewayProvider(model).generateTextOnce("prompt changed", f.options)).rejects.toThrow();
  const expired = fixture("system"); vi.spyOn(Date, "now").mockReturnValue(now + 120000);
  await expect(new VercelGatewayProvider(model).generateTextOnce("prompt", expired.options)).rejects.toThrow();
  expect(m.sdk).not.toHaveBeenCalled();
});
