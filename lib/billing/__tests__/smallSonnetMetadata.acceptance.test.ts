import { afterEach, expect, it, vi } from "vitest";
import { prepareSmallSonnetRequest, smallSonnetReservation } from "../smallSonnetRequest";
afterEach(() => vi.unstubAllEnvs());
/** Explicit opt-in: one unauthenticated public metadata GET, no prompt POST,
 * database write, credit hold, model inference or provider spending. */
it.skipIf(process.env.AXIOM_LIVE_SMALL_SONNET_METADATA !== "1")("accepts the current public Anthropic endpoint pricing contract without inference", async () => {
  vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "axiom_public_anniversary_v1");
  vi.stubEnv("AXIOM_AI_MAX_REQUEST_CREDITS_CENTS", "");
  const scope = { organizationId: "metadata-only", userId: "no-dispatch", correlationId: "public-contract-read" };
  const quote = await prepareSmallSonnetRequest(scope, { model: "anthropic/claude-sonnet-5", text: "Metadata acceptance only", schemaHint: "{}" });
  expect(quote).toBeDefined();
  expect(smallSonnetReservation(quote!, scope)).toBe(100);
}, 15000);
