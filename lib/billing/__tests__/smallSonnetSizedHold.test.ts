import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { prepareSmallSonnetRequest, smallSonnetPayload, smallSonnetReservation, smallSonnetReservationEvidence, SMALL_SONNET_BYTES, SMALL_SONNET_MODEL } from "../smallSonnetRequest";
import { smallSonnetPricingFixture } from "./fixtures/smallSonnetPricing";
const scope = { organizationId: "org", userId: "owner", correlationId: "sized:0" };
const request = { model: SMALL_SONNET_MODEL, text: "Read README.md", schemaHint: "{}" };
beforeEach(() => {
  vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "axiom_public_anniversary_v1");
  vi.stubEnv("AXIOM_AI_MAX_REQUEST_CREDITS_CENTS", "");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(smallSonnetPricingFixture()))));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("prices the next conservative payload bucket so two small steps fit after six cents of prior usage", async () => {
  const handle = await prepareSmallSonnetRequest(scope, request); expect(handle).toBeDefined();
  const cents = smallSonnetReservation(handle!, scope), evidence = smallSonnetReservationEvidence(handle!, scope);
  expect(cents).toBeLessThanOrEqual(97);
  expect(cents).toBe(evidence.estimatedHoldCents);
  expect(cents).toBeGreaterThan(0);
  expect(evidence).toMatchObject({ policy: "small_sonnet_free_v2", maximumPayloadBytes: 8192, maximumOutputTokens: 4096, estimatedInputTokens: 40960 });
  expect(194 - 2 * cents).toBeGreaterThanOrEqual(0);
});
it.each([8192, 16384, 32768])("quotes the complete UTF8 system and prompt through the %i byte boundary", async bytes => {
  const overhead = Buffer.byteLength(smallSonnetPayload("", request.schemaHint).system);
  const exact = await prepareSmallSonnetRequest(scope, { ...request, text: "x".repeat(bytes - overhead) }); expect(exact).toBeDefined();
  expect(smallSonnetReservationEvidence(exact!, scope).maximumPayloadBytes).toBe(bytes);
  const next = await prepareSmallSonnetRequest(scope, { ...request, text: "x".repeat(bytes - overhead + 1) });
  if (bytes === SMALL_SONNET_BYTES) expect(next).toBeUndefined();
  else { expect(next).toBeDefined(); expect(smallSonnetReservationEvidence(next!, scope).maximumPayloadBytes).toBe(bytes * 2); expect(smallSonnetReservation(next!, scope)).toBeGreaterThanOrEqual(smallSonnetReservation(exact!, scope)); }
});
