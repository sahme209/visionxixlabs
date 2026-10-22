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
