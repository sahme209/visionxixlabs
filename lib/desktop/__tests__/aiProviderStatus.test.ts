import { describe, expect, it, vi } from "vitest";
import { normalizeAiProviderStatus } from "../../../desktop/src/lib/aiProviderStatus";

describe("normalizeAiProviderStatus", () => {
  it("accepts the complete desktop provider response", () => {
    expect(normalizeAiProviderStatus({
      providers: [{ provider: "openai", models: [{ id: "gpt-5", label: "GPT-5", tier: "frontier" }] }],
      policy: {
        enabled: true,
        allowedProviders: ["openai"],
        modelSelections: { openai: "gpt-5" },
        fallbackOrder: ["openai"],
      },
    }))?.toEqual({
      providers: [{ provider: "openai", models: [{ id: "gpt-5", label: "GPT-5", tier: "frontier" }] }],
      policy: {
        enabled: true,
        allowedProviders: ["openai"],
        modelSelections: { openai: "gpt-5" },
        fallbackOrder: ["openai"],
      },
    });
  });

  it.each([
    null,
    {},
    { providers: null, policy: {} },
    { providers: [{ provider: "openai" }], policy: {} },
    { providers: [], policy: { enabled: true, allowedProviders: "openai", modelSelections: {}, fallbackOrder: [] } },
    { providers: [], policy: { enabled: true, allowedProviders: [], modelSelections: { openai: 42 }, fallbackOrder: [] } },
  ])("rejects malformed data without throwing", (value) => {
    expect(normalizeAiProviderStatus(value)).toBeNull();
  });
});

import { toggleApprovedModel, isModelApproved, setApprovedGatewayDefault, removeUnavailableGatewayApprovals } from "../../../desktop/src/lib/aiProviderStatus";
const gateway = () => ({version:1 as const,defaultModelId:"xai/grok-4",approvedModelIds:["xai/grok-4","openai/gpt-4o"]});
const gatewayStatus = () => ({providers:[{provider:"vercel_gateway",models:[{id:"xai/grok-4",label:"Grok",tier:"balanced"},{id:"openai/gpt-4o",label:"GPT",tier:"balanced"}]}],policy:{enabled:true,allowedProviders:["vercel_gateway"],modelSelections:{vercel_gateway:"xai/grok-4"},fallbackOrder:["vercel_gateway"],gatewaySelection:gateway()}});
it("preserves validated Gateway metadata through desktop decoding",()=>{expect(normalizeAiProviderStatus(gatewayStatus())?.policy.gatewaySelection).toEqual(gateway());});
it.each([
 {...gateway(),version:2},{...gateway(),approvedModelIds:[]},{...gateway(),defaultModelId:"openai/other"},{...gateway(),approvedModelIds:["xai/grok-4","xai/grok-4"]},{...gateway(),approvedModelIds:["service-default"]},{...gateway(),extra:true},{...gateway(),approvedModelIds:Array.from({length:33},(_,i)=>`xai/m-${i}`)},
])("rejects malformed metadata %#",metadata=>{expect(normalizeAiProviderStatus({...gatewayStatus(),policy:{...gatewayStatus().policy,gatewaySelection:metadata}})).toBeNull();});
it("rejects metadata accessors without invoking them",()=>{const get=vi.fn(()=>"xai/grok-4");const metadata=gateway();Object.defineProperty(metadata,"defaultModelId",{get,enumerable:true});expect(normalizeAiProviderStatus({...gatewayStatus(),policy:{...gatewayStatus().policy,gatewaySelection:metadata}})).toBeNull();expect(get).not.toHaveBeenCalled();});
it("keeps multiple Gateway approvals while the existing Agent default remains a string",()=>{const p=gatewayStatus().policy;const next=toggleApprovedModel(p,"vercel_gateway","anthropic/claude-sonnet-4")!;expect(next.gatewaySelection?.approvedModelIds).toEqual([...gateway().approvedModelIds,"anthropic/claude-sonnet-4"]);expect(next.modelSelections.vercel_gateway).toBe("xai/grok-4");expect(isModelApproved(next,"vercel_gateway","openai/gpt-4o")).toBe(true);expect(p.gatewaySelection).toEqual(gateway());});
it("removing the default promotes first remaining and removing the last disables Gateway",()=>{const remaining=toggleApprovedModel(gatewayStatus().policy,"vercel_gateway","xai/grok-4")!;expect(remaining.gatewaySelection?.defaultModelId).toBe("openai/gpt-4o");expect(remaining.modelSelections.vercel_gateway).toBe("openai/gpt-4o");expect(toggleApprovedModel(remaining,"vercel_gateway","openai/gpt-4o")).toEqual({enabled:false,allowedProviders:[],modelSelections:{},fallbackOrder:[]});});
it("toggling a direct provider preserves Gateway metadata",()=>{const next=toggleApprovedModel(gatewayStatus().policy,"groq","llama-3.1-70b-versatile")!;expect(next.gatewaySelection).toEqual(gateway());expect(toggleApprovedModel(next,"groq","llama-3.1-70b-versatile")?.gatewaySelection).toEqual(gateway());});
it("refuses approval33 and malformed concrete IDs",()=>{const approved=Array.from({length:32},(_,i)=>`xai/m-${i}`),p={...gatewayStatus().policy,modelSelections:{vercel_gateway:approved[0]},gatewaySelection:{version:1 as const,defaultModelId:approved[0],approvedModelIds:approved}};expect(toggleApprovedModel(p,"vercel_gateway","xai/overflow")).toBeNull();expect(toggleApprovedModel(gatewayStatus().policy,"vercel_gateway","service-default")).toBeNull();});
it("legacy concrete Gateway becomes a preserved default plus new approval",()=>{const {gatewaySelection:metadata,...p}=gatewayStatus().policy;expect(metadata).toEqual(gateway());expect(toggleApprovedModel(p,"vercel_gateway","openai/gpt-4o")?.gatewaySelection).toEqual(gateway());});
it("legacy service-default remains readable and may be disabled without creating v1 metadata",()=>{const p={enabled:true,allowedProviders:["vercel_gateway"],modelSelections:{vercel_gateway:"service-default"},fallbackOrder:["vercel_gateway"]};expect(normalizeAiProviderStatus({providers:[],policy:p})?.policy).toEqual(p);expect(toggleApprovedModel(p,"vercel_gateway","service-default")?.enabled).toBe(false);});

it("changes default only within existing Gateway approvals without changing membership",()=>{
 const p=gatewayStatus().policy,next=setApprovedGatewayDefault(p,"openai/gpt-4o")!;expect(next.modelSelections.vercel_gateway).toBe("openai/gpt-4o");expect(next.gatewaySelection?.defaultModelId).toBe("openai/gpt-4o");expect(next.gatewaySelection?.approvedModelIds).toEqual(p.gatewaySelection.approvedModelIds);expect(p.gatewaySelection.defaultModelId).toBe("xai/grok-4");expect(setApprovedGatewayDefault(p,"anthropic/claude-sonnet-4")).toBeNull();
});

it("explicit batch cleanup removes multiple stale approvals while preserving a still-available default",()=>{
 const p={...gatewayStatus().policy,gatewaySelection:{...gateway(),approvedModelIds:[...gateway().approvedModelIds,"anthropic/claude-sonnet-4"]}};
 const next=removeUnavailableGatewayApprovals(p,["xai/grok-4"])!;expect(next.gatewaySelection?.approvedModelIds).toEqual(["xai/grok-4"]);expect(next.modelSelections.vercel_gateway).toBe("xai/grok-4");expect(p.gatewaySelection.approvedModelIds).toHaveLength(3);
 expect(removeUnavailableGatewayApprovals(p,["anthropic/claude-sonnet-4"])?.modelSelections.vercel_gateway).toBe("anthropic/claude-sonnet-4");expect(removeUnavailableGatewayApprovals(p,[])?.enabled).toBe(false);
});

it.each(["service-default","vmc/legacy-route"])("batch cleanup preserves legacy managed route %s without creating v1 approvals",model=>{
 const p={enabled:true,allowedProviders:["vercel_gateway"],modelSelections:{vercel_gateway:model},fallbackOrder:["vercel_gateway"]};expect(removeUnavailableGatewayApprovals(p,[])).toEqual(p);expect(removeUnavailableGatewayApprovals(p,[])?.gatewaySelection).toBeUndefined();expect(toggleApprovedModel(p,"vercel_gateway",model)?.enabled).toBe(false);
});
