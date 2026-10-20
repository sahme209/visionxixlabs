import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { gatewayPolicyModelIds, normalizeWorkspaceAIProviderPolicy, normalizeWorkspaceAIProviderPolicyUpdate } from "../workspaceProviderPolicy";
const selection = { version: 1, defaultModelId: "xai/grok-4", approvedModelIds: ["xai/grok-4", "openai/gpt-4o"] };
const input = (model: unknown = selection) => ({ enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: model }, fallbackOrder: ["vercel_gateway"] });
describe("reviewed admin model selection writes", () => {
  it("accepts bounded concrete approvals without changing legacy default consumers", () => {
    const policy = normalizeWorkspaceAIProviderPolicyUpdate(input())!;
    expect(policy.modelSelections.vercel_gateway).toBe(selection.defaultModelId);
    expect(gatewayPolicyModelIds(policy)).toEqual(selection.approvedModelIds);
    expect(normalizeWorkspaceAIProviderPolicy(input())).toBeNull();
  });
  it.each(["service-default", "xai/grok-4"])("retains legacy %s writes", model => {
    expect(normalizeWorkspaceAIProviderPolicyUpdate(input(model))).toEqual(normalizeWorkspaceAIProviderPolicy(input(model)));
  });
  it("does not turn route section or a supplied tenant into policy authority", () => {
    expect(normalizeWorkspaceAIProviderPolicyUpdate({ ...input(), section: "provider_policy", organizationId: "foreign" })).toEqual(normalizeWorkspaceAIProviderPolicyUpdate(input()));
  });
  it.each([
    { ...selection, version: 2 }, { ...selection, approvedModelIds: ["openai/gpt-4o"] },
    { ...selection, approvedModelIds: ["xai/grok-4", "xai/grok-4"] },
    { ...selection, defaultModelId: "service-default", approvedModelIds: ["service-default"] },
    { ...selection, extra: true },
  ])("rejects malformed or unapproved defaults %#", model => expect(normalizeWorkspaceAIProviderPolicyUpdate(input(model))).toBeNull());
  it("rejects versioned metadata on a disabled policy", () => expect(normalizeWorkspaceAIProviderPolicyUpdate({ ...input(), enabled: false })).toBeNull());
  it("does not invoke request accessors", () => {
    const getter = vi.fn(() => input().modelSelections);
    const value = input(); Object.defineProperty(value, "modelSelections", { enumerable: true, get: getter });
    expect(normalizeWorkspaceAIProviderPolicyUpdate(value)).toBeNull(); expect(getter).not.toHaveBeenCalled();
  });
  it("does not invent a catalog requirement for a legacy managed default", () => expect(gatewayPolicyModelIds(normalizeWorkspaceAIProviderPolicyUpdate(input("service-default"))!)).toEqual([]));
});

it("preserves the normalized GET representation on a subsequent admin edit", () => {
  const first = normalizeWorkspaceAIProviderPolicyUpdate(input())!;
  const edited = normalizeWorkspaceAIProviderPolicyUpdate({ ...first, fallbackOrder: [] });
  expect(edited?.gatewaySelection).toEqual(selection);
  expect(edited?.modelSelections).toEqual(first.modelSelections);
});
it("refuses mismatched metadata and ambiguous nested plus top-level representations", () => {
  const first = normalizeWorkspaceAIProviderPolicyUpdate(input())!;
  expect(normalizeWorkspaceAIProviderPolicyUpdate({ ...first, modelSelections: { vercel_gateway: "openai/gpt-4o" } })).toBeNull();
  expect(normalizeWorkspaceAIProviderPolicyUpdate({ ...input(), gatewaySelection: selection })).toBeNull();
});
