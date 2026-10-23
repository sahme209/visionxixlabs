import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ generate: vi.fn(), stream: vi.fn(), reserve: vi.fn(), claim: vi.fn(), transaction: vi.fn(), write: vi.fn() }));
vi.mock("ai", () => ({ generateText: m.generate, streamText: m.stream }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: m.transaction } }));
vi.mock("@/lib/billing/aiCreditReservation", () => ({ reserveAICredits: m.reserve, claimLegacyAICreditDispatch: m.claim }));
vi.mock("@/lib/billing/recordAIUsageEvent", () => ({ recordAIUsageEvent: m.write, recordReservedAIUsageEventV2: vi.fn() }));
import { AIProviderManager } from "../AIProviderManager";
import { admitGovernedExtract } from "@/lib/billing/governedExtractAdmission";
import { smallSonnetPricingFixture } from "@/lib/billing/__tests__/fixtures/smallSonnetPricing";
const scope = { organizationId: "org", userId: "owner", correlationId: "request:0" };
const model = "anthropic/claude-sonnet-5";
const request = { model, text: "List environments", schemaHint: "{action:string,message:string}" };
const options = { ...scope, allowedProviders: ["vercel_gateway"] as const, modelSelections: { vercel_gateway: model }, only: "vercel_gateway" as const, model, maxTokens: 4096 };
const text = JSON.stringify({ action: "respond", message: "Synthetic accounted answer" });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "axiom_public_anniversary_v1"); vi.stubEnv("AXIOM_AI_MAX_REQUEST_CREDITS_CENTS", "");
  vi.stubEnv("AI_GATEWAY_API_KEY", "synthetic-key"); vi.stubEnv("AI_GATEWAY_MODEL", model); vi.stubEnv("AXIOM_GATEWAY_STRUCTURED_JSON_MODELS", model);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(smallSonnetPricingFixture()))));
  m.reserve.mockResolvedValue({ ok: true, reused: false, smallRequestApplied: true, reservation: { id: "hold" }, allocationPolicy: "axiom_public_anniversary_v1" });
  m.claim.mockResolvedValue(true);
  m.transaction.mockImplementation(async fn => fn({ $queryRawUnsafe: vi.fn(async () => [{ id: "hold", organizationId: "org", status: "dispatch_unknown", usageEventId: null }]), usageEvent: { findUnique: vi.fn(async () => null) }, aIUsageReservation: { updateMany: vi.fn(async () => ({ count: 1 })) } }));
  m.write.mockResolvedValue({ recorded: true, usageEventId: "usage", pendingSettlement: true });
  m.generate.mockResolvedValue({ text, finishReason: "stop", usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 }, providerMetadata: { gateway: { generationId: "synthetic-generation" } } });
  m.stream.mockReturnValue({ fullStream: (async function* () { yield { type: "text-delta", text }; yield { type: "finish", finishReason: "stop" }; })(), totalUsage: Promise.resolve({ inputTokens: 5, outputTokens: 2, totalTokens: 7 }), providerMetadata: Promise.resolve({ gateway: { generationId: "synthetic-generation" } }) });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it.each([false, true])("actual admission/manager/provider binds the small route to one accounted inert-SDK call (streaming=%s)", async streaming => {
  const admission = await admitGovernedExtract(scope, request), manager = new AIProviderManager();
  const result = streaming
    ? await manager.extractStructuredDataStreamingWithAdmission(request.text, request.schemaHint, options, admission, () => {})
    : await manager.extractStructuredDataWithAdmission(request.text, request.schemaHint, options, admission);
  expect(result.data).toEqual({ action: "respond", message: "Synthetic accounted answer" });
  const sdk = streaming ? m.stream : m.generate;
  expect(sdk).toHaveBeenCalledOnce();
  expect(sdk.mock.calls[0][0]).toMatchObject({ model, prompt: request.text, maxOutputTokens: 4096, maxRetries: 0, providerOptions: { gateway: { only: ["anthropic"], user: "org" }, anthropic: { thinking: { type: "disabled" } } } });
  expect(sdk.mock.calls[0][0].tools).toBeUndefined(); expect(sdk.mock.calls[0][0].output).toBeUndefined();
  expect(m.reserve.mock.calls[0][1].reservedCents).toBe(36); expect(m.claim).toHaveBeenCalledOnce(); expect(m.write).toHaveBeenCalledOnce();
  expect(m.write.mock.calls[0][0].metadata.reservationPolicy).toMatchObject({ policy: "small_sonnet_free_v2", reservedCents: 36, maximumPayloadBytes: 8192, maximumOutputTokens: 4096, pricingDigest: expect.stringMatching(/^[a-f0-9]{64}$/) });
  expect(JSON.stringify(m.write.mock.calls[0][0].metadata)).not.toContain(request.text);
  expect(m.claim.mock.invocationCallOrder[0]).toBeLessThan(sdk.mock.invocationCallOrder[0]);
  await expect(manager.extractStructuredDataWithAdmission(request.text, request.schemaHint, options, admission)).rejects.toMatchObject({ name: "AgentStreamInterrupted" });
  expect(sdk).toHaveBeenCalledOnce();
});
it.each(["prompt", "schema", "model", "output", "tenant", "correlation"])("refuses changed %s before the SDK and retains the uncertain hold", async kind => {
  const admission = await admitGovernedExtract(scope, request), manager = new AIProviderManager();
  const changed = { ...options }, payload = { ...request };
  if (kind === "prompt") payload.text = "changed";
  if (kind === "schema") payload.schemaHint = "changed";
  if (kind === "model") changed.model = "other/model";
  if (kind === "output") changed.maxTokens = 4095;
  if (kind === "tenant") changed.organizationId = "foreign";
  if (kind === "correlation") changed.correlationId = "other";
  await expect(manager.extractStructuredDataWithAdmission(payload.text, payload.schemaHint, changed, admission)).rejects.toMatchObject({ name: "AgentStreamInterrupted" });
  expect(m.generate).not.toHaveBeenCalled(); expect(m.stream).not.toHaveBeenCalled(); expect(m.write).not.toHaveBeenCalled();
});

it.each([false,true])("bounded Grok keeps xAI-only routing, output cap, no native tools and one accounted call (stream=%s)",async streaming=>{
 const fixture=await import("@/lib/billing/__tests__/fixtures/grokPricing20261023.json");
 vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify(fixture.default))));
 const grok="spacexai/grok-4.20-multi-agent";
 const payload={...request,model:grok};const configured={...options,maxTokens:1024,model:grok,modelSelections:{vercel_gateway:grok}};
 const admission=await admitGovernedExtract(scope,payload),manager=new AIProviderManager();
 const result=streaming?await manager.extractStructuredDataStreamingWithAdmission(payload.text,payload.schemaHint,configured,admission,()=>{}):await manager.extractStructuredDataWithAdmission(payload.text,payload.schemaHint,configured,admission);
 expect(result.data).toMatchObject({action:"respond"});
 const sdk=streaming?m.stream:m.generate;expect(sdk).toHaveBeenCalledOnce();
 expect(sdk.mock.calls[0][0]).toMatchObject({model:grok,maxOutputTokens:1024,maxRetries:0,providerOptions:{gateway:{only:["xai"]}}});
 expect(sdk.mock.calls[0][0].providerOptions.anthropic).toBeUndefined();expect(sdk.mock.calls[0][0].tools).toBeUndefined();expect(sdk.mock.calls[0][0].output).toBeUndefined();
 expect(m.reserve.mock.calls[0][1].reservedCents).toBeLessThanOrEqual(100);expect(m.claim).toHaveBeenCalledOnce();expect(m.write).toHaveBeenCalledOnce();
 expect(m.write.mock.calls[0][0].metadata.reservationPolicy).toMatchObject({policy:"small_grok_free_v1",model:grok});
 await expect(manager.extractStructuredDataWithAdmission(payload.text,payload.schemaHint,configured,admission)).rejects.toMatchObject({name:"AgentStreamInterrupted"});expect(sdk).toHaveBeenCalledOnce();
});
