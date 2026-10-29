import{expect,it}from"vitest";
import{agentModelChoices,modelPreferenceKey}from"../../../desktop/src/lib/agentModelSelection";
import{normalizeAiProviderStatus}from"../../../desktop/src/lib/aiProviderStatus";
const status=()=>normalizeAiProviderStatus({providers:[{provider:"vercel_gateway",models:[{id:"xai/grok-4",label:"Grok",tier:"balanced"},{id:"openai/gpt-4o",label:"GPT",tier:"balanced"},{id:"anthropic/unapproved",label:"Unapproved",tier:"balanced"}]}],policy:{enabled:true,allowedProviders:["vercel_gateway"],modelSelections:{vercel_gateway:"xai/grok-4"},fallbackOrder:["vercel_gateway"],gatewaySelection:{version:1,defaultModelId:"xai/grok-4",approvedModelIds:["xai/grok-4","openai/gpt-4o","xai/retired"]}}})!;
it("offers only approved current-catalog model IDs grouped by actual vendor",()=>{expect(agentModelChoices(status()).map(option=>[option.modelId,option.vendor,option.preferredModel])).toEqual([["xai/grok-4","xAI","xai/grok-4"],["openai/gpt-4o","OpenAI","openai/gpt-4o"]]);});
it("legacy retains only its current default and managed routing adds no concrete choice",()=>{const value=status();delete value.policy.gatewaySelection;expect(agentModelChoices(value)).toHaveLength(1);value.policy.modelSelections.vercel_gateway="service-default";expect(agentModelChoices(value)[0]).toMatchObject({modelId:"service-default",label:"Service-managed default"});expect(agentModelChoices(value)[0]).not.toHaveProperty("preferredModel");value.policy.enabled=false;expect(agentModelChoices(value)).toEqual([]);});
it("scopes optional preference by verified workspace and clean API address without credentials",()=>{expect(modelPreferenceKey("https://visionxixlabs.com","one")).not.toBe(modelPreferenceKey("https://visionxixlabs.com","two"));expect(modelPreferenceKey("https://user:password@example.com","one")).toBeNull();expect(modelPreferenceKey("https://example.com?token=secret","one")).toBeNull();expect(modelPreferenceKey("https://example.com","")).toBeNull();});

it("labels current Gateway Grok namespace as xAI without rewriting approved model identity", () => {
  const value = normalizeAiProviderStatus({
    providers: [{ provider: "vercel_gateway", models: [
      { id: "spacexai/grok-4.1-fast-non-reasoning", label: "Grok 4.1 Fast Non-Reasoning", tier: "balanced" },
      { id: "spacexai/grok-4.20-multi-agent", label: "Grok 4.20 Multi-Agent", tier: "balanced" },
    ] }],
    policy: { enabled: true, allowedProviders: ["vercel_gateway"],
      modelSelections: { vercel_gateway: "spacexai/grok-4.1-fast-non-reasoning" },
      fallbackOrder: ["vercel_gateway"], gatewaySelection: {
        version: 1, defaultModelId: "spacexai/grok-4.1-fast-non-reasoning",
        approvedModelIds: ["spacexai/grok-4.1-fast-non-reasoning"],
      } },
  })!;
  expect(agentModelChoices(value)).toEqual([expect.objectContaining({
    provider: "vercel_gateway", vendor: "xAI",
    modelId: "spacexai/grok-4.1-fast-non-reasoning",
    preferredModel: "spacexai/grok-4.1-fast-non-reasoning",
  })]);
});

it.each(["xai/grok-4.20-multi-agent", "spacexai/grok-4.20-multi-agent", "spacexai/grok-4.20-multi-agent:latest"])("keeps approved %s identifiable but unavailable without changing policy", modelId => {
  const value = structuredClone(status());
  value.providers[0].models.push({ id: modelId, label: "Multi-Agent", tier: "balanced" });
  value.policy.gatewaySelection = { ...value.policy.gatewaySelection!, approvedModelIds: [...value.policy.gatewaySelection!.approvedModelIds, modelId] };
  const before = JSON.stringify(value);
  const choice = agentModelChoices(value).find(option => option.modelId === modelId);
  expect(choice).toMatchObject({ modelId, preferredModel: modelId, unavailableReason: expect.stringContaining("output budget cannot be enforced") });
  expect(agentModelChoices(value).find(option => option.modelId === "xai/grok-4")?.unavailableReason).toBeUndefined();
  expect(JSON.stringify(value)).toBe(before);
});
