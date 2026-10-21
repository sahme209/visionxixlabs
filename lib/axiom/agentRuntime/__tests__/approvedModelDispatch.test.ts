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
  it("preserves the current Grok catalog ID through policy admission and revocation", async () => {
    const model = "spacexai/grok-4.1-fast-non-reasoning";
    const value = policy();
    value.gatewaySelection!.approvedModelIds.push(model);
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
    const governed = await resolveGovernedAiCall("tenant", undefined, "actor");
    if (!governed.ok) throw new Error("expected managed default");
    await governed.extract("prompt", "schema", "request:0");
    expect(m.extract.mock.calls[0][2]).toMatchObject({ modelSelections: { vercel_gateway: managed }, model: undefined });
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
