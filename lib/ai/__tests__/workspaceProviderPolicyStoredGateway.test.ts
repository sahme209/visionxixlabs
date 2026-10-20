import {beforeEach,expect,it,vi} from "vitest";
const db=vi.hoisted(()=>({findUnique:vi.fn(),upsert:vi.fn()}));
vi.mock("@/lib/db",()=>({prisma:{organizationAIProviderPolicy:db}}));
import {normalizeStoredWorkspaceAIProviderPolicy,normalizeWorkspaceAIProviderPolicyUpdate,normalizeWorkspaceAIProviderPolicy,loadWorkspaceAIProviderPolicyWithState,saveWorkspaceAIProviderPolicy,resolveWorkspaceAIProviderPolicy} from "../workspaceProviderPolicy";
const selection=()=>({version:1,defaultModelId:"xai/grok-4",approvedModelIds:["xai/grok-4","openai/gpt-4o"]});
const row=(model:unknown=selection())=>({enabled:true,allowedProviders:["vercel_gateway"],modelSelections:{vercel_gateway:model},fallbackOrder:["vercel_gateway"]});
beforeEach(()=>{vi.resetAllMocks();db.upsert.mockResolvedValue({});});
it.each(["service-default","xai/grok-4"])("preserves legacy Gateway %s strings without adding metadata",model=>{
 expect(normalizeStoredWorkspaceAIProviderPolicy(row(model))).toEqual(normalizeWorkspaceAIProviderPolicy(row(model)));
 expect(normalizeStoredWorkspaceAIProviderPolicy(row(model))).not.toHaveProperty("gatewaySelection");
});
it("reads stored v1 as the legacy default string and separately validated immutable metadata",()=>{
 const parsed=normalizeStoredWorkspaceAIProviderPolicy(row());expect(parsed?.modelSelections.vercel_gateway).toBe("xai/grok-4");expect(parsed?.gatewaySelection).toEqual(selection());expect(Object.isFrozen(parsed?.gatewaySelection)).toBe(true);expect(Object.isFrozen(parsed?.gatewaySelection?.approvedModelIds)).toBe(true);
 expect(normalizeWorkspaceAIProviderPolicy(row())).toBeNull();
});
it.each([
 {version:2,defaultModelId:"xai/grok-4",approvedModelIds:["xai/grok-4"]},
 {version:1,defaultModelId:"xai/grok-4",approvedModelIds:[]},
 {version:1,defaultModelId:"xai/grok-4",approvedModelIds:["openai/gpt-4o"]},
 {version:1,defaultModelId:"xai/grok-4",approvedModelIds:["xai/grok-4","xai/grok-4"]},
 {version:1,defaultModelId:"service-default",approvedModelIds:["service-default"]},
 {version:1,defaultModelId:"vmc/route",approvedModelIds:["vmc/route"]},
 {version:1,defaultModelId:"grok 4",approvedModelIds:["grok 4"]},
 {...selection(),extra:true},
 {...selection(),approvedModelIds:Array.from({length:33},(_,i)=>`xai/model-${i}`)},
 {...selection(),approvedModelIds:["xai/"+"a".repeat(201)]},
])("fails closed for malformed/unapproved stored v1 %#",model=>expect(normalizeStoredWorkspaceAIProviderPolicy(row(model))).toBeNull());
it("never invokes getters in selection objects, arrays, or the stored slot",()=>{
 const getter=vi.fn(()=>"xai/grok-4");const object={...selection()};Object.defineProperty(object,"defaultModelId",{get:getter,enumerable:true});expect(normalizeStoredWorkspaceAIProviderPolicy(row(object))).toBeNull();
 const ids=["xai/grok-4"];Object.defineProperty(ids,"0",{get:getter,enumerable:true});expect(normalizeStoredWorkspaceAIProviderPolicy(row({...selection(),approvedModelIds:ids}))).toBeNull();
 const stored=row();Object.defineProperty(stored.modelSelections,"vercel_gateway",{get:getter,enumerable:true});expect(normalizeStoredWorkspaceAIProviderPolicy(stored)).toBeNull();expect(getter).not.toHaveBeenCalled();
});
it("rejects sparse/extended arrays, symbol fields and hidden data",()=>{
 const sparse=new Array(1);const extended=Object.assign(["xai/grok-4"],{extra:"x"});for(const approvedModelIds of[sparse,extended])expect(normalizeStoredWorkspaceAIProviderPolicy(row({...selection(),approvedModelIds}))).toBeNull();
 for(const key of[Symbol("extra"),"hidden"]){const model=selection();Object.defineProperty(model,key,{value:true});expect(normalizeStoredWorkspaceAIProviderPolicy(row(model))).toBeNull();}
});
it("loader opts into stored reader and an existing save round-trip preserves v1 JSON",async()=>{
 db.findUnique.mockResolvedValue(row());const loaded=await loadWorkspaceAIProviderPolicyWithState("org");expect(loaded.storageState).toBe("ready");expect(loaded.policy?.gatewaySelection).toEqual(selection());
 await saveWorkspaceAIProviderPolicy({organizationId:"org",updatedBy:"admin",policy:loaded.policy!});const call=db.upsert.mock.calls[0][0];expect(call.create.modelSelections).toEqual({vercel_gateway:selection()});expect(call.update.modelSelections).toEqual({vercel_gateway:selection()});
});
it("service intersection revokes Gateway metadata and leaves existing direct-provider routing intact",()=>{
 const stored=normalizeStoredWorkspaceAIProviderPolicy({...row(),allowedProviders:["vercel_gateway","groq"],modelSelections:{vercel_gateway:selection(),groq:"llama-3.1-70b-versatile"}})!;
 expect(resolveWorkspaceAIProviderPolicy({stored,serviceEnabled:["vercel_gateway"]}).gatewaySelection).toEqual(selection());
 expect(resolveWorkspaceAIProviderPolicy({stored,serviceEnabled:["groq"]})).toEqual({enabled:true,allowedProviders:["groq"],modelSelections:{groq:"llama-3.1-70b-versatile"},fallbackOrder:["groq"]});
 expect(resolveWorkspaceAIProviderPolicy({stored:{...stored,enabled:false},serviceEnabled:["vercel_gateway"]})).toEqual({enabled:false,allowedProviders:[],modelSelections:{},fallbackOrder:[]});
});
it("rejects inconsistent metadata on save without an upsert or flattening",async()=>{
 const stored=normalizeStoredWorkspaceAIProviderPolicy(row())!;stored.modelSelections.vercel_gateway="openai/gpt-4o";await expect(saveWorkspaceAIProviderPolicy({organizationId:"org",updatedBy:"admin",policy:stored})).rejects.toThrow();expect(db.upsert).not.toHaveBeenCalled();
});
it("legacy save retains exact string representation and direct-provider models",async()=>{
 const policy=normalizeWorkspaceAIProviderPolicy({allowedProviders:["groq"],modelSelections:{groq:"llama-3.1-70b-versatile"},fallbackOrder:[]})!;await saveWorkspaceAIProviderPolicy({organizationId:"org",updatedBy:"admin",policy});expect(db.upsert.mock.calls[0][0].create.modelSelections).toEqual(policy.modelSelections);
});
it("preserves service-default resolution when legacy Gateway storage omits a model",()=>{
 const stored=normalizeStoredWorkspaceAIProviderPolicy({...row(),modelSelections:{}});expect(resolveWorkspaceAIProviderPolicy({stored,serviceEnabled:["vercel_gateway"]}).modelSelections.vercel_gateway).toBe("service-default");
});
it("refuses invalid metadata on resolution without choosing a direct fallback",()=>{
 const stored=normalizeStoredWorkspaceAIProviderPolicy({...row(),allowedProviders:["vercel_gateway","groq"],modelSelections:{vercel_gateway:selection(),groq:"llama-3.1-70b-versatile"}})!;
 expect(resolveWorkspaceAIProviderPolicy({stored:{...stored,gatewaySelection:{...selection(),version:2} as never},serviceEnabled:["vercel_gateway","groq"]})).toEqual({enabled:false,allowedProviders:[],modelSelections:{},fallbackOrder:[]});
});
it("rejects outer stored getters without executing them",()=>{
 const getter=vi.fn(()=>row().modelSelections);const value=row();Object.defineProperty(value,"modelSelections",{get:getter,enumerable:true});expect(normalizeStoredWorkspaceAIProviderPolicy(value)).toBeNull();expect(getter).not.toHaveBeenCalled();
});
it("a public writer cannot opt into metadata via an extra normalized field",()=>{
 const legacy=row("service-default");expect(normalizeWorkspaceAIProviderPolicy({...legacy,gatewaySelection:selection()} as never)).toEqual(normalizeWorkspaceAIProviderPolicy(legacy));
});

it.each([null,"legacy-non-array",3,false,{}])("preserves stored/public parity for legacy non-array fallback %#",fallbackOrder=>{
 const value={...row("service-default"),fallbackOrder};expect(normalizeStoredWorkspaceAIProviderPolicy(value)).toEqual(normalizeWorkspaceAIProviderPolicy(value));expect(normalizeStoredWorkspaceAIProviderPolicy(value)?.enabled).toBe(true);
});
it.each([null,"legacy-non-array",3,false,{}])("preserves primitive/null provider-list normalization for disabled legacy rows %#",allowedProviders=>{
 const value={enabled:false,allowedProviders,fallbackOrder:null,modelSelections:{}};expect(normalizeStoredWorkspaceAIProviderPolicy(value)).toEqual(normalizeWorkspaceAIProviderPolicy(value));
});

it("preserves approved IDs through load, GET resolution, public edit and stored save", async () => {
 db.findUnique.mockResolvedValue(row());
 const loaded=await loadWorkspaceAIProviderPolicyWithState("org");
 const response=resolveWorkspaceAIProviderPolicy({stored:loaded.policy,serviceEnabled:["vercel_gateway"]});
 const edited=normalizeWorkspaceAIProviderPolicyUpdate(JSON.parse(JSON.stringify(response)))!;
 expect(edited.gatewaySelection).toEqual(selection());
 await saveWorkspaceAIProviderPolicy({organizationId:"org",updatedBy:"admin",policy:edited});
 expect(db.upsert.mock.calls[0][0].update.modelSelections).toEqual({vercel_gateway:selection()});
});
