import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ credit: vi.fn(), load: vi.fn(), policy: vi.fn(), admission: vi.fn(), extract: vi.fn(), stream: vi.fn(), catalog: vi.fn() }));
vi.mock("@/lib/ai/AIProviderManager", () => ({ getAIProviderManager: () => ({ status: () => [{ configured: true, provider: "vercel_gateway" }], isServiceProviderAvailable: (provider: string) => provider === "vercel_gateway", extractStructuredDataWithAdmission: m.extract, extractStructuredDataStreamingWithAdmission: m.stream }) }));
vi.mock("@/lib/ai/workspaceProviderPolicy", () => ({ loadWorkspaceAIProviderPolicyWithState: m.load, resolveWorkspaceAIProviderPolicy: m.policy }));
vi.mock("@/lib/billing/checkWorkspaceAICredits", () => ({ checkWorkspaceAICredits: m.credit }));
vi.mock("@/lib/billing/governedExtractAdmission", () => ({ admitGovernedExtract: m.admission }));
vi.mock("@/lib/ai/gatewayModelCatalog", async original => ({ ...await original<typeof import("@/lib/ai/gatewayModelCatalog")>(), loadGatewayModelCatalog: m.catalog }));
vi.mock("../agentIdentityPolicy", () => ({ readWorkspaceAgentIdentity: async () => ({ enabled: true, allowedTools: ["list_environments"] }) }));
import { resolveGovernedAiCall } from "../governedAiCall";

describe("governed extraction per-call admission", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.credit.mockResolvedValue({ kind: "allow" }); m.load.mockResolvedValue({ storageState: "ready", policy: {} });
    m.policy.mockReturnValue({ enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: "vendor/model" }, fallbackOrder: ["vercel_gateway"] });
    m.admission.mockImplementation(async scope => ({ scope }));
    m.catalog.mockResolvedValue([{ id: "vendor/model" }]);
    m.extract.mockResolvedValue({ data: { action: "respond" }, usage: { promptTokens: 1, completionTokens: 1 } });
  });
  it.each([false,true])("passes exact approved55 payload into its distinct admission and bounded output (stream=%s)",async streaming=>{
    const model="anthropic/claude-sonnet-5.5";
    m.policy.mockReturnValue({enabled:true,allowedProviders:["vercel_gateway"],modelSelections:{vercel_gateway:model},fallbackOrder:["vercel_gateway"]});m.catalog.mockResolvedValue([{id:model}]);m.stream.mockResolvedValue({data:{message:"bounded"},usage:{}});
    const options=streaming?{abortSignal:new AbortController().signal,onDraft:vi.fn()}:undefined;
    const governed=await resolveGovernedAiCall("org","vercel_gateway","trusted-actor",undefined,options);if(!governed.ok)throw Error("fixture unavailable");await governed.extract("short prompt","schema","request:55");
    expect(m.admission).toHaveBeenCalledWith({organizationId:"org",userId:"trusted-actor",correlationId:"request:55"},{model,text:"short prompt",schemaHint:"schema"},options?.abortSignal);
    expect((streaming?m.stream:m.extract).mock.calls[0][2]).toMatchObject({model,maxTokens:4096});expect(m.admission).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])("rejects oversized non-Sonnet context before admission (stream=%s)", async streaming => {
    const governed = await resolveGovernedAiCall("org", undefined, "trusted-actor", undefined, streaming ? { abortSignal: new AbortController().signal, onDraft: vi.fn() } : undefined);
    if (!governed.ok) throw new Error("fixture unavailable");
    await expect(governed.extract("🙂".repeat(32769), "schema", "request:0")).rejects.toThrow();
    expect(m.admission).not.toHaveBeenCalled();
    expect(m.extract).not.toHaveBeenCalled();
    expect(m.stream).not.toHaveBeenCalled();
  });
  it("requires the trusted actor and reserves each iteration and repair independently", async () => {
    const governed = await resolveGovernedAiCall("org", undefined, "trusted-actor");
    if (!governed.ok) throw new Error("fixture unavailable");
    await governed.extract("prompt", "schema", "request:0");
    await governed.extract("repair", "schema", "request:0:repair");
    expect(m.admission.mock.calls).toEqual([[{ organizationId: "org", userId: "trusted-actor", correlationId: "request:0" }], [{ organizationId: "org", userId: "trusted-actor", correlationId: "request:0:repair" }]]);
    expect(m.extract).toHaveBeenCalledTimes(2);
    expect(m.extract.mock.calls.every(call => call[2].maxTokens === 4096)).toBe(true);
    expect(m.admission.mock.invocationCallOrder[0]).toBeLessThan(m.extract.mock.invocationCallOrder[0]);
  });
  it("denied admission and a missing actor never dispatch", async () => {
    await expect(resolveGovernedAiCall("org", undefined, "")).resolves.toMatchObject({ ok: false });
    expect(m.credit).not.toHaveBeenCalled();
    const governed = await resolveGovernedAiCall("org", undefined, "trusted-actor");
    if (!governed.ok) throw new Error("fixture unavailable");
    m.admission.mockRejectedValue(new Error("reused or uncertain"));
    await expect(governed.extract("prompt", "schema", "request:0")).rejects.toThrow();
    expect(m.extract).not.toHaveBeenCalled();
  });
  it("uses the same policy-bound extraction admission for the streaming manager", async () => {
    const streaming = { abortSignal: new AbortController().signal, onDraft: vi.fn() };
    const governed = await resolveGovernedAiCall("org", undefined, "trusted-actor", undefined, streaming);
    if (!governed.ok) throw new Error("fixture unavailable");
    m.stream.mockResolvedValue({ data: { action: "respond" }, usage: {} });
    await governed.extract("prompt", "schema", "request:0");
    expect(m.stream).toHaveBeenCalledWith("prompt", "schema", expect.objectContaining({ organizationId: "org", maxTokens: 4096, abortSignal: streaming.abortSignal }), expect.anything(), streaming.onDraft);
    expect(m.extract).not.toHaveBeenCalled();
  });
  it("classifies uncertain or denied streaming admission as non-repairable", async () => {
    const governed = await resolveGovernedAiCall("org", undefined, "trusted-actor", undefined, { abortSignal: new AbortController().signal, onDraft: () => undefined });
    if (!governed.ok) throw new Error("fixture unavailable");
    m.admission.mockRejectedValue(new Error("claim response lost"));
    await expect(governed.extract("prompt", "schema", "request:0")).rejects.toMatchObject({ name: "AgentStreamInterrupted" });
    expect(m.admission).toHaveBeenCalledOnce(); expect(m.stream).not.toHaveBeenCalled();
  });

  it.each([false, true])("actual decision loop makes no paid repair after uncertain claim (streaming=%s)", async streaming => {
    const { runDecisionLoop } = await import("../decisionLoop");
    m.admission.mockRejectedValue(new Error("claim response lost"));
    const execute = vi.fn();
    await expect(runDecisionLoop({ organizationId: "org", userId: "trusted-actor", correlationId: "request", transcript: [{ role: "user", content: "Inspect" }],
      executeReadOnlyTool: execute, isProdEnvironmentTarget: async () => false,
      ...(streaming ? { streaming: { abortSignal: new AbortController().signal, onDraft: () => undefined } } : {}),
    })).rejects.toMatchObject({ name: "AgentStreamInterrupted" });
    expect(m.admission).toHaveBeenCalledOnce(); expect(m.stream).not.toHaveBeenCalled(); expect(m.extract).not.toHaveBeenCalled(); expect(execute).not.toHaveBeenCalled();
  });

  it("rereads caller-specific authority after current model policy and before admission", async () => {
    const beforeAdmission=vi.fn().mockRejectedValue(new Error("membership revoked"));
    const governed=await resolveGovernedAiCall("org",undefined,"trusted-actor",undefined,{abortSignal:new AbortController().signal,onDraft:()=>{},beforeAdmission});
    if(!governed.ok)throw new Error("fixture unavailable");
    await expect(governed.extract("prompt","schema","request:0")).rejects.toThrow("membership revoked");
    expect(beforeAdmission).toHaveBeenCalledTimes(1);expect(m.admission).not.toHaveBeenCalled();expect(m.stream).not.toHaveBeenCalled();
  });

  it("refuses a revoked caller after delayed admission without consuming it or dispatching", async () => {
    const beforeAdmission=vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("source changed during admission"));
    const governed=await resolveGovernedAiCall("org",undefined,"trusted-actor",undefined,{abortSignal:new AbortController().signal,onDraft:()=>{},beforeAdmission});
    if(!governed.ok)throw new Error("fixture unavailable");
    await expect(governed.extract("prompt","schema","request:0")).rejects.toThrow("source changed during admission");
    expect(beforeAdmission).toHaveBeenCalledTimes(2);expect(m.admission).toHaveBeenCalledTimes(1);expect(m.stream).not.toHaveBeenCalled();expect(m.extract).not.toHaveBeenCalled();
  });

});
