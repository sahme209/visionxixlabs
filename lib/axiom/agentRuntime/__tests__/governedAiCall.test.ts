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

  it("quotes the complete Grok payload only after existing policy checks",async()=>{
    const grok="spacexai/grok-4.20-multi-agent";
    m.policy.mockReturnValue({enabled:true,allowedProviders:["vercel_gateway"],modelSelections:{vercel_gateway:grok},fallbackOrder:["vercel_gateway"]});m.catalog.mockResolvedValue([{id:grok}]);
    const governed=await resolveGovernedAiCall("org",undefined,"trusted-actor");if(!governed.ok)throw Error("fixture unavailable");
    await governed.extract("complete prompt","complete schema","grok:0");
    expect(m.admission).toHaveBeenCalledWith({organizationId:"org",userId:"trusted-actor",correlationId:"grok:0"},{model:grok,text:"complete prompt",schemaHint:"complete schema"},undefined);
  });

});
