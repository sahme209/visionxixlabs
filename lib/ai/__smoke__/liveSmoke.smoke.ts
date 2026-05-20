/**
 * One-off live smoke test for the free AI provider manager.
 *
 * Skipped in normal CI: only runs when AI_LIVE_SMOKE=1. Reads env vars
 * out of the host process (operator loads them via `npx dotenv -e
 * .env.local.vercel -- npx vitest run ...`). Verifies that with only
 * GEMINI_API_KEY set, the manager routes a real generate to Gemini.
 *
 * Safe: never prints the API key, only the response provider/model.
 */

import { describe, it, expect } from "vitest";
import { _resetAIProviderManagerForTests, getAIProviderManager } from "../AIProviderManager";

const LIVE = process.env.AI_LIVE_SMOKE === "1";

describe.skipIf(!LIVE)("free AI provider — live smoke", () => {
  it("routes through the first configured free provider and returns text", async () => {
    _resetAIProviderManagerForTests();
    const mgr = getAIProviderManager();
    const status = mgr.status();
    const configured = status.filter((s) => s.configured && s.provider !== "mock");
    // eslint-disable-next-line no-console
    console.log("[smoke] configured providers:", configured.map((c) => c.provider));
    const r = await mgr.generateText("Reply with one short cheerful sentence.", {
      maxTokens: 64, temperature: 0.4, timeoutMs: 25_000,
    });
    // eslint-disable-next-line no-console
    console.log(`[smoke] answered_by=${r.provider} model=${r.model} latencyMs=${r.latencyMs}`);
    expect(r.text.length).toBeGreaterThan(0);
    expect(r.provider).not.toBe("mock");
  }, 60_000);
});
