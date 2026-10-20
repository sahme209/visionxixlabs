import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ streamText: vi.fn(), generateText: vi.fn() }));
vi.mock("ai", () => sdk);
import { VercelGatewayProvider } from "../providers/VercelGatewayProvider";

function result(parts: unknown[], metadata: unknown = { gateway: { generationId: "gen_stream" } }) {
  return {
    fullStream: (async function* () { for (const part of parts) yield part; })(),
    totalUsage: Promise.resolve({ inputTokens: 4, outputTokens: 2, totalTokens: 6 }),
    providerMetadata: Promise.resolve(metadata),
  };
}
const finish = { type: "finish", finishReason: "stop" };

describe("single-attempt Gateway stream boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AI_GATEWAY_API_KEY = "synthetic-test-key";
  });
  it("yields before completion and returns authoritative terminal evidence without buffering", async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    sdk.streamText.mockReturnValue({ ...result([]), fullStream: (async function* () {
      yield { type: "text-delta", text: "first" };
      await gate;
      yield { type: "text-delta", text: "second" };
      yield finish;
    })() });
    const stream = new VercelGatewayProvider("vendor/model").streamTextOnce("hello", { organizationId: "org" });
    expect(await stream.next()).toEqual({ done: false, value: { text: "first", done: false } });
    release();
    expect((await stream.next()).value).toEqual({ text: "second", done: false });
    expect((await stream.next()).value).toMatchObject({ done: true, response: {
      text: "", model: "vendor/model", gatewayGenerationId: "gen_stream", usage: { promptTokens: 4, completionTokens: 2 },
    } });
    expect(sdk.generateText).not.toHaveBeenCalled();
    expect(sdk.streamText).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0, maxOutputTokens: 4096 }));
  });
  it("aborts upstream when the consumer closes early", async () => {
    sdk.streamText.mockReturnValue(result([{ type: "text-delta", text: "partial" }, finish]));
    const stream = new VercelGatewayProvider("vendor/model").streamTextOnce("hello");
    await stream.next();
    const signal = sdk.streamText.mock.calls[0][0].abortSignal as AbortSignal;
    expect(signal.aborted).toBe(false);
    await stream.return(undefined);
    expect(signal.aborted).toBe(true);
  });
  it.each([
    [{ type: "error", error: new Error("secret provider detail") }],
    [{ type: "abort" }],
    [{ type: "text-delta", text: "truncated" }],
  ])("never emits success for an errored, aborted or truncated stream", async (...parts) => {
    sdk.streamText.mockReturnValue(result(parts));
    const seen: unknown[] = [];
    await expect((async () => { for await (const chunk of new VercelGatewayProvider("vendor/model").streamTextOnce("hello")) seen.push(chunk); })()).rejects.toMatchObject({ provider: "vercel_gateway" });
    expect(seen).not.toContainEqual(expect.objectContaining({ done: true }));
    expect(sdk.streamText).toHaveBeenCalledOnce();
  });
  it("fails closed when terminal metering evidence is absent", async () => {
    sdk.streamText.mockReturnValue(result([finish], {}));
    await expect(new VercelGatewayProvider("vendor/model").streamTextOnce("hello").next()).rejects.toMatchObject({ kind: "bad_response" });
  });
  it.each([{}, { inputTokens: -1, outputTokens: 2 }, { inputTokens: 1.5, outputTokens: 2 }])("refuses invalid terminal usage %j", async usage => {
    sdk.streamText.mockReturnValue({ ...result([finish]), totalUsage: Promise.resolve(usage) });
    await expect(new VercelGatewayProvider("vendor/model").streamTextOnce("hello").next()).rejects.toMatchObject({ kind: "bad_response" });
  });
  it("refuses an already canceled call before SDK dispatch", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(new VercelGatewayProvider("vendor/model").streamTextOnce("hello", { abortSignal: controller.signal }).next()).rejects.toMatchObject({ kind: "timeout" });
    expect(sdk.streamText).not.toHaveBeenCalled();
  });
  it("honors external cancellation and scrubs composed prompts", async () => {
    const controller = new AbortController();
    const secret = `ghp_${"x".repeat(36)}`;
    sdk.streamText.mockReturnValue(result([{ type: "text-delta", text: "partial" }, finish]));
    const stream = new VercelGatewayProvider("vendor/model").streamTextOnce(secret, { system: secret, abortSignal: controller.signal });
    await stream.next();
    const sent = sdk.streamText.mock.calls[0][0];
    expect(sent.prompt).not.toContain(secret);
    expect(sent.system).not.toContain(secret);
    controller.abort();
    await expect(stream.next()).rejects.toMatchObject({ kind: "timeout" });
    expect(sent.abortSignal.aborted).toBe(true);
  });
  it.each([0, 4097, 1.5])("rejects invalid output bound %s before SDK dispatch", async maxTokens => {
    await expect(new VercelGatewayProvider("vendor/model").streamTextOnce("hello", { maxTokens }).next()).rejects.toMatchObject({ kind: "bad_response" });
    expect(sdk.streamText).not.toHaveBeenCalled();
  });
});
