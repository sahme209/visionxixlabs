import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { prepareSmallSonnetRequest, smallSonnetReservation, smallSonnetReservationEvidence, authorizeSmallSonnetDispatch, consumeSmallSonnetDispatch, smallSonnetPayload, SMALL_SONNET_BYTES, SMALL_SONNET_MODEL } from "../smallSonnetRequest";
import { smallSonnetPricingFixture } from "./fixtures/smallSonnetPricing";
const scope = { organizationId: "org", userId: "member", correlationId: "request:0" };
const request = { model: SMALL_SONNET_MODEL, text: "List environments", schemaHint: "{action:string}" };
let metadata: ReturnType<typeof smallSonnetPricingFixture>;
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "axiom_public_anniversary_v1");
  vi.stubEnv("AXIOM_AI_MAX_REQUEST_CREDITS_CENTS", "");
  metadata = smallSonnetPricingFixture();
  fetcher = vi.fn(async () => new Response(JSON.stringify(metadata)));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function quote() {
  const handle = await prepareSmallSonnetRequest(scope, request);
  if (!handle) throw Error("fixture quote missing");
  return handle;
}
function authorize(handle: Awaited<ReturnType<typeof quote>>) {
  return authorizeSmallSonnetDispatch(handle, { ...scope, ...request, maxTokens: 4096 });
}
function binding() { return { ...scope, model: SMALL_SONNET_MODEL, ...smallSonnetPayload(request.text, request.schemaHint), maxTokens: 4096 }; }
it("fresh public metadata includes regional/cache premiums, margin and buffer in the full 100-cent hold", async () => {
  const handle = await quote();
  expect(smallSonnetReservation(handle, scope)).toBe(100);
  expect(smallSonnetReservationEvidence(handle, scope)).toMatchObject({ estimatedProviderCents: 43, estimatedHoldCents: 98, reservedCents: 100, estimatedInputTokens: 139264 });
  expect(fetcher).toHaveBeenCalledWith("https://ai-gateway.vercel.sh/v1/models/anthropic/claude-sonnet-5/endpoints", { cache: "no-store", signal: expect.any(AbortSignal) });
  await quote(); expect(fetcher).toHaveBeenCalledTimes(2);
});
it("bounds the complete redacted system plus prompt by UTF8 bytes including multibyte input", async () => {
  const overhead = Buffer.byteLength(smallSonnetPayload("", request.schemaHint).system);
  expect(await prepareSmallSonnetRequest(scope, { ...request, text: "x".repeat(SMALL_SONNET_BYTES - overhead) })).toBeDefined();
  expect(await prepareSmallSonnetRequest(scope, { ...request, text: "x".repeat(SMALL_SONNET_BYTES - overhead + 1) })).toBeUndefined();
  expect(await prepareSmallSonnetRequest(scope, { ...request, text: "🧪".repeat(SMALL_SONNET_BYTES / 4) })).toBeUndefined();
  expect(fetcher).toHaveBeenCalledOnce();
});
it.each(["vendor/model", "spacexai/grok-4.20-multi-agent", "service-default"])("never reinterprets %s as the small approved route", async model => {
  expect(await prepareSmallSonnetRequest(scope, { ...request, model })).toBeUndefined(); expect(fetcher).not.toHaveBeenCalled();
});
it.each(["1000", "100", "invalid"])("retains an explicit service hold setting %s", async setting => {
  vi.stubEnv("AXIOM_AI_MAX_REQUEST_CREDITS_CENTS", setting);
  expect(await prepareSmallSonnetRequest(scope, request)).toBeUndefined(); expect(fetcher).not.toHaveBeenCalled();
});
it("requires the public billing authority switch", async () => {
  vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "");
  expect(await prepareSmallSonnetRequest(scope, request)).toBeUndefined(); expect(fetcher).not.toHaveBeenCalled();
});
it.each(["price_increase", "new_fee", "per_request_fee", "thinking_fee", "no_output_bound", "mandatory_thinking", "no_disabled_thinking", "wrong_model", "missing_provider", "duplicate_provider", "bad_decimal", "unavailable"])("refuses unsupported or more expensive pricing contract %s", async kind => {
  const endpoint = metadata.data.endpoints[0];
  if (kind === "price_increase") endpoint.inference_regions[0].pricing.input_cache_write = "0.0001";
  if (kind === "new_fee") Object.assign(endpoint.pricing, { unknown_fee: "0.001" });
  if (kind === "per_request_fee") endpoint.pricing.request = "0.01";
  if (kind === "thinking_fee") endpoint.pricing.internal_reasoning = "0.0001";
  if (kind === "no_output_bound") endpoint.supported_parameters = [];
  if (kind === "mandatory_thinking") metadata.data.reasoning.mandatory = true;
  if (kind === "no_disabled_thinking") metadata.data.reasoning.supported_efforts = ["high"];
  if (kind === "wrong_model") metadata.data.id = "different/model";
  if (kind === "missing_provider") endpoint.provider_name = "bedrock";
  if (kind === "duplicate_provider") metadata.data.endpoints.push(endpoint);
  if (kind === "bad_decimal") endpoint.pricing.prompt = "NaN";
  if (kind === "unavailable") endpoint.status = 1;
  expect(await prepareSmallSonnetRequest(scope, request)).toBeUndefined();
});
it("ignores no alternative routing path: hard-pins only Anthropic and disables thinking", async () => {
  const dispatch = authorize(await quote());
  expect(consumeSmallSonnetDispatch(dispatch, binding())).toEqual({ gateway: { only: ["anthropic"] }, anthropic: { thinking: { type: "disabled" } } });
  expect(() => consumeSmallSonnetDispatch(dispatch, binding())).toThrow();
});
it.each(["actor", "tenant", "correlation", "model", "output", "prompt", "schema"])("burns a quote on changed %s rather than dispatching", async kind => {
  const handle = await quote(), changed = { ...scope, ...request, maxTokens: 4096 };
  if (kind === "actor") changed.userId = "other";
  if (kind === "tenant") changed.organizationId = "other";
  if (kind === "correlation") changed.correlationId = "other";
  if (kind === "model") changed.model = "other/model";
  if (kind === "output") changed.maxTokens = 4095;
  if (kind === "prompt") changed.text = "changed";
  if (kind === "schema") changed.schemaHint = "changed";
  expect(() => authorizeSmallSonnetDispatch(handle, changed)).toThrow(); expect(() => authorize(handle)).toThrow();
});
it("refuses forged, copied, expired and SDK-changed authority", async () => {
  expect(() => smallSonnetReservation({} as never, scope)).toThrow();
  const handle = await quote(); expect(() => smallSonnetReservation({ ...handle }, scope)).toThrow();
  vi.useFakeTimers(); vi.setSystemTime(Date.now() + 120001);
  expect(() => authorize(handle)).toThrow();
  vi.useRealTimers();
  const dispatch = authorize(await quote());
  expect(() => consumeSmallSonnetDispatch(dispatch, { ...binding(), system: "changed" })).toThrow();
  expect(() => consumeSmallSonnetDispatch(dispatch, binding())).toThrow();
});
