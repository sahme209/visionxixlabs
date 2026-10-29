import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ load: vi.fn(), catalog: vi.fn(), status: vi.fn(), available: vi.fn(), credit: vi.fn(), admission: vi.fn(), extract: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: new Proxy({}, { get() { throw new Error("inert_model_dispatch_no_database"); } }) }));
vi.mock("@/lib/ai/AIProviderManager", () => ({ getAIProviderManager: () => ({ status: m.status, isServiceProviderAvailable: m.available, extractStructuredDataWithAdmission: m.extract }) }));
vi.mock("@/lib/ai/workspaceProviderPolicy", async original => ({ ...await original<typeof import("@/lib/ai/workspaceProviderPolicy")>(), loadWorkspaceAIProviderPolicyWithState: m.load }));
vi.mock("@/lib/ai/gatewayModelCatalog", async original => ({ ...await original<typeof import("@/lib/ai/gatewayModelCatalog")>(), loadGatewayModelCatalog: m.catalog }));
vi.mock("@/lib/billing/checkWorkspaceAICredits", () => ({ checkWorkspaceAICredits: m.credit }));
vi.mock("@/lib/billing/governedExtractAdmission", () => ({ admitGovernedExtract: m.admission }));
vi.mock("../agentIdentityPolicy", () => ({ readWorkspaceAgentIdentity: async () => ({ enabled: true, allowedTools: [] }) }));

import { resolveGovernedAiCall } from "../governedAiCall";
import { GovernedAiCallRefusal } from "../governedAiCallRefusal";
import { runDecisionLoop } from "../decisionLoop";
import type { WorkspaceAIProviderPolicy } from "@/lib/ai/workspaceProviderPolicy";

const policy = (): WorkspaceAIProviderPolicy => ({ enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: "vendor/default" }, fallbackOrder: ["vercel_gateway"], gatewaySelection: { version: 1, defaultModelId: "vendor/default", approvedModelIds: ["vendor/default", "vendor/alternative"] } });
const ready = (value = policy()) => ({ storageState: "ready", policy: value });
async function resolved(model: string | undefined = "vendor/alternative", provider: string | undefined = "vercel_gateway") {
  const result = await resolveGovernedAiCall("tenant", provider, "trusted-actor", model);
  if (!result.ok) throw new Error("expected_governed_fixture");
  return result;
}
describe("approved model dispatch (actual policy/resolver/loop, inert IO ports)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.credit.mockResolvedValue({ kind: "allow" }); m.load.mockResolvedValue(ready());
    m.status.mockReturnValue([{ provider: "vercel_gateway", configured: true }]);
    m.available.mockReturnValue(true);
    m.catalog.mockResolvedValue([{ id: "vendor/default" }, { id: "vendor/alternative" }]);
    m.admission.mockResolvedValue(Object.freeze({}));
    m.extract.mockResolvedValue({ data: { action: "respond", message: "Ready" }, usage: { promptTokens: 1, completionTokens: 1 } });
  });
  it("dispatches an explicitly approved nondefault model with existing immutable actor/admission limits", async () => {
    const governed = await resolved();
    await governed.extract("prompt", "schema", "request:0");
    expect(m.extract).toHaveBeenCalledWith("prompt", "schema", expect.objectContaining({ organizationId: "tenant", only: "vercel_gateway", model: "vendor/alternative", maxTokens: 4096, allowedProviders: ["vercel_gateway"] }), expect.anything());
    expect(m.admission).toHaveBeenCalledWith({ organizationId: "tenant", userId: "trusted-actor", correlationId: "request:0" });
    expect(m.catalog).toHaveBeenCalledWith({ freshness: "current" });
    expect(m.catalog).toHaveBeenCalledTimes(2); expect(m.load).toHaveBeenCalledTimes(2); expect(m.status).toHaveBeenCalledTimes(2);
  });
  it.each(["spacexai/grok-4.20-multi-agent", "xai/grok-4.20-multi-agent"])("refuses the live-unverified multi-agent output budget before reserving or dispatching %s",async model=>{
    const value=policy();value.modelSelections.vercel_gateway=model;value.gatewaySelection={version:1,defaultModelId:model,approvedModelIds:[model]};m.load.mockResolvedValue(ready(value));m.catalog.mockResolvedValue([{id:model}]);
    expect(await resolveGovernedAiCall("tenant","vercel_gateway","actor",model)).toEqual({ok:false,error:"workspace_ai_output_bound_unverified"});
    expect(await resolveGovernedAiCall("tenant",undefined,"actor")).toEqual({ok:false,error:"workspace_ai_output_bound_unverified"});
    expect(m.admission).not.toHaveBeenCalled();expect(m.extract).not.toHaveBeenCalled();
  });
  it.each(["service-default", undefined])("refuses unsupported effective managed default (%s) before holds", async selection => {
    const legacy = policy(); delete legacy.gatewaySelection;
    if (selection === undefined) delete legacy.modelSelections.vercel_gateway;
    else legacy.modelSelections.vercel_gateway = selection;
    m.load.mockResolvedValue(ready(legacy));
    m.status.mockReturnValue([{ provider: "vercel_gateway", configured: true, defaultModel: "spacexai/grok-4.20-multi-agent" }]);
    expect(await resolveGovernedAiCall("tenant", undefined, "actor")).toEqual({ ok: false, error: "workspace_ai_output_bound_unverified" });
    expect(m.admission).not.toHaveBeenCalled(); expect(m.extract).not.toHaveBeenCalled();
  });
  it.each([undefined, "", "service-default"])("refuses unverifiable actual default %s before admission", async defaultModel => {
    const legacy = policy(); delete legacy.gatewaySelection; legacy.modelSelections.vercel_gateway = "service-default";
    m.load.mockResolvedValue(ready(legacy)); m.status.mockReturnValue([{ provider: "vercel_gateway", configured: true, defaultModel }]);
    expect(await resolveGovernedAiCall("tenant", undefined, "actor")).toEqual({ ok: false, error: "workspace_ai_output_bound_unverified" });
    expect(m.admission).not.toHaveBeenCalled(); expect(m.extract).not.toHaveBeenCalled();
  });
  it.each([undefined, "", "service-default"])("rechecks unverifiable actual default %s before extract admission", async defaultModel => {
    const legacy = policy(); delete legacy.gatewaySelection; legacy.modelSelections.vercel_gateway = "service-default";
    m.load.mockResolvedValue(ready(legacy)); m.status.mockReturnValue([{ provider: "vercel_gateway", configured: true, defaultModel: "vendor/safe" }]);
    const governed = await resolveGovernedAiCall("tenant", undefined, "actor"); if (!governed.ok) throw Error("expected safe default");
    m.status.mockReturnValue([{ provider: "vercel_gateway", configured: true, defaultModel }]);
    await expect(governed.extract("prompt", "schema", "request:missing")).rejects.toMatchObject({ code: "workspace_ai_output_bound_unverified" });
    expect(m.admission).not.toHaveBeenCalled(); expect(m.extract).not.toHaveBeenCalled();
  });
  it("pins the verified managed default across admission", async () => {
    const legacy = policy(); delete legacy.gatewaySelection; legacy.modelSelections.vercel_gateway = "service-default";
    m.load.mockResolvedValue(ready(legacy)); m.status.mockReturnValue([{ provider: "vercel_gateway", configured: true, defaultModel: "vendor/safe" }]);
    const governed = await resolveGovernedAiCall("tenant", undefined, "actor"); if (!governed.ok) throw Error("expected safe default");
    m.admission.mockImplementation(async () => { m.status.mockReturnValue([{ provider: "vercel_gateway", configured: true, defaultModel: "xai/grok-4.20-multi-agent" }]); return Object.freeze({}); });
    await governed.extract("prompt", "schema", "request:pin"); expect(m.extract.mock.calls[0][2].model).toBe("vendor/safe");
  });
  it("honors an approved concrete selection over an unsupported configured default", async () => {
    m.status.mockReturnValue([{ provider: "vercel_gateway", configured: true, defaultModel: "spacexai/grok-4.20-multi-agent" }]);
    const governed = await resolved();
    await governed.extract("prompt", "schema", "request:concrete");
    expect(m.extract.mock.calls[0][2]).toMatchObject({ model: "vendor/alternative" });
  });
  it("rechecks an unsupported effective server default before each managed extract", async () => {
    const legacy = policy(); delete legacy.gatewaySelection; legacy.modelSelections.vercel_gateway = "service-default";
    m.load.mockResolvedValue(ready(legacy));
    m.status.mockReturnValue([{ provider: "vercel_gateway", configured: true, defaultModel: "vendor/default" }]);
    const governed = await resolveGovernedAiCall("tenant", undefined, "actor");
    if (!governed.ok) throw Error("expected managed default");
    m.status.mockReturnValue([{ provider: "vercel_gateway", configured: true, defaultModel: "xai/grok-4.20-multi-agent" }]);
    await expect(governed.extract("prompt", "schema", "refused:managed")).rejects.toMatchObject({ code: "workspace_ai_output_bound_unverified" });
    expect(m.admission).not.toHaveBeenCalled(); expect(m.extract).not.toHaveBeenCalled();
  });
  it("rechecks a changed default before the first hold or model request",async()=>{
    const governed=await resolveGovernedAiCall("tenant",undefined,"actor");if(!governed.ok)throw Error("fixture unavailable");const model="spacexai/grok-4.20-multi-agent";const next=policy();next.modelSelections.vercel_gateway=model;next.gatewaySelection={version:1,defaultModelId:model,approvedModelIds:[model]};m.load.mockResolvedValue(ready(next));
    await expect(governed.extract("prompt","schema","refused:0")).rejects.toMatchObject({name:"GovernedAiCallRefusal",code:"workspace_ai_output_bound_unverified"});expect(m.admission).not.toHaveBeenCalled();expect(m.extract).not.toHaveBeenCalled();
  });
  it("preserves the current Grok catalog ID through policy admission and revocation", async () => {
    const model = "spacexai/grok-4.1-fast-non-reasoning";
    const value = policy();
    value.gatewaySelection = { ...value.gatewaySelection!, approvedModelIds: [...value.gatewaySelection!.approvedModelIds, model] };
    m.load.mockResolvedValue(ready(value));
    m.catalog.mockResolvedValue([{ id: "vendor/default" }, { id: model }]);
    const governed = await resolved(model);
    await governed.extract("prompt", "schema", "request:grok");
    expect(m.extract.mock.calls[0][2]).toMatchObject({ only: "vercel_gateway", model });
    expect(m.admission).toHaveBeenCalledWith({ organizationId: "tenant", userId: "trusted-actor", correlationId: "request:grok" });
    m.load.mockResolvedValue(ready(policy()));
    await expect(governed.extract("next", "schema", "request:grok:next")).rejects.toBeInstanceOf(GovernedAiCallRefusal);
    expect(m.admission).toHaveBeenCalledOnce();
    expect(m.extract).toHaveBeenCalledOnce();
  });
  it.each([undefined, "openai"])("requires explicit Gateway provider for a chosen model (%s)", async provider => {
    await expect(resolveGovernedAiCall("tenant", provider, "actor", "vendor/alternative")).resolves.toMatchObject({ ok: false, error: "workspace_ai_model_not_allowed" });
    expect(m.admission).not.toHaveBeenCalled(); expect(m.extract).not.toHaveBeenCalled();
  });
  it.each(["vendor/unapproved", "service-default", "vmc/private", "", "a/" + "x".repeat(200)])("refuses unapproved/nonconcrete preference %s before holds", async model => {
    await expect(resolveGovernedAiCall("tenant", "vercel_gateway", "actor", model)).resolves.toMatchObject({ ok: false, error: "workspace_ai_model_not_allowed" });
    expect(m.admission).not.toHaveBeenCalled(); expect(m.extract).not.toHaveBeenCalled();
  });
  it("refuses retired models and catalog failure before admission", async () => {
    m.catalog.mockResolvedValue([{ id: "vendor/default" }]);
    await expect(resolveGovernedAiCall("tenant", "vercel_gateway", "actor", "vendor/alternative")).resolves.toMatchObject({ ok: false, error: "workspace_ai_model_not_allowed" });
    m.catalog.mockRejectedValue(new Error("private upstream failure"));
    await expect(resolveGovernedAiCall("tenant", "vercel_gateway", "actor", "vendor/alternative")).resolves.toMatchObject({ ok: false, error: "workspace_ai_policy_unavailable" });
    expect(m.admission).not.toHaveBeenCalled(); expect(m.extract).not.toHaveBeenCalled();
  });
  it("legacy concrete policy permits only its exact default intersected with current catalog", async () => {
    const legacy = policy(); delete legacy.gatewaySelection; m.load.mockResolvedValue(ready(legacy));
    await expect(resolveGovernedAiCall("tenant", "vercel_gateway", "actor", "vendor/alternative")).resolves.toMatchObject({ ok: false, error: "workspace_ai_model_not_allowed" });
    const governed = await resolved("vendor/default"); await governed.extract("prompt", "schema", "request:0");
    expect(m.extract.mock.calls[0][2].model).toBe("vendor/default");
  });
  it.each(["service-default", "vmc/private"])("preserves managed %s semantics when no explicit model is requested", async managed => {
    const legacy = policy(); delete legacy.gatewaySelection; legacy.modelSelections.vercel_gateway = managed; m.load.mockResolvedValue(ready(legacy));
    m.status.mockReturnValue([{ provider: "vercel_gateway", configured: true, defaultModel: "vendor/default" }]);
    const governed = await resolveGovernedAiCall("tenant", undefined, "actor");
    if (!governed.ok) throw new Error("expected managed default");
    await governed.extract("prompt", "schema", "request:0");
    expect(m.extract.mock.calls[0][2]).toMatchObject({ modelSelections: { vercel_gateway: managed }, model: managed === "service-default" ? "vendor/default" : managed });
    expect(m.catalog).not.toHaveBeenCalled();
  });
  it("configured direct-provider status cannot admit an unsupported production lane", async () => {
    m.status.mockReturnValue([{ provider: "openai", configured: true }]);
    m.load.mockResolvedValue(ready({ enabled: true, allowedProviders: ["openai"], modelSelections: { openai: "gpt-4o-mini" }, fallbackOrder: ["openai"] }));
    await expect(resolveGovernedAiCall("tenant", "openai", "actor")).resolves.toMatchObject({ ok: false, error: "workspace_ai_provider_unavailable" });
    expect(m.admission).not.toHaveBeenCalled(); expect(m.extract).not.toHaveBeenCalled(); expect(m.catalog).not.toHaveBeenCalled();
  });
  it("requires actual service availability even if a Gateway status fixture says configured", async () => {
    m.available.mockReturnValue(false);
    await expect(resolveGovernedAiCall("tenant", "vercel_gateway", "actor", "vendor/alternative")).resolves.toMatchObject({ ok: false, error: "workspace_ai_provider_unavailable" });
    expect(m.admission).not.toHaveBeenCalled(); expect(m.extract).not.toHaveBeenCalled();
  });
  it.each(["disabled", "revoked", "catalog_retired", "catalog_failure", "service_disabled", "policy_unavailable"])("rechecks %s before each following extract/repair hold", async change => {
    const governed = await resolved(); await governed.extract("prompt", "schema", "request:0");
    if (change === "disabled") m.load.mockResolvedValue(ready({ ...policy(), enabled: false }));
    if (change === "revoked") { const next = policy(); next.gatewaySelection = { ...next.gatewaySelection!, approvedModelIds: ["vendor/default"] }; m.load.mockResolvedValue(ready(next)); }
    if (change === "catalog_retired") m.catalog.mockResolvedValue([{ id: "vendor/default" }]);
    if (change === "catalog_failure") m.catalog.mockRejectedValue(new Error("private failure"));
    if (change === "service_disabled") m.status.mockReturnValue([{ provider: "vercel_gateway", configured: false }]);
    if (change === "policy_unavailable") m.load.mockResolvedValue({ storageState: "unavailable", policy: null });
    await expect(governed.extract("repair", "schema", "request:0:repair")).rejects.toBeInstanceOf(GovernedAiCallRefusal);
    expect(m.admission).toHaveBeenCalledOnce(); expect(m.extract).toHaveBeenCalledOnce();
  });
  it("actual decision loop stops a policy refusal without treating it as a paid JSON repair", async () => {
    m.extract.mockImplementation(async () => { m.load.mockResolvedValue(ready({ ...policy(), enabled: false })); return { data: { malformed: true } }; });
    const result = await runDecisionLoop({ organizationId: "tenant", userId: "trusted-actor", preferredProvider: "vercel_gateway", preferredModel: "vendor/alternative", correlationId: "request", transcript: [{ role: "user", content: "hello" }], executeReadOnlyTool: async () => ({ ok: true, result: {} }), isProdEnvironmentTarget: async () => false });
    expect(result).toEqual({ kind: "error", error: "workspace_ai_disabled" });
    expect(m.admission).toHaveBeenCalledOnce(); expect(m.extract).toHaveBeenCalledOnce();
  });
});
