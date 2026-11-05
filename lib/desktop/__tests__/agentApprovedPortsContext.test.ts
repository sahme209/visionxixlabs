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
    hasAuth: vi.fn(), verifyCurrentCredential: vi.fn(), listAgentConversations: vi.fn(), getAgentConversation: vi.fn(), aiProviderStatus: vi.fn(), listAgentSkills: vi.fn(), listGithubRepositories: vi.fn(), listGithubBranches: vi.fn(), listGithubFiles: vi.fn(), listEnvironments: vi.fn(), sendAgentMessage: vi.fn(), createAgentConversation: vi.fn(), approveAgentAction: vi.fn(), rejectAgentAction: vi.fn(), readAgentActionExecution: vi.fn(), readAgentActionEligibility: vi.fn(), mutateAgentActionExecution: vi.fn()
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



const operationId="agent_execution_"+"a".repeat(64);
const prepared={id:operationId,proposalId:"approved-A",toolName:"create_github_branch",state:"prepared",version:0,attemptCount:0,createdAt:"2030-01-01T00:00:00.000Z",expiresAt:"2030-01-01T00:01:00.000Z",observedAt:"2030-01-01T00:00:01.000Z",recoveryState:"not_started"};
for(const kind of ["readiness","outcome","prepare","execute","cancel"] as const)for(const changed of [true,false])it(`saved action port ${kind} ${changed?"refuses replaced config":"works in rendered config"}`,async()=>{
 m.client.getAgentConversation.mockResolvedValue({ok:true,data:{...summary,turns:[],actions:[{id:"approved-A",toolName:"create_github_branch",argsJson:{repositoryFullName:"fixture/repository",baseBranch:"main",newBranchName:"fixture"},riskLevel:"medium",status:"approved"}]}});
 m.client.readAgentActionExecution.mockResolvedValue({ok:true,data:prepared});
 m.client.readAgentActionEligibility.mockResolvedValue({ok:true,data:{proposalId:"approved-A",canPrepare:kind!=="execute",canExecute:kind==="execute",reason:kind==="execute"?"ready_to_execute":"ready_to_prepare",expiresAt:prepared.expiresAt,effect:"Create the exact reviewed fixture branch.",...(kind==="execute"?{operationId}:{})}});
 m.client.mutateAgentActionExecution.mockImplementation(async(input)=>({ok:true,data:input.operation==="prepare"?prepared:{...prepared,state:input.operation==="cancel"?"cancelled":"confirmed",version:input.operation==="cancel"?1:2,attemptCount:input.operation==="cancel"?0:1,recoveryState:input.operation==="cancel"?"cancelled":"confirmed",...(input.operation==="execute"?{receipt:{code:"action_completed"}}:{})}}));
 render(createElement(AgentChatView));await screen.findByRole("region",{name:"Approved Agent actions"});
 if(kind==="execute"||kind==="cancel"){fireEvent.click(screen.getByRole("button",{name:"Check saved action outcome"}));await screen.findByRole("button",{name:"Cancel unused action"});}
 if(kind==="prepare"||kind==="execute"){fireEvent.click(screen.getByRole("button",{name:"Check execution readiness"}));await screen.findByRole("button",{name:kind==="prepare"?"Prepare reviewed action":"Execute approved action once"});}
 const label={readiness:"Check execution readiness",outcome:"Check saved action outcome",prepare:"Prepare reviewed action",execute:"Execute approved action once",cancel:"Cancel unused action"}[kind];
 for(const method of [m.client.readAgentActionExecution,m.client.readAgentActionEligibility,m.client.mutateAgentActionExecution])method.mockClear();
 if(changed)m.replaceSilently({sessionToken:"replacement-context"});fireEvent.click(screen.getByRole("button",{name:label}));
 if(changed){expect(m.client.readAgentActionExecution).not.toHaveBeenCalled();expect(m.client.readAgentActionEligibility).not.toHaveBeenCalled();expect(m.client.mutateAgentActionExecution).not.toHaveBeenCalled();}
 else {const method=kind==="readiness"?m.client.readAgentActionEligibility:kind==="outcome"?m.client.readAgentActionExecution:m.client.mutateAgentActionExecution;await waitFor(()=>expect(method).toHaveBeenCalledTimes(1));if(kind==="prepare")expect(method.mock.calls[0][0]).toEqual({operation:"prepare",proposalId:"approved-A"});if(kind==="execute"||kind==="cancel")expect(method.mock.calls[0][0]).toEqual({operation:kind,id:operationId});}
});
