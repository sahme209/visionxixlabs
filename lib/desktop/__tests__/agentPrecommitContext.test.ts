/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const m = vi.hoisted(() => {
  let config = {} as { sessionToken?: string };
  let revision = 0;
  const listeners = new Set<() => void>();
  return { replaceSilently: (next: typeof config) => { config = next; }, client: {
    get config() { return config; },
    set config(next) {
      const changed = next.sessionToken !== config.sessionToken;
      config = next;
      if (changed) { revision += 1; for (const listener of listeners) listener(); }
    },
    // Stable external-store methods survive resetAllMocks, like the real client.
    getContextRevision: () => revision,
    subscribeContext: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    hasAuth: vi.fn(), verifyCurrentCredential: vi.fn(), listAgentConversations: vi.fn(), getAgentConversation: vi.fn(), aiProviderStatus: vi.fn(), listAgentSkills: vi.fn(), listGithubRepositories: vi.fn(), listGithubBranches: vi.fn(), listGithubFiles: vi.fn(), listEnvironments: vi.fn(), sendAgentMessage: vi.fn(), createAgentConversation: vi.fn(), approveAgentAction: vi.fn(), rejectAgentAction: vi.fn()
  } };
});
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: m.client }));
vi.mock("../../../desktop/src/lib/useNativeMenuActions", () => ({ useNativeMenuActions: vi.fn() }));
vi.mock("../../../desktop/src/lib/preferences", () => ({ readDesktopPreferences: async () => null, writeDesktopPreferences: vi.fn() }));
import { AgentChatView } from "../../../desktop/src/views/AgentChatView";
const ready = { ok: true, data: { providers: [{ provider: "vercel_gateway", models: [{ id: "fixture/model", label: "Fixture model", tier: "standard" }] }], policy: { enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: "fixture/model" }, fallbackOrder: ["vercel_gateway"] } } };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const summary = { id: "conversation-1", title: "Saved chat", createdAt: "2026-10-16T00:00:00Z", updatedAt: "2026-10-16T00:00:00Z", turnCount: 0 };
beforeEach(() => {
  vi.resetAllMocks(); window.localStorage.clear(); Element.prototype.scrollTo = vi.fn(); m.client.config = {};
  m.client.listAgentConversations.mockResolvedValue({ ok: true, data: { conversations: [summary] } });
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [], actions: [] } });
  m.client.aiProviderStatus.mockResolvedValue(ready);
  m.client.listAgentSkills.mockResolvedValue({ ok: true, data: { skills: [] } });
  m.client.listGithubRepositories.mockResolvedValue({ ok: true, data: { repositories: [{ id: "repo", fullName: "fixture/repository", defaultBranch: "main", visibility: "private" }] } });
  m.client.listGithubBranches.mockResolvedValue({ ok: true, data: { branches: [{ name: "main", protected: true }] } });
  m.client.listGithubFiles.mockResolvedValue({ ok: true, data: { files: [], truncated: false } });
  m.client.listEnvironments.mockResolvedValue({ ok: true, data: { environments: [{ id: "env-1", name: "Development", tier: "dev" }] } });
  m.client.sendAgentMessage.mockResolvedValue({ ok: true, data: { reply: "Fixture reply", proposal: null, usage: null } });
});
afterEach(cleanup);


it("refuses a retained Send after config replacement before notification and preserves the draft", async () => {
 render(createElement(AgentChatView));
 const input=await screen.findByRole("textbox",{name:"Agent request"});
 fireEvent.change(input,{target:{value:"Keep this exact draft"}});
 await waitFor(()=>expect((screen.getByRole("button",{name:"Send"}) as HTMLButtonElement).disabled).toBe(false));
 m.replaceSilently({sessionToken:"replacement-context"});
 fireEvent.click(screen.getByRole("button",{name:"Send"}));
 expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
 expect((input as HTMLTextAreaElement).value).toBe("Keep this exact draft");
});
for(const approve of [true,false]) it(`refuses retained ${approve?"approval":"rejection"} after config replacement before notification`,async()=>{
 m.client.getAgentConversation.mockResolvedValue({ok:true,data:{...summary,turns:[],actions:[{id:"proposal-A",toolName:"fixture_action",argsJson:{},riskLevel:"medium",status:"proposed"}]}});
 render(createElement(AgentChatView));
 const button=await screen.findByRole("button",{name:approve?"Record approval":"Reject"});
 await waitFor(()=>expect((button as HTMLButtonElement).disabled).toBe(false));
 m.replaceSilently({sessionToken:"replacement-context"});
 fireEvent.click(button);
 expect(m.client.approveAgentAction).not.toHaveBeenCalled();
 expect(m.client.rejectAgentAction).not.toHaveBeenCalled();
});

it("still sends once under the same rendered config",async()=>{
 render(createElement(AgentChatView)); const input=await screen.findByRole("textbox",{name:"Agent request"});
 fireEvent.change(input,{target:{value:"Same-context request"}});
 await waitFor(()=>expect((screen.getByRole("button",{name:"Send"}) as HTMLButtonElement).disabled).toBe(false));
 fireEvent.click(screen.getByRole("button",{name:"Send"}));
 await waitFor(()=>expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1));
});
for(const approve of [true,false]) it(`still records same-context ${approve?"approval":"rejection"} once`,async()=>{
 m.client.getAgentConversation.mockResolvedValue({ok:true,data:{...summary,turns:[],actions:[{id:"proposal-A",toolName:"fixture_action",argsJson:{},riskLevel:"medium",status:"proposed"}]}});
 m.client.approveAgentAction.mockResolvedValue({ok:true,data:{status:"approved"}});m.client.rejectAgentAction.mockResolvedValue({ok:true,data:{status:"rejected"}});
 render(createElement(AgentChatView));const button=await screen.findByRole("button",{name:approve?"Record approval":"Reject"});
 fireEvent.click(button); await waitFor(()=>expect(approve?m.client.approveAgentAction:m.client.rejectAgentAction).toHaveBeenCalledTimes(1));
 expect(approve?m.client.rejectAgentAction:m.client.approveAgentAction).not.toHaveBeenCalled();
});

for (const changed of [true,false]) it(`conversation control new chat ${changed?"refuses stale context":"works in same context"}`, async()=>{
 m.client.createAgentConversation.mockResolvedValue({ok:true,data:{id:"new-conversation",title:null,createdAt:summary.createdAt}});
 render(createElement(AgentChatView));const input=await screen.findByRole("textbox",{name:"Agent request"});
 await waitFor(()=>expect((screen.getByRole("button",{name:"New chat"}) as HTMLButtonElement).disabled).toBe(false));
 fireEvent.change(input,{target:{value:"Retained conversation draft"}});
 if(changed)m.replaceSilently({sessionToken:"replacement-context"});
 fireEvent.click(screen.getByRole("button",{name:"New chat"}));
 if(changed){expect(m.client.createAgentConversation).not.toHaveBeenCalled();expect((input as HTMLTextAreaElement).value).toBe("Retained conversation draft");}
 else await waitFor(()=>expect(m.client.createAgentConversation).toHaveBeenCalledTimes(1));
});
for (const changed of [true,false]) it(`conversation control open chat ${changed?"refuses stale context":"works in same context"}`, async()=>{
 const other={...summary,id:"conversation-2",title:"Other saved chat"};
 m.client.listAgentConversations.mockResolvedValue({ok:true,data:{conversations:[summary,other]}});
 render(createElement(AgentChatView));await screen.findByRole("textbox",{name:"Agent request"});
 await waitFor(()=>expect((screen.getByRole("combobox",{name:"Agent conversation"}) as HTMLSelectElement).value).toBe(summary.id));
 m.client.getAgentConversation.mockClear();m.client.getAgentConversation.mockResolvedValue({ok:true,data:{...other,turns:[],actions:[]}});
 if(changed)m.replaceSilently({sessionToken:"replacement-context"});
 fireEvent.change(screen.getByRole("combobox",{name:"Agent conversation"}),{target:{value:other.id}});
 if(changed)expect(m.client.getAgentConversation).not.toHaveBeenCalled();
 else await waitFor(()=>expect(m.client.getAgentConversation).toHaveBeenCalledWith(other.id));
});
