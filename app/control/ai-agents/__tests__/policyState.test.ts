/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AIGovernancePanel } from "../AIGovernancePanel";
function fixture(state?:string){return {canManage:true,providerPolicy:{enabled:false,allowedProviders:[],modelSelections:{},fallbackOrder:[]},availableProviders:[],gatewayModels:null,gatewayCatalogLive:false,agentIdentity:null,agentIdentityState:state,autonomy:null,budget:null,tools:[{name:"list_environments",description:"Read environments",riskLevel:"low"}]};}
function response(value:unknown,status=200){return {ok:status<400,status,json:async()=>value};}
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it.each(["migration_pending","unavailable"])("disables identity mutation when identity storage is %s",async state=>{
 const fetch=vi.fn().mockResolvedValue(response({ok:true,data:fixture(state)}));vi.stubGlobal("fetch",fetch);render(createElement(AIGovernancePanel));
 const save=await screen.findByRole("button",{name:"Save identity"});expect((save as HTMLButtonElement).disabled).toBe(true);
 expect((screen.getByLabelText("Enabled") as HTMLInputElement).disabled).toBe(true);expect(screen.getByRole("alert").textContent).toContain("Agent permissions");
 expect(screen.queryByText(/0 tools in saved policy/)).toBeNull();expect(screen.queryByText("No tools currently enabled.")).toBeNull();
 fireEvent.click(save);expect(fetch).toHaveBeenCalledOnce();
});
it("keeps an empty ready identity store available for explicit owner setup",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(response({ok:true,data:fixture("ready")})));render(createElement(AIGovernancePanel));
 expect((await screen.findByRole("button",{name:"Save identity"}) as HTMLButtonElement).disabled).toBe(false);
});
it("explains unconfirmed audit outcomes without displaying raw server details",async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(response({ok:true,data:fixture("ready")})).mockResolvedValueOnce(response({ok:false,error:"policy_audit_unconfirmed"},503));vi.stubGlobal("fetch",fetch);render(createElement(AIGovernancePanel));
 fireEvent.click(await screen.findByRole("button",{name:"Save identity"}));expect((await screen.findByRole("alert")).textContent).toContain("may already be saved");
 expect(screen.getByRole("alert").textContent).not.toContain("policy_audit_unconfirmed");expect(fetch).toHaveBeenCalledTimes(2);
});

it("hides unexpected server diagnostics and never automatically replays a failed save",async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(response({ok:true,data:fixture("ready")})).mockResolvedValueOnce(response({ok:false,error:"private database diagnostic"},500));vi.stubGlobal("fetch",fetch);render(createElement(AIGovernancePanel));fireEvent.click(await screen.findByRole("button",{name:"Save identity"}));const alert=await screen.findByRole("alert");expect(alert.textContent).toContain("not confirmed");expect(alert.textContent).not.toContain("private database");expect(fetch).toHaveBeenCalledTimes(2);
});

it("does not enable model policy changes without a live catalog", async () => {
  const fetcher = vi.fn().mockResolvedValue(response({ ok: true, data: fixture("ready") }));
  vi.stubGlobal("fetch", fetcher);
  render(createElement(AIGovernancePanel));
  const save = await screen.findByRole("button", { name: "Save model policy" });
  expect((save as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(save);
  expect(fetcher).toHaveBeenCalledOnce();
});

it("confirms a saved policy only after reading it back and clears confirmation on new edits", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(response({ ok: true, data: fixture("ready") }))
    .mockResolvedValueOnce(response({ ok: true }))
    .mockResolvedValueOnce(response({ ok: true, data: { ...fixture("ready"), autonomy: { mode: "observer", perCycleActionLimit: 2, rationale: "test" } } }));
  vi.stubGlobal("fetch", fetcher);
  render(createElement(AIGovernancePanel));
  fireEvent.change(await screen.findByRole("spinbutton", { name: "Maximum actions per cycle" }), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Save autonomy" }));
  expect((await screen.findByRole("status")).textContent).toBe("Autonomy policy saved and reloaded.");
  expect(fetcher).toHaveBeenCalledTimes(3);
  fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum actions per cycle" }), { target: { value: "3" } });
  expect(screen.queryByRole("status")).toBeNull();
});

it("prevents overlapping policy writes while a save is in progress", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response({ ok: true, data: fixture("ready") })).mockImplementation(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetcher);
  render(createElement(AIGovernancePanel));
  fireEvent.click(await screen.findByRole("button", { name: "Save autonomy" }));
  expect((screen.getByRole("button", { name: "Save spending limit" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("spinbutton", { name: "Maximum cost per run (USD)" }) as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Save spending limit" }));
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("does not report success when the saved policy cannot be read back", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(response({ ok: true, data: fixture("ready") }))
    .mockResolvedValueOnce(response({ ok: true }))
    .mockResolvedValueOnce(response({ ok: false, error: "governance_unavailable" }, 503));
  vi.stubGlobal("fetch", fetcher);
  render(createElement(AIGovernancePanel));
  fireEvent.click(await screen.findByRole("button", { name: "Save autonomy" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("status")).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it('offers explicit accepted offline selection without a cloud default or endpoint/cap fields',async()=>{
 const data={...fixture('ready'),installationAIMode:'offline',customerHostedModels:[{id:'local-a',label:'Local A',tier:'balanced'}]};
 const fetcher=vi.fn().mockResolvedValueOnce(response({ok:true,data})).mockResolvedValueOnce(response({ok:true})).mockResolvedValue(response({ok:true,data}));vi.stubGlobal('fetch',fetcher);render(createElement(AIGovernancePanel));
 const select=await screen.findByLabelText('Customer-hosted model');const save=screen.getByRole('button',{name:'Save model policy'});
 expect((save as HTMLButtonElement).disabled).toBe(true);expect(screen.queryByText('Service-managed default')).toBeNull();
 fireEvent.change(select,{target:{value:'local-a'}});expect((save as HTMLButtonElement).disabled).toBe(false);fireEvent.click(save);
 await screen.findByText('Model policy saved and reloaded.');const payload=JSON.parse(fetcher.mock.calls[1][1].body);
 expect(payload).toEqual({section:'provider_policy',enabled:true,allowedProviders:['customer_hosted'],modelSelections:{customer_hosted:'local-a'},fallbackOrder:['customer_hosted']});
 expect(screen.getByText(/deployment operator manages/)).toBeTruthy();
});
it('keeps offline selection disabled when no accepted model is available',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({ok:true,data:{...fixture('ready'),installationAIMode:'offline',customerHostedModels:[]}})));render(createElement(AIGovernancePanel));
 expect((await screen.findByRole('button',{name:'Save model policy'}) as HTMLButtonElement).disabled).toBe(true);expect(screen.getByText('Offline · setup required')).toBeTruthy();expect(screen.queryByText('Service-managed default')).toBeNull();
});
