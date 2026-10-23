import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ reserve: vi.fn(), claim: vi.fn(), write: vi.fn(), transaction: vi.fn(), extract: vi.fn(), ordinaryExtract: vi.fn(), text: vi.fn(), ordinaryText: vi.fn(), stream: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: m.transaction } }));
vi.mock("@/lib/billing/aiCreditReservation", () => ({ reserveAICredits: m.reserve, claimLegacyAICreditDispatch: m.claim }));
vi.mock("@/lib/billing/recordAIUsageEvent", () => ({ recordAIUsageEvent: m.write, recordReservedAIUsageEventV2: vi.fn() }));
vi.mock("../providers/VercelGatewayProvider", async importOriginal => ({ ...await importOriginal<typeof import("../providers/VercelGatewayProvider")>(), VercelGatewayProvider: class {
  name = "vercel_gateway";
  defaultModel = "vendor/model";
  isConfigured() { return true; }
  generateStructuredTextOnce = m.extract;
  extractStructuredData = m.ordinaryExtract;
  generateTextOnce = m.text;
  generateText = m.ordinaryText;
  streamTextOnce = m.stream;
} }));

import { AIProviderManager } from "../AIProviderManager";
import { admitAIText, admitGovernedExtract } from "@/lib/billing/governedExtractAdmission";

const scope = { organizationId: "org", userId: "member", correlationId: "request:0" };
const response = { provider: "vercel_gateway", model: "vendor/model", gatewayGenerationId: "generation", latencyMs: 1, text: '{"action":"respond"}', usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 } };
const structured = { provider: response.provider, model: response.model, gatewayGenerationId: response.gatewayGenerationId, latencyMs: 1, data: { action: "respond" }, raw: response.text, usage: response.usage };
describe("actual manager admitted extraction boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("AXIOM_GATEWAY_STRUCTURED_JSON_MODELS", "");
    m.reserve.mockResolvedValue({ ok: true, reused: false, reservation: { id: "hold" } });
    m.claim.mockResolvedValue(true);
    m.transaction.mockImplementation(async fn => fn({
      $queryRawUnsafe: vi.fn(async () => [{ id: "hold", organizationId: "org", status: "dispatch_unknown", usageEventId: null }]),
      usageEvent: { findUnique: vi.fn(async () => null), create: vi.fn() },
      aIUsageReservation: { updateMany: vi.fn(async () => ({ count: 1 })) },
    }));
    m.write.mockResolvedValue({ recorded: true, usageEventId: "usage", pendingSettlement: true });
    m.extract.mockResolvedValue(response);
    m.ordinaryExtract.mockResolvedValue(structured);
    m.text.mockResolvedValue(response); m.ordinaryText.mockResolvedValue(response);
  });
  it("dispatches once only after durable claim, with one ledger writer and no capability in SDK options", async () => {
    const mgr = new AIProviderManager();
    const capability = await admitGovernedExtract(scope);
    await expect(mgr.extractStructuredDataWithAdmission("prompt", "schema", scope, capability)).resolves.toEqual(structured);
    expect(m.extract).toHaveBeenCalledTimes(1); expect(m.write).toHaveBeenCalledTimes(1);
    expect(m.claim.mock.invocationCallOrder[0]).toBeLessThan(m.extract.mock.invocationCallOrder[0]);
    expect(m.extract.mock.calls[0][2]).toEqual({ ...scope, model: undefined });
    expect(m.write.mock.calls[0]).toHaveLength(2); // existing producer with the transactional create-only writer
    await expect(mgr.extractStructuredDataWithAdmission("prompt", "schema", scope, capability)).rejects.toThrow();
    expect(m.extract).toHaveBeenCalledTimes(1);
  });
  it("accounts for an invalid JSON envelope before parsing, with repair requiring a new hold", async () => {
    const mgr = new AIProviderManager();
    m.extract.mockResolvedValue({ ...response, text: "not JSON" });
    const capability = await admitGovernedExtract(scope);
    await expect(mgr.extractStructuredDataWithAdmission("prompt", "schema", scope, capability)).rejects.toThrow();
    expect(m.write).toHaveBeenCalledTimes(1);
    await expect(mgr.extractStructuredDataWithAdmission("repair", "schema", scope, capability)).rejects.toThrow();
    expect(m.extract).toHaveBeenCalledTimes(1);
    m.extract.mockResolvedValue({ ...response, gatewayGenerationId: "repair-generation" });
    const repairScope = { ...scope, correlationId: scope.correlationId + ":repair" };
    await mgr.extractStructuredDataWithAdmission("repair", "schema", repairScope, await admitGovernedExtract(repairScope));
    expect(m.reserve).toHaveBeenCalledTimes(2); expect(m.extract).toHaveBeenCalledTimes(2); expect(m.write).toHaveBeenCalledTimes(2);
  });
  it("forged, cross-tenant or scope-mismatched admissions cannot reach the SDK", async () => {
    const mgr = new AIProviderManager();
    await expect(mgr.extractStructuredDataWithAdmission("prompt", "schema", scope, {} as never)).rejects.toThrow();
    const capability = await admitGovernedExtract(scope);
    await expect(mgr.extractStructuredDataWithAdmission("prompt", "schema", { ...scope, organizationId: "foreign" }, capability)).rejects.toThrow();
    expect(m.extract).not.toHaveBeenCalled(); expect(m.write).not.toHaveBeenCalled();
  });
  it("a concurrent same-key replay cannot dispatch a second call", async () => {
    m.reserve.mockResolvedValueOnce({ ok: true, reused: false, reservation: { id: "hold" } }).mockResolvedValueOnce({ ok: true, reused: true, reservation: { id: "hold" } });
    const attempts = await Promise.allSettled([admitGovernedExtract(scope), admitGovernedExtract(scope)]);
    const accepted = attempts.filter((a): a is PromiseFulfilledResult<Awaited<ReturnType<typeof admitGovernedExtract>>> => a.status === "fulfilled");
    expect(accepted).toHaveLength(1);
    await new AIProviderManager().extractStructuredDataWithAdmission("prompt", "schema", scope, accepted[0].value);
    expect(m.claim).toHaveBeenCalledTimes(1); expect(m.extract).toHaveBeenCalledTimes(1); expect(m.write).toHaveBeenCalledTimes(1);
  });
  it.each(["sdk", "usage", "writer"])("%s uncertainty cannot redispatch or release a claimed hold", async kind => {
    const mgr = new AIProviderManager();
    if (kind === "sdk") m.extract.mockRejectedValue(new Error("unknown provider outcome"));
    if (kind === "usage") m.extract.mockResolvedValue({ ...response, usage: undefined });
    if (kind === "writer") m.write.mockResolvedValue({ recorded: false });
    const capability = await admitGovernedExtract(scope);
    await expect(mgr.extractStructuredDataWithAdmission("prompt", "schema", scope, capability)).rejects.toMatchObject({name: "AgentStreamInterrupted"});
    await expect(mgr.extractStructuredDataWithAdmission("prompt", "schema", scope, capability)).rejects.toThrow();
    expect(m.extract).toHaveBeenCalledTimes(1);
  });
  it("ordinary manager callers retain the existing eager writer without reservation flags", async () => {
    await expect(new AIProviderManager().extractStructuredData("prompt", "schema", scope)).resolves.toEqual(structured);
    expect(m.reserve).not.toHaveBeenCalled(); expect(m.claim).not.toHaveBeenCalled();
    expect(m.write).toHaveBeenCalledTimes(1); expect(m.write.mock.calls[0]).toHaveLength(1);
  });
  it("the generic admitted text lane dispatches once and writes once before returning data", async () => {
    const mgr = new AIProviderManager(), admitted = await admitAIText({ ...scope, idempotencyKey: "generic_request_123456" });
    if (!admitted.ok) throw new Error("expected admission");
    await expect(mgr.generateTextWithAdmission("prompt", scope, admitted.admission)).resolves.toEqual(response);
    expect(m.text).toHaveBeenCalledOnce(); expect(m.write).toHaveBeenCalledOnce();
    expect(m.write).toHaveBeenCalledWith(expect.objectContaining({ metadata: { route: "api/ai/generate" } }), expect.anything());
    expect(m.ordinaryText).not.toHaveBeenCalled(); expect(m.extract).not.toHaveBeenCalled();
    await expect(mgr.generateTextWithAdmission("prompt", scope, admitted.admission)).rejects.toThrow();
    expect(m.text).toHaveBeenCalledOnce();
  });
  it.each(["sdk", "usage", "writer"])("generic admitted text %s failure does not allow redispatch", async kind => {
    const mgr = new AIProviderManager(), admitted = await admitAIText({ ...scope, idempotencyKey: "generic_request_123456" });
    if (!admitted.ok) throw new Error("expected admission");
    if (kind === "sdk") m.text.mockRejectedValue(new Error("unknown outcome"));
    if (kind === "usage") m.text.mockResolvedValue({ ...response, usage: undefined });
    if (kind === "writer") m.write.mockResolvedValue({ recorded: false });
    await expect(mgr.generateTextWithAdmission("prompt", scope, admitted.admission)).rejects.toThrow();
    await expect(mgr.generateTextWithAdmission("prompt", scope, admitted.admission)).rejects.toThrow();
    expect(m.text).toHaveBeenCalledOnce();
  });
  it("ordinary text generation remains unrelated to the admitted route's accounting", async () => {
    await expect(new AIProviderManager().generateText("prompt", scope)).resolves.toEqual(response);
    expect(m.reserve).not.toHaveBeenCalled(); expect(m.claim).not.toHaveBeenCalled(); expect(m.write).not.toHaveBeenCalled();
    expect(m.ordinaryText).toHaveBeenCalledOnce(); expect(m.text).not.toHaveBeenCalled();
  });
  it("streams partial display text but awaits durable accounting before completion", async () => {
    const admitted = await admitAIText({ ...scope, idempotencyKey: "stream_request_123456" });
    if (!admitted.ok) throw new Error("expected admission");
    m.stream.mockImplementation(async function* () {
      yield { text: "partial", done: false };
      yield { text: "", done: true, response: { ...response, finishReason: "stop" } };
    });
    const manager = new AIProviderManager();
    const stream = manager.streamTextWithAdmission("prompt", scope, admitted.admission);
    expect((await stream.next()).value).toEqual({ text: "partial", done: false });
    expect(m.write).not.toHaveBeenCalled();
    expect((await stream.next()).value).toEqual({ text: "", done: true, finishReason: "stop" });
    expect(m.write).toHaveBeenCalledOnce();
    await expect(manager.streamTextWithAdmission("prompt", scope, admitted.admission).next()).rejects.toThrow();
    expect(m.stream).toHaveBeenCalledOnce();
    expect(m.ordinaryText).not.toHaveBeenCalled();
  });
  it.each(["disconnect", "writer", "provider"])("stream %s retains the consumed claim without success or redispatch", async failure => {
    const admitted = await admitAIText({ ...scope, idempotencyKey: "stream_request_123456" });
    if (!admitted.ok) throw new Error("expected admission");
    const closed = vi.fn();
    m.stream.mockImplementation(async function* () {
      try {
        yield { text: "partial", done: false };
        if (failure === "provider") throw new Error("uncertain stream");
        yield { text: "", done: true, response: { ...response, finishReason: "stop" } };
      } finally { closed(); }
    });
    if (failure === "writer") m.write.mockResolvedValue({ recorded: false });
    const manager = new AIProviderManager();
    const stream = manager.streamTextWithAdmission("prompt", scope, admitted.admission);
    await stream.next();
    if (failure === "disconnect") await stream.return(undefined);
    else await expect(stream.next()).rejects.toThrow();
    expect(closed).toHaveBeenCalledOnce();
    await expect(manager.streamTextWithAdmission("prompt", scope, admitted.admission).next()).rejects.toThrow();
    expect(m.stream).toHaveBeenCalledOnce();
    if (failure !== "writer") expect(m.write).not.toHaveBeenCalled();
  });

  it("streams only message drafts, then links usage before parsing an executable decision", async () => {
    const capability = await admitGovernedExtract(scope);
    const drafts: string[] = [];
    m.stream.mockImplementation(async function* () {
      yield { done: false, text: '{"message":"Visible draft","action":"call_tool","args":{"private":"not a draft"},"toolName":"commit_github_file"}' };
      expect(m.write).not.toHaveBeenCalled();
      yield { done: true, text: "", response: { ...response, finishReason: "stop" } };
    });
    const result = await new AIProviderManager().extractStructuredDataStreamingWithAdmission("prompt", "schema", scope, capability, text => drafts.push(text));
    expect(drafts).toEqual(["", "Visible draft"]);
    expect(result.data).toMatchObject({ action: "call_tool", toolName: "commit_github_file" });
    expect(m.write).toHaveBeenCalledOnce();
    expect(m.stream.mock.calls[0][1]).toMatchObject({ system: "Return valid JSON only. The required shape is: schema" });
    expect(m.stream.mock.calls[0][2]).toBeUndefined();
  });
  it.each([
    ["vendor/model", "json"],
    [" other/model, vendor/model ", "json"],
    ["other/model", undefined],
    ["*", undefined],
    ["vendor/model-extra", undefined],
    ["x".repeat(4097) + ",vendor/model", undefined],
  ])("uses JSON mode only for an exact bounded server opt-in: %s", async (configured, expected) => {
    vi.stubEnv("AXIOM_GATEWAY_STRUCTURED_JSON_MODELS", configured);
    m.stream.mockImplementation(async function* () {
      yield { done: false, text: response.text };
      yield { done: true, text: "", response: { ...response, finishReason: "stop" } };
    });
    await new AIProviderManager().extractStructuredDataStreamingWithAdmission("prompt", "schema", scope, await admitGovernedExtract(scope), () => {});
    expect(m.stream.mock.calls[0][2]).toBe(expected);
    expect(m.stream).toHaveBeenCalledOnce();
    expect(m.write).toHaveBeenCalledOnce();
  });
  it.each([["vendor/model", "json"], ["service-default", undefined], ["other/model", undefined]])("resolves service-default before JSON opt-in: %s", async (configured, expected) => {
    vi.stubEnv("AXIOM_GATEWAY_STRUCTURED_JSON_MODELS", configured);
    const selected = { ...scope, modelSelections: { vercel_gateway: "service-default" } };
    m.stream.mockImplementation(async function* () {
      yield { done: false, text: response.text };
      yield { done: true, text: "", response: { ...response, finishReason: "stop" } };
    });
    await new AIProviderManager().extractStructuredDataStreamingWithAdmission("prompt", "schema", selected, await admitGovernedExtract(selected), () => {});
    expect(m.stream.mock.calls[0][2]).toBe(expected);
  });
  it("does not retry or fall back when an opted-in model rejects JSON mode", async () => {
    vi.stubEnv("AXIOM_GATEWAY_STRUCTURED_JSON_MODELS", "vendor/model");
    m.stream.mockImplementation(async function* () { throw new Error("unsupported response format"); });
    await expect(new AIProviderManager().extractStructuredDataStreamingWithAdmission("prompt", "schema", scope, await admitGovernedExtract(scope), () => {})).rejects.toThrow();
    expect(m.stream).toHaveBeenCalledOnce();
    expect(m.write).not.toHaveBeenCalled();
    expect(m.extract).not.toHaveBeenCalled();
    expect(m.ordinaryExtract).not.toHaveBeenCalled();
  });
  it.each(["stream", "writer"])("streamed extraction %s uncertainty cannot authorize a repair", async failure => {
    const capability = await admitGovernedExtract(scope);
    m.stream.mockImplementation(async function* () {
      yield { done: false, text: '{"message":"partial' };
      if (failure === "stream") throw new Error("unknown");
      yield { done: true, text: "", response: { ...response, finishReason: "stop" } };
    });
    if (failure === "writer") m.write.mockResolvedValue({ recorded: false });
    await expect(new AIProviderManager().extractStructuredDataStreamingWithAdmission("prompt", "schema", scope, capability, () => undefined)).rejects.toMatchObject({ name: "AgentStreamInterrupted" });
    expect(m.stream).toHaveBeenCalledOnce();
  });
  it("accounts a complete malformed streamed JSON envelope before allowing separate repair", async () => {
    const capability = await admitGovernedExtract(scope);
    m.stream.mockImplementation(async function* () {
      yield { done: false, text: "not JSON" };
      yield { done: true, text: "", response: { ...response, finishReason: "stop" } };
    });
    await expect(new AIProviderManager().extractStructuredDataStreamingWithAdmission("prompt", "schema", scope, capability, () => undefined)).rejects.toBeInstanceOf(SyntaxError);
    expect(m.write).toHaveBeenCalledOnce();
  });

  it("cannot repair or dispatch with a forged streaming capability", async () => {
    await expect(new AIProviderManager().extractStructuredDataStreamingWithAdmission("prompt", "schema", scope, {} as never, () => undefined)).rejects.toMatchObject({ name: "AgentStreamInterrupted" });
    expect(m.stream).not.toHaveBeenCalled(); expect(m.write).not.toHaveBeenCalled();
  });
  it("a failed draft sink after claim is non-repairable and does not dispatch", async () => {
    const capability = await admitGovernedExtract(scope);
    await expect(new AIProviderManager().extractStructuredDataStreamingWithAdmission("prompt", "schema", scope, capability, () => { throw new Error("reader closed"); })).rejects.toMatchObject({ name: "AgentStreamInterrupted" });
    expect(m.stream).not.toHaveBeenCalled(); expect(m.write).not.toHaveBeenCalled();
  });

});
