/** @vitest-environment jsdom */
import {createElement} from "react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
const mocks=vi.hoisted(()=>({status:vi.fn(),update:vi.fn(),preferences:vi.fn(),config:{workspace:"inert"}}));
vi.mock("@tauri-apps/plugin-shell",()=>({open:vi.fn()}));
vi.mock("@tauri-apps/api/core",()=>({invoke:vi.fn()}));
vi.mock("../../../desktop/src/lib/preferences",()=>({readDesktopPreferences:mocks.preferences,writeDesktopPreferences:vi.fn()}));
vi.mock("../../../desktop/src/lib/desktopClient",()=>({desktopClient:{get config(){return mocks.config;},aiProviderStatus:mocks.status,updateAiProviderPolicy:mocks.update}}));
import {open} from "@tauri-apps/plugin-shell";
import {SettingsView} from "../../../desktop/src/views/SettingsView";
const metadata=()=>({version:1,defaultModelId:"xai/grok-4",approvedModelIds:["xai/grok-4","openai/gpt-4o"]});
beforeEach(()=>{vi.clearAllMocks();mocks.config={workspace:"inert"};mocks.preferences.mockResolvedValue(null);mocks.status.mockResolvedValue({ok:true,data:{providers:[{provider:"vercel_gateway",models:[{id:"xai/grok-4",label:"Grok",tier:"balanced"},{id:"openai/gpt-4o",label:"GPT",tier:"balanced"},{id:"anthropic/claude-sonnet-4",label:"Claude",tier:"balanced"}]},{provider:"groq",models:[{id:"llama-3.1-70b-versatile",label:"Llama",tier:"fast"}]}],policy:{enabled:true,allowedProviders:["vercel_gateway"],modelSelections:{vercel_gateway:"xai/grok-4"},fallbackOrder:["vercel_gateway"],gatewaySelection:metadata()}}});mocks.update.mockImplementation(async policy=>({ok:true,data:{policy}}));});
afterEach(cleanup);
async function show(){render(createElement(SettingsView,{identity:{} as never,initialSection:"models"}));await screen.findByRole("switch",{name:"Disable Grok"});}
it("actual Settings adds an approval while retaining the Agent default and honest selection copy",async()=>{
 await show();expect(screen.getByRole("switch",{name:"Disable GPT"}).getAttribute("aria-checked")).toBe("true");fireEvent.click(screen.getByRole("switch",{name:"Enable Claude"}));await screen.findByRole("switch",{name:"Disable Claude"});expect(mocks.update.mock.calls[0][0].gatewaySelection).toEqual({...metadata(),approvedModelIds:[...metadata().approvedModelIds,"anthropic/claude-sonnet-4"]});expect(mocks.update.mock.calls[0][0].modelSelections.vercel_gateway).toBe("xai/grok-4");expect(screen.getByText(/Agent chat starts with the workspace default/)).toBeTruthy();
});
it("actual Settings promotes the remaining default then disables the last Gateway approval",async()=>{
 await show();fireEvent.click(screen.getByRole("switch",{name:"Disable Grok"}));await screen.findByRole("switch",{name:"Enable Grok"});expect(mocks.update.mock.calls[0][0].modelSelections.vercel_gateway).toBe("openai/gpt-4o");expect(screen.getByText("GPT").textContent).toContain("Workspace default");fireEvent.click(screen.getByRole("switch",{name:"Disable GPT"}));await screen.findByRole("switch",{name:"Enable GPT"});expect(mocks.update.mock.calls[1][0]).toEqual({enabled:false,allowedProviders:[],modelSelections:{},fallbackOrder:[]});
});
it("actual direct-provider toggle preserves Gateway approval metadata",async()=>{
 await show();fireEvent.click(screen.getByRole("switch",{name:"Enable Llama"}));await screen.findByRole("switch",{name:"Disable Llama"});expect(mocks.update.mock.calls[0][0].gatewaySelection).toEqual(metadata());
});
it("server rejection keeps the prior approved list and default",async()=>{
 mocks.update.mockResolvedValue({ok:false,error:"workspace_admin_required"});await show();fireEvent.click(screen.getByRole("switch",{name:"Disable Grok"}));await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("Only a workspace administrator"));expect(screen.getByRole("switch",{name:"Disable Grok"}).getAttribute("aria-checked")).toBe("true");expect(screen.getByRole("switch",{name:"Disable GPT"})).toBeTruthy();
});

it("actual accessible Make default action changes only the approved default",async()=>{
 await show();fireEvent.click(screen.getByRole("button",{name:"Make GPT workspace default"}));await screen.findByRole("button",{name:"Make Grok workspace default"});expect(mocks.update.mock.calls[0][0].gatewaySelection).toEqual({...metadata(),defaultModelId:"openai/gpt-4o"});expect(screen.getByRole("switch",{name:"Disable Grok"})).toBeTruthy();expect(screen.getByRole("switch",{name:"Disable GPT"})).toBeTruthy();
});

it("shows a stale approved ID as removal-only instead of inventing live availability",async()=>{
 const value=await mocks.status();value.data.providers[0].models=value.data.providers[0].models.filter((model:{id:string})=>model.id!=="openai/gpt-4o");mocks.status.mockResolvedValue(value);await show();expect(screen.getByText(/Unavailable in current catalog · removal only/)).toBeTruthy();expect(screen.queryByRole("button",{name:"Make openai/gpt-4o workspace default"})).toBeNull();fireEvent.click(screen.getByRole("switch",{name:"Remove unavailable approval openai/gpt-4o"}));await waitFor(()=>expect(screen.queryByRole("switch",{name:"Remove unavailable approval openai/gpt-4o"})).toBeNull());expect(mocks.update.mock.calls[0][0].gatewaySelection.approvedModelIds).toEqual(["xai/grok-4"]);
});

it("explicit batch removes two unavailable approvals in one request and preserves the available default",async()=>{
 const value=await mocks.status();value.data.policy.gatewaySelection.approvedModelIds.push("xai/retired");value.data.providers[0].models=value.data.providers[0].models.filter((model:{id:string})=>model.id!=="openai/gpt-4o");mocks.status.mockResolvedValue(value);await show();expect(mocks.update).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Remove unavailable approvals"}));await waitFor(()=>expect(screen.queryByRole("button",{name:"Remove unavailable approvals"})).toBeNull());expect(mocks.update).toHaveBeenCalledOnce();expect(mocks.update.mock.calls[0][0].gatewaySelection).toEqual({version:1,defaultModelId:"xai/grok-4",approvedModelIds:["xai/grok-4"]});
});
it("failed catalog load offers no destructive cleanup action",async()=>{
 mocks.status.mockResolvedValue({ok:false,error:"provider_policy_unavailable"});render(createElement(SettingsView,{identity:{} as never,initialSection:"models"}));await screen.findByRole("alert");expect(screen.queryByRole("button",{name:"Remove unavailable approvals"})).toBeNull();expect(mocks.update).not.toHaveBeenCalled();
});

it("ignores a deferred save result after workspace configuration changes",async()=>{
 let finish!:(value:unknown)=>void;mocks.update.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));await show();fireEvent.click(screen.getByRole("switch",{name:"Enable Claude"}));await waitFor(()=>expect(mocks.update).toHaveBeenCalledOnce());const oldPolicy=mocks.update.mock.calls[0][0];mocks.config={workspace:"different-workspace"};finish({ok:true,data:{policy:oldPolicy}});await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("Your workspace changed"));expect(screen.queryByRole("switch",{name:"Disable Claude"})).toBeNull();expect(screen.queryByRole("switch",{name:"Disable Grok"})).toBeNull();
});
it("refuses dispatch when the loaded policy belongs to the previous configuration",async()=>{
 await show();mocks.config={workspace:"different-workspace"};fireEvent.click(screen.getByRole("switch",{name:"Enable Claude"}));await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("Your workspace changed"));expect(mocks.update).not.toHaveBeenCalled();
});

it.each(["service-default","vmc/legacy-route"])("renders %s as a managed legacy route rather than a stale approval",async model=>{
 const value=await mocks.status();const{gatewaySelection:metadata,...legacy}=value.data.policy;expect(metadata).toBeTruthy();value.data.policy={...legacy,modelSelections:{vercel_gateway:model}};value.data.providers[0].models=[];mocks.status.mockResolvedValue(value);render(createElement(SettingsView,{identity:{} as never,initialSection:"models"}));await screen.findByRole("switch",{name:`Disable ${model}`});expect(screen.getByText(/Service-managed legacy route/)).toBeTruthy();expect(screen.queryByRole("button",{name:"Remove unavailable approvals"})).toBeNull();expect(screen.queryByText(/Unavailable in current catalog · removal only/)).toBeNull();expect(mocks.update).not.toHaveBeenCalled();
});

it("Agents settings explains real profile limits and opens the existing authenticated governance page",async()=>{
 render(createElement(SettingsView,{identity:{} as never}));
 fireEvent.click(screen.getByRole("button",{name:"Agents"}));
 expect(screen.getByText("Code Review Agent")).toBeTruthy();
 expect(screen.getByText(/no plan\/apply executor/)).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:/Manage workspace tool permissions/}));
 expect(open).toHaveBeenCalledWith("https://visionxixlabs.com/control/ai-agents");
 expect(mocks.update).not.toHaveBeenCalled();
});
it("opens the exact Agents section directly without loading or mutating model policy",async()=>{
 render(createElement(SettingsView,{identity:{} as never,initialSection:"agents"}));
 expect(screen.getByRole("heading",{name:"Agents"})).toBeTruthy();
 expect(screen.getByText("Coding Agent")).toBeTruthy();
 expect(mocks.status).not.toHaveBeenCalled();expect(mocks.update).not.toHaveBeenCalled();
});
it("finds Grok by its actual Gateway namespace and filters approvals without changing policy",async()=>{
 const value=await mocks.status();value.data.providers[0].models.push({id:"spacexai/grok-build-0.1",label:"Grok Build 0.1",tier:"preferred"},{id:"spacexai/grok-4.7",label:"Grok 4.7",tier:"preferred"});mocks.status.mockResolvedValue(value);await show();
 fireEvent.change(screen.getByLabelText("Search models"),{target:{value:"spacexai"}});
 expect(screen.getByRole("switch",{name:"Enable Grok Build 0.1"})).toBeTruthy();
 expect(screen.getByRole("switch",{name:"Enable Grok 4.7"})).toBeTruthy();
 expect(screen.queryByRole("switch",{name:"Disable GPT"})).toBeNull();
 fireEvent.change(screen.getByLabelText("Search models"),{target:{value:""}});
 fireEvent.click(screen.getByRole("button",{name:"Approved models"}));
 expect(screen.getByRole("switch",{name:"Disable GPT"})).toBeTruthy();
 expect(screen.queryByRole("switch",{name:"Enable Grok Build 0.1"})).toBeNull();
 expect(mocks.update).not.toHaveBeenCalled();
});
it("bounds large catalog rendering while searching the complete catalog without policy writes",async()=>{
 mocks.status.mockResolvedValue({ok:true,data:{providers:[{provider:"vercel_gateway",models:Array.from({length:125},(_,index)=>({id:`vendor/model-${index}`,label:`Catalog model ${index}`,tier:"standard"}))}],policy:{enabled:false,allowedProviders:[],modelSelections:{},fallbackOrder:[]}}});
 render(createElement(SettingsView,{identity:{} as never,initialSection:"models"}));await screen.findByRole("switch",{name:"Enable Catalog model 0"});expect(screen.getAllByRole("switch")).toHaveLength(50);
 fireEvent.click(screen.getByRole("button",{name:"Next models"}));expect(screen.getAllByRole("switch")).toHaveLength(50);expect(screen.getByRole("switch",{name:"Enable Catalog model 50"})).toBeTruthy();expect(screen.queryByRole("switch",{name:"Enable Catalog model 0"})).toBeNull();
 fireEvent.change(screen.getByRole("textbox",{name:"Search models"}),{target:{value:"vendor/model-124"}});expect(screen.getAllByRole("switch")).toHaveLength(1);expect(screen.getByRole("switch",{name:"Enable Catalog model 124"})).toBeTruthy();
 fireEvent.change(screen.getByRole("textbox",{name:"Search models"}),{target:{value:""}});expect(screen.getAllByRole("switch")).toHaveLength(50);expect(mocks.update).not.toHaveBeenCalled();
});
it('offline Settings explains operator-owned caps and selects one accepted local model',async()=>{
 mocks.status.mockResolvedValue({ok:true,data:{installationAIMode:'offline',providers:[{provider:'customer_hosted',models:[{id:'local-a',label:'Local A',tier:'balanced'},{id:'local-b',label:'Local B',tier:'balanced'}]}],policy:{enabled:true,allowedProviders:['customer_hosted'],modelSelections:{customer_hosted:'local-a'},fallbackOrder:['customer_hosted']}}});
 render(createElement(SettingsView,{identity:{} as never,initialSection:'models'}));await screen.findByRole('switch',{name:'Enable Local B'});
 expect(screen.getByText(/deployment operator manages/)).toBeTruthy();fireEvent.click(screen.getByRole('switch',{name:'Enable Local B'}));await screen.findByRole('switch',{name:'Disable Local B'});
 expect(mocks.update.mock.calls[0][0]).toEqual({enabled:true,allowedProviders:['customer_hosted'],modelSelections:{customer_hosted:'local-b'},fallbackOrder:['customer_hosted']});
});
it('offline Settings keeps the stop switch usable when no accepted model is listed',async()=>{
 mocks.status.mockResolvedValue({ok:true,data:{installationAIMode:'offline',providers:[],policy:{enabled:true,allowedProviders:[],modelSelections:{},fallbackOrder:[]}}});
 render(createElement(SettingsView,{identity:{} as never,initialSection:'models'}));fireEvent.click(await screen.findByRole('button',{name:'Disable workspace AI'}));await waitFor(()=>expect(mocks.update).toHaveBeenCalledOnce());expect(mocks.update.mock.calls[0][0]).toEqual({enabled:false,allowedProviders:[],modelSelections:{},fallbackOrder:[]});
});
