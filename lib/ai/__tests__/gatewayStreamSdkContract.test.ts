import { beforeEach, expect, it, vi } from "vitest";
import { MockLanguageModelV3 } from "ai/test";

const injected = vi.hoisted(() => ({ model: undefined as unknown }));
vi.mock("ai", async original => {
  const actual = await original<typeof import("ai")>();
  return { ...actual, streamText: (options: Parameters<typeof actual.streamText>[0]) => actual.streamText({ ...options, model: injected.model as MockLanguageModelV3 }) };
});
import { VercelGatewayProvider } from "../providers/VercelGatewayProvider";

beforeEach(() => { process.env.AI_GATEWAY_API_KEY = "synthetic-test-key"; });

it("consumes installed SDK6 events and terminal Gateway metadata", async () => {
  const model = new MockLanguageModelV3({ doStream: async () => ({
    stream: new ReadableStream({ start(controller) {
      controller.enqueue({ type: "text-start", id: "text" });
      controller.enqueue({ type: "text-delta", id: "text", delta: "actual SDK text" });
      controller.enqueue({ type: "text-end", id: "text" });
      controller.enqueue({ type: "finish", finishReason: { unified: "stop", raw: undefined },
        usage: { inputTokens: { total: 4, noCache: 4, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 2, text: 2, reasoning: undefined } },
        providerMetadata: { gateway: { generationId: "gen_sdk_contract" } },
      });
      controller.close();
    } }),
  }) });
  injected.model = model;
  const seen = [];
  for await (const chunk of new VercelGatewayProvider("vendor/model").streamTextOnce("hello")) seen.push(chunk);
  expect(seen).toEqual([
    { done: false, text: "actual SDK text" },
    { done: true, text: "", response: expect.objectContaining({ gatewayGenerationId: "gen_sdk_contract", usage: { promptTokens: 4, completionTokens: 2, totalTokens: 6 } }) },
  ]);
  expect(model.doStreamCalls).toHaveLength(1);
  expect(model.doStreamCalls[0].responseFormat?.type).not.toBe("json");
});

it("closes an installed-SDK stream after partial output and aborts its provider signal", async () => {
  let signal: AbortSignal | undefined;
  injected.model = new MockLanguageModelV3({ doStream: async options => {
    signal = options.abortSignal;
    return { stream: new ReadableStream({ start(controller) {
      controller.enqueue({ type: "text-start", id: "text" });
      controller.enqueue({ type: "text-delta", id: "text", delta: "partial" });
      // Deliberately open: consumer close must abort without awaiting finish.
    } }) };
  } });
  const stream = new VercelGatewayProvider("vendor/model").streamTextOnce("hello");
  expect((await stream.next()).value).toEqual({ done: false, text: "partial" });
  await stream.return(undefined);
  expect(signal?.aborted).toBe(true);
});

it("interrupts an in-flight next through the external abort signal", async () => {
  injected.model = new MockLanguageModelV3({ doStream: async options => ({
    stream: new ReadableStream({ start(controller) {
      controller.enqueue({ type: "text-start", id: "text" });
      controller.enqueue({ type: "text-delta", id: "text", delta: "partial" });
      // The SDK forwards abort to its provider; an open synthetic source must
      // honor it just as the Gateway fetch reader does. SDK pull awaits read.
      options.abortSignal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
    } }),
  }) });
  const controller = new AbortController();
  const stream = new VercelGatewayProvider("vendor/model").streamTextOnce("hello", { abortSignal: controller.signal });
  await stream.next();
  const pending = stream.next();
  controller.abort();
  await expect(pending).rejects.toMatchObject({ kind: "timeout" });
  await stream.return(undefined);
});

it("does not let the installed SDK log raw upstream error details", async () => {
  injected.model = new MockLanguageModelV3({doStream: async () => ({
    stream: new ReadableStream({start(controller) {
      controller.enqueue({type: "error", error: {statusCode: 403, message: "private upstream body"}});
      controller.close();
    }}),
  })});
  const logging = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await expect(new VercelGatewayProvider("vendor/model").streamTextOnce("hello").next()).rejects.toMatchObject({kind: "model_unavailable"});
    expect(logging).not.toHaveBeenCalled();
  } finally { logging.mockRestore(); }
});

it.each(['{"message":"review draft"}', 'Untrusted prose before {"message":"not accepted"}'])("requests JSON output without losing terminal paid evidence for %s",async text=>{
 const model=new MockLanguageModelV3({doStream:async()=>({stream:new ReadableStream({start(controller){
 controller.enqueue({type:"text-start",id:"json"});controller.enqueue({type:"text-delta",id:"json",delta:text});controller.enqueue({type:"text-end",id:"json"});
 controller.enqueue({type:"finish",finishReason:{unified:"stop",raw:undefined},usage:{inputTokens:{total:4,noCache:4,cacheRead:undefined,cacheWrite:undefined},outputTokens:{total:2,text:2,reasoning:undefined}},providerMetadata:{gateway:{generationId:"gen_json_contract"}}});controller.close();}})})});injected.model=model;
 const chunks=[];for await(const chunk of new VercelGatewayProvider("vendor/model").streamTextOnce("Return JSON",undefined,"json"))chunks.push(chunk);
 expect(model.doStreamCalls).toHaveLength(1);expect(model.doStreamCalls[0].responseFormat).toMatchObject({type:"json"});
 expect(chunks.at(-1)).toMatchObject({done:true,response:{gatewayGenerationId:"gen_json_contract",usage:{totalTokens:6}}});
});
