import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Source-path diagnostic only: synthetic public-bot data, mocked database/SDK.
 * This does not prove production reachability, private-bot eligibility, a live
 * provider effect, or association with any workspace's AI policy. */
const m = vi.hoisted(() => ({
  sdk: vi.fn(), stream: vi.fn(), wire: vi.fn(), rate: vi.fn(),
  bot: vi.fn(), aggregate: vi.fn(), update: vi.fn(), audit: vi.fn(), transaction: vi.fn(),
}));
vi.mock("ai", () => ({ generateText: m.sdk, streamText: m.stream, Output: {} }));
vi.mock("@/lib/db", () => ({ prisma: {
  bot: { findUnique: m.bot, aggregate: m.aggregate, update: m.update },
  aIInvocation: { create: m.audit },
  $transaction: m.transaction,
} }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: m.rate }));
// No provider/client network path may escape the terminal SDK mock.
vi.mock("node:http", async original => ({
  ...await original<typeof import("node:http")>(), request: m.wire, get: m.wire,
}));
vi.mock("node:https", async original => ({
  ...await original<typeof import("node:https")>(), request: m.wire, get: m.wire,
}));
vi.mock("node:net", async original => ({
  ...await original<typeof import("node:net")>(), connect: m.wire, createConnection: m.wire,
}));

const originalEnvironment = process.env;
const MODEL = "synthetic/legacy-chat-diagnostic";
const SOURCE = "SYNTHETIC_PUBLIC_BOT_SOURCE_MARKER";

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  // The real orchestrator races a timeout without clearing its losing timer.
  // Keep that timer inert/owned; this diagnostic does not qualify real timing.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  process.env = { NODE_ENV: "test", AI_GATEWAY_API_KEY: "synthetic-not-a-real-key", AI_GATEWAY_MODEL: MODEL };
  m.wire.mockImplementation(() => { throw Error("diagnostic_network_forbidden"); });
  m.stream.mockImplementation(() => { throw Error("diagnostic_stream_forbidden"); });
  vi.stubGlobal("fetch", m.wire);
  m.rate.mockReturnValue(true);
  m.bot.mockResolvedValue({
    id: "synthetic-public-bot", userId: "synthetic-bot-owner", user: { plan: "starter" },
    sources: [{ content: SOURCE }],
  });
  m.aggregate.mockResolvedValue({ _sum: { messageCount: 0 } });
  m.update.mockResolvedValue({ id: "synthetic-public-bot" });
  m.audit.mockResolvedValue({ id: "synthetic-invocation" });
  m.transaction.mockImplementation(() => { throw Error("diagnostic_unexpected_financial_transaction"); });
  m.sdk.mockResolvedValue({
    text: "synthetic SDK response", finishReason: "stop",
    usage: { inputTokens: 7, outputTokens: 3, totalTokens: 10 },
    providerMetadata: { gateway: { generationId: "gen_synthetic_legacy_diagnostic" } },
  });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  process.env = originalEnvironment;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function request() {
  const { NextRequest } = await import("next/server");
  return new NextRequest("https://axiom.invalid/api/chat", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ botId: "synthetic-public-bot", messages: [{ role: "user", content: "Synthetic user question" }] }),
  });
}

describe("legacy public bot chat admission diagnostic — no live IO", () => {
  it("characterizes actual route→orchestrator→legacy manager→Gateway→mocked SDK, without workspace attribution", async () => {
    const { AIProviderManager } = await import("@/lib/ai/AIProviderManager");
    const { VercelGatewayProvider } = await import("@/lib/ai/providers/VercelGatewayProvider");
    const legacy = vi.spyOn(AIProviderManager.prototype, "generateText");
    const admitted = vi.spyOn(AIProviderManager.prototype, "generateTextWithAdmission");
    const gateway = vi.spyOn(VercelGatewayProvider.prototype, "generateText");
    const { POST } = await import("../route");
    const response = await POST(await request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "synthetic SDK response" });
    expect(legacy).toHaveBeenCalledTimes(1);
    expect(admitted).not.toHaveBeenCalled();
    expect(gateway).toHaveBeenCalledTimes(1);
    expect(m.sdk).toHaveBeenCalledTimes(1);
    const legacyOptions = legacy.mock.calls[0][1];
    expect(legacyOptions).toMatchObject({ only: "vercel_gateway", maxTokens: 1536, temperature: 0.4 });
    expect(legacyOptions?.organizationId).toBeUndefined();
    const wire = m.sdk.mock.calls[0][0];
    expect(wire.model).toBe(MODEL);
    expect(wire.prompt).toContain("USER: Synthetic user question");
    expect(wire.system).toContain(SOURCE);
    expect(wire.maxOutputTokens).toBe(1536);
    expect(wire.providerOptions.gateway.user).toBeUndefined();
    expect(wire).not.toHaveProperty("admission");
    expect(wire).not.toHaveProperty("codingDispatch");
    // SDK options alone cannot establish this: admitted paths deliberately
    // strip capabilities too. The real method spy and DB trap are additional evidence.
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.bot).toHaveBeenCalledWith({ where: { id: "synthetic-public-bot" }, include: { sources: true, user: true } });
    expect(m.audit).toHaveBeenCalledTimes(1);
    expect(m.audit.mock.calls[0][0].data.userId).toBeUndefined();
    expect(m.update).toHaveBeenCalledTimes(1);
    expect(m.wire).not.toHaveBeenCalled();
  });

  it("retains the actual missing-Gateway-configuration refusal before bot reads or SDK dispatch", async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;
    const { POST } = await import("../route");
    expect((await POST(await request())).status).toBe(503);
    expect(m.bot).not.toHaveBeenCalled();
    expect(m.sdk).not.toHaveBeenCalled();
    expect(m.wire).not.toHaveBeenCalled();
  });

  it("retains the route's rate-limit refusal before reads or SDK dispatch", async () => {
    m.rate.mockReturnValue(false);
    const { POST } = await import("../route");
    expect((await POST(await request())).status).toBe(429);
    expect(m.bot).not.toHaveBeenCalled();
    expect(m.sdk).not.toHaveBeenCalled();
  });

  it("retains the actual starter monthly-message limit before SDK dispatch", async () => {
    m.aggregate.mockResolvedValue({ _sum: { messageCount: 6000 } });
    const { POST } = await import("../route");
    expect((await POST(await request())).status).toBe(403);
    expect(m.sdk).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
    expect(m.transaction).not.toHaveBeenCalled();
  });
});
