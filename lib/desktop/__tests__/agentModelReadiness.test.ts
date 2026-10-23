/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const m = vi.hoisted(() => ({ invoke: vi.fn(), preferences: vi.fn(), client: { subscribeContext: () => () => {}, getContextRevision: () => 0, config: {} as { sessionToken?: string }, hasAuth: vi.fn(), verifyCurrentCredential: vi.fn(), listAgentConversations: vi.fn(), getAgentConversation: vi.fn(), aiProviderStatus: vi.fn(), listAgentSkills: vi.fn(), listGithubRepositories: vi.fn(), listGithubBranches: vi.fn(), listGithubFiles: vi.fn(), listEnvironments: vi.fn(), sendAgentMessage: vi.fn(), createAgentConversation: vi.fn(), approveAgentAction: vi.fn(), rejectAgentAction: vi.fn() } }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: m.invoke }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: m.client }));
vi.mock("../../../desktop/src/lib/useNativeMenuActions", () => ({ useNativeMenuActions: vi.fn() }));
vi.mock("../../../desktop/src/lib/preferences", () => ({ readDesktopPreferences: m.preferences, writeDesktopPreferences: vi.fn() }));
import { AgentChatView } from "../../../desktop/src/views/AgentChatView";
import App from "../../../desktop/src/App";
const ready = { ok: true, data: { providers: [{ provider: "vercel_gateway", models: [{ id: "fixture/model", label: "Fixture model", tier: "standard" }] }], policy: { enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: "fixture/model" }, fallbackOrder: ["vercel_gateway"] } } };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const summary = { id: "conversation-1", title: "Saved chat", createdAt: "2026-10-16T00:00:00Z", updatedAt: "2026-10-16T00:00:00Z", turnCount: 0 };
beforeEach(() => {
  vi.resetAllMocks(); m.preferences.mockResolvedValue(null); window.localStorage.clear(); Element.prototype.scrollTo = vi.fn(); m.client.config = {};
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
async function draft() { await waitFor(() => expect((screen.getByRole("combobox", { name: "Agent conversation" }) as HTMLSelectElement).value).toBe("conversation-1")); fireEvent.change(screen.getByRole("textbox"), { target: { value: "Keep this unsent request" } }); }
it("publishes ready model and context while conversation history is still loading", async () => {
  const history = deferred<unknown>(); m.client.listAgentConversations.mockReturnValue(history.promise);
  render(createElement(AgentChatView));
  await screen.findByRole("option", { name: "Fixture model" });
  await waitFor(() => expect((screen.getByRole("combobox", { name: "Active GitHub repository" }) as HTMLSelectElement).disabled).toBe(false));
  expect(screen.getByRole("option", { name: "Development · dev" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { history.resolve({ ok: true, data: { conversations: [summary] } }); });
});
it.each([{ ok: false, error: "provider_policy_unavailable" }, { ok: true, data: {} }])("keeps successful context usable and blocks click and Enter after unavailable model data %j", async failure => {
  m.client.aiProviderStatus.mockResolvedValue(failure); render(createElement(AgentChatView)); await draft();
  await screen.findByRole("button", { name: "Retry models" });
  expect((screen.getByRole("combobox", { name: "Active GitHub repository" }) as HTMLSelectElement).disabled).toBe(false);
  expect((screen.getByRole("combobox", { name: "Active deployment environment" }) as HTMLSelectElement).disabled).toBe(false);
  expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Send" })); fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep this unsent request");
});
it("retries only models without changing draft, conversation or selected context or sending", async () => {
  m.client.aiProviderStatus.mockResolvedValueOnce({ ok: false, error: "provider_policy_unavailable" }).mockResolvedValue(ready);
  render(createElement(AgentChatView)); await draft();
  fireEvent.change(screen.getByRole("combobox", { name: "Active deployment environment" }), { target: { value: "env-1" } });
  fireEvent.click(await screen.findByRole("button", { name: "Retry models" }));
  await screen.findByRole("option", { name: "Fixture model" });
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect((screen.getByRole("combobox", { name: "Active deployment environment" }) as HTMLSelectElement).value).toBe("env-1");
  expect(m.client.listAgentConversations).toHaveBeenCalledOnce(); expect(m.client.getAgentConversation).toHaveBeenCalledOnce();
  expect(m.client.listGithubRepositories).toHaveBeenCalledOnce(); expect(m.client.createAgentConversation).not.toHaveBeenCalled(); expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(false);
});
it("distinguishes disabled policy and opens the precise Models destination", async () => {
  m.client.aiProviderStatus.mockResolvedValue({ ...ready, data: { ...ready.data, policy: { ...ready.data.policy, enabled: false } } });
  const open = vi.fn(); render(createElement(AgentChatView, { onOpenSettings: open })); await draft();
  await screen.findByText(/AI is disabled for this workspace/);
  fireEvent.click(screen.getByRole("button", { name: "Model settings" })); expect(open).toHaveBeenCalledWith("models");
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" }); expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("distinguishes empty service catalog from disabled workspace policy", async () => {
  m.client.aiProviderStatus.mockResolvedValue({ ok: true, data: { providers: [], policy: { enabled: true, allowedProviders: [], modelSelections: {}, fallbackOrder: [] } } });
  render(createElement(AgentChatView)); await draft(); await screen.findByText(/No service-configured AI model is available/);
  expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
});
it("accepts an approved service-managed default absent from the named catalog", async () => {
  m.client.aiProviderStatus.mockResolvedValue({ ok: true, data: { ...ready.data, policy: { ...ready.data.policy, modelSelections: { vercel_gateway: "service-default" } } } });
  render(createElement(AgentChatView)); await draft();
  await screen.findByRole("option", { name: /Service-managed default/ });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" }); await screen.findByText("Fixture reply");
  expect(m.client.sendAgentMessage.mock.calls[0][2]).toBe("vercel_gateway");
});
it("blocks new sends while model verification is loading", async () => {
  const pending = deferred<unknown>(); m.client.aiProviderStatus.mockReturnValue(pending.promise); render(createElement(AgentChatView));
  await draft(); await screen.findByText(/Checking workspace models/); fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  await act(async () => { pending.resolve(ready); });
});
it("ignores an old model retry after credential replacement", async () => {
  const old = deferred<unknown>(); m.client.aiProviderStatus.mockResolvedValueOnce({ ok: false, error: "unavailable" }).mockReturnValueOnce(old.promise).mockResolvedValue({ ok: true, data: { ...ready.data, providers: [], policy: { enabled: false, allowedProviders: [], modelSelections: {}, fallbackOrder: [] } } });
  const view = render(createElement(AgentChatView)); await screen.findByText(/Workspace models could not be verified/); fireEvent.click(screen.getByRole("button", { name: "Retry models" }));
  m.client.config = { sessionToken: "replacement" }; view.rerender(createElement(AgentChatView)); await screen.findByText(/AI is disabled for this workspace/);
  await act(async () => { old.resolve(ready); }); expect(screen.queryByRole("option", { name: "Fixture model" })).toBeNull();
});
it("keeps a saved proposal rejectable while models are unavailable", async () => {
  m.client.aiProviderStatus.mockResolvedValue({ ok: false, error: "unavailable" });
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [], actions: [{ id: "proposal", status: "proposed", toolName: "create_github_branch", riskLevel: "medium", argsJson: { repositoryFullName: "fixture/repository", baseBranch: "main", newBranchName: "change" } }] } });
  m.client.rejectAgentAction.mockResolvedValue({ ok: true, data: { status: "rejected" } });
  render(createElement(AgentChatView)); fireEvent.click(await screen.findByRole("button", { name: "Reject" })); await screen.findByText(/Create a branch — rejected/);
  expect(screen.getByRole("button", { name: "Retry models" })).toBeTruthy(); expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("allows repository selection while the independent environment catalog is delayed", async () => {
  const environments = deferred<unknown>(); m.client.listEnvironments.mockReturnValue(environments.promise);
  render(createElement(AgentChatView)); await screen.findByRole("option", { name: "fixture/repository · private" });
  expect((screen.getByRole("combobox", { name: "Active GitHub repository" }) as HTMLSelectElement).disabled).toBe(false);
  await act(async () => { environments.resolve({ ok: true, data: { environments: [] } }); });
});
it("does not erase an environment failure when repository branches load successfully", async () => {
  m.client.listEnvironments.mockResolvedValue({ ok: false, error: "unavailable" }); render(createElement(AgentChatView));
  await screen.findByRole("option", { name: "main · protected" }); await screen.findByText(/Deployment environments could not be loaded/);
});
it.each([{ ok: false, error: "provider_policy_unavailable" }, { ok: true, data: {} }])("opens Settings Models through the real App callback and retries its failed lookup before returning to Agent %j", async failure => {
  m.client.hasAuth.mockReturnValue(true);
  m.client.verifyCurrentCredential.mockResolvedValue({ ok: true, data: { kind: "desktop_session", organizationId: "fixture-workspace", role: "owner", capabilities: [], access: { allowed: true, code: "active", title: "Access active", message: "Fixture", billingStatus: "no_plan", planTier: "trial" } } });
  m.client.aiProviderStatus.mockResolvedValueOnce({ ...ready, data: { ...ready.data, policy: { ...ready.data.policy, enabled: false } } }).mockResolvedValueOnce(failure).mockResolvedValue(ready);
  render(createElement(App)); fireEvent.click(await screen.findByRole("button", { name: "Model settings" }));
  await screen.findByRole("heading", { name: "Models" });
  await screen.findByRole("alert");
  expect(screen.queryByText(/No service-configured models are available/)).toBeNull();
  fireEvent.click(await screen.findByRole("button", { name: "Retry models" }));
  await screen.findByRole("switch", { name: "Disable Fixture model" });
  fireEvent.click(screen.getByRole("button", { name: "Back to workspace" })); await screen.findByRole("option", { name: "Fixture model" });
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled(); expect(m.client.createAgentConversation).not.toHaveBeenCalled();
});
it("sends an approved alternate Gateway choice as the optional fifth argument in both composer modes",async()=>{
 m.client.listGithubFiles.mockResolvedValue({ok:true,data:{files:[{path:"src/verified.ts",size:12}],truncated:false}});
 const data={...ready.data,providers:[{provider:"vercel_gateway",models:[...ready.data.providers[0].models,{id:"xai/grok-4",label:"Grok",tier:"standard"}]}],policy:{...ready.data.policy,gatewaySelection:{version:1,defaultModelId:"fixture/model",approvedModelIds:["fixture/model","xai/grok-4"]}}};m.client.aiProviderStatus.mockResolvedValue({ok:true,data});render(createElement(AgentChatView));await screen.findByRole("option",{name:"Grok"});fireEvent.change(screen.getByRole("combobox",{name:"Agent model"}),{target:{value:JSON.stringify(["vercel_gateway","xai/grok-4"])}});await draft();fireEvent.click(screen.getByRole("button",{name:"Send"}));await waitFor(()=>expect(m.client.sendAgentMessage).toHaveBeenCalledWith("conversation-1","Keep this unsent request","vercel_gateway",expect.objectContaining({mode:"chat"}),"xai/grok-4",expect.objectContaining({signal:expect.anything(),onDraft:expect.any(Function)})));fireEvent.click(screen.getByRole("button",{name:"Edit repository file"}));expect((screen.getByRole("combobox",{name:"Agent model"})as HTMLSelectElement).value).toBe(JSON.stringify(["vercel_gateway","xai/grok-4"]));
 await screen.findByRole("option",{name:"src/verified.ts"});fireEvent.change(screen.getByRole("combobox",{name:"Repository file"}),{target:{value:"src/verified.ts"}});fireEvent.change(screen.getByRole("textbox"),{target:{value:"Review this file"}});await waitFor(()=>expect((screen.getByRole("button",{name:"Send"})as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByRole("button",{name:"Send"}));await waitFor(()=>expect(m.client.sendAgentMessage).toHaveBeenLastCalledWith("conversation-1","Review this file","vercel_gateway",expect.objectContaining({mode:"code",filePath:"src/verified.ts"}),"xai/grok-4",expect.objectContaining({signal:expect.anything(),onDraft:expect.any(Function)})));
});
it("remembers only a still-approved choice within its verified workspace",async()=>{
 Object.assign(m.client.config,{apiBase:"https://visionxixlabs.com"});const identity={organizationId:"verified-one"} as never;
 m.client.aiProviderStatus.mockResolvedValue({ok:true,data:{...ready.data,providers:[{provider:"vercel_gateway",models:[...ready.data.providers[0].models,{id:"xai/grok-4",label:"Grok",tier:"standard"}]}],policy:{...ready.data.policy,gatewaySelection:{version:1,defaultModelId:"fixture/model",approvedModelIds:["fixture/model","xai/grok-4"]}}}});
 const view=render(createElement(AgentChatView,{identity}));await screen.findByRole("option",{name:"Grok"});const chosen=JSON.stringify(["vercel_gateway","xai/grok-4"]);fireEvent.change(screen.getByRole("combobox",{name:"Agent model"}),{target:{value:chosen}});view.unmount();render(createElement(AgentChatView,{identity}));await waitFor(()=>expect((screen.getByRole("combobox",{name:"Agent model"})as HTMLSelectElement).value).toBe(chosen));
 m.client.aiProviderStatus.mockResolvedValue(ready);fireEvent(window,new Event("focus"));await waitFor(()=>expect((screen.getByRole("combobox",{name:"Agent model"})as HTMLSelectElement).value).toBe(JSON.stringify(["vercel_gateway","fixture/model"])));expect(screen.getByText(/Your previous model is no longer available/)).toBeTruthy();
});


it.each(["chat", "code"])("shows real-time %s drafts without granting approval authority", async mode => {
  const completion = deferred<unknown>();
  m.client.sendAgentMessage.mockImplementation((...args) => { args[5].onDraft("Reviewing the selected code"); return completion.promise; });
  m.client.listGithubFiles.mockResolvedValue({ ok: true, data: { files: [{ path: "src/app.ts", size: 10 }], truncated: false } });
  render(createElement(AgentChatView)); await draft();
  if (mode === "code") {
    fireEvent.click(screen.getByRole("button", { name: "Edit repository file" }));
    await waitFor(() => expect((screen.getByRole("combobox", { name: "Repository file" }) as HTMLSelectElement).disabled).toBe(false));
    await screen.findByRole("option", { name: "src/app.ts" });
    fireEvent.change(screen.getByRole("combobox", { name: "Repository file" }), { target: { value: "src/app.ts" } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Reviewing the selected code");
  expect(screen.getByText(/verification pending/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Approve & run" })).toBeNull();
  expect(m.client.sendAgentMessage.mock.calls[0][3]).toMatchObject({ mode, ...(mode === "code" ? { filePath: "src/app.ts" } : {}) });
  await act(async () => { completion.resolve({ ok: true, data: { reply: "Reviewed change ready", proposal: { id: "p", toolName: "commit_github_file", argsJson: { repositoryFullName: "fixture/repository", branch: "main", path: "src/app.ts", content: "new code" }, riskLevel: "medium", status: "proposed" }, usage: null } }); });
  await screen.findByText("Reviewed change ready");
  expect(screen.queryByText("Reviewing the selected code")).toBeNull();
  expect(screen.getByRole("button", { name: "Approve & run" })).toBeTruthy();
  expect(m.client.approveAgentAction).not.toHaveBeenCalled();
});
it("stops an in-flight draft and ignores later text without retrying or presenting success", async () => {
  const completion = deferred<unknown>();
  let streaming!: { signal: AbortSignal; onDraft: (text: string) => void };
  m.client.sendAgentMessage.mockImplementation((...args) => { streaming = args[5]; streaming.onDraft("Partial explanation"); return completion.promise; });
  render(createElement(AgentChatView)); await draft();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Partial explanation");
  fireEvent.click(screen.getByRole("button", { name: "Stop response" }));
  expect(streaming.signal.aborted).toBe(true);
  await act(async () => { streaming.onDraft("Late stale draft"); completion.resolve({ ok: false, error: "Request stopped" }); });
  expect(screen.queryByText("Late stale draft")).toBeNull();
  expect(screen.queryByText("Partial explanation")).toBeNull();
  expect(m.client.sendAgentMessage).toHaveBeenCalledOnce(); expect(m.client.approveAgentAction).not.toHaveBeenCalled();
});


it("reloads the saved conversation after interruption without resending or approving", async () => {
  m.client.sendAgentMessage.mockResolvedValue({ ok: false, error: "Response interrupted. Reload the conversation." });
  render(createElement(AgentChatView)); await draft();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  const reload = await screen.findByRole("button", { name: "Reload saved conversation" });
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary,
    turns: [{ id: "saved-reply", role: "assistant", content: "Saved server explanation", actionProposalId: null, createdAt: "2026-10-20T00:00:00Z" }],
    actions: [{ id: "saved-proposal", toolName: "commit_github_file", argsJson: { path: "src/app.ts" }, riskLevel: "medium", status: "proposed", resultJson: null, errorMessage: null, createdAt: "2026-10-20T00:00:00Z" }],
  } });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Keep my unsent follow-up" } });
  fireEvent.click(reload);
  await screen.findByText("Saved server explanation");
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep my unsent follow-up");
  expect(screen.queryByText("Response interrupted. Reload the conversation.")).toBeNull();
  expect(screen.getByRole("button", { name: "Approve & run" })).toBeTruthy();
  expect(m.client.getAgentConversation).toHaveBeenCalledTimes(2);
  expect(m.client.sendAgentMessage).toHaveBeenCalledOnce();
  expect(m.client.approveAgentAction).not.toHaveBeenCalled(); expect(m.client.createAgentConversation).not.toHaveBeenCalled();
});
it("opens Agent permissions in Settings without resending or discarding the current draft", async () => {
  const open = vi.fn(); render(createElement(AgentChatView, { onOpenSettings: open })); await draft();
  fireEvent.click(screen.getByRole("button", { name: "Agent permissions" }));
  expect(open).toHaveBeenCalledExactlyOnceWith("agents");
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("preserves the actual App composer, profile and environment across an in-app Settings visit", async () => {
  m.client.hasAuth.mockReturnValue(true);
  m.client.verifyCurrentCredential.mockResolvedValue({ ok: true, data: { kind: "desktop_session", organizationId: "fixture-workspace", role: "owner", capabilities: [], access: { allowed: true, code: "active", title: "Access active", message: "Fixture", billingStatus: "no_plan", planTier: "trial" } } });
  render(createElement(App)); await draft();
  fireEvent.change(screen.getByRole("combobox", { name: "Specialized Agent" }), { target: { value: "code_review" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Active deployment environment" }), { target: { value: "env-1" } });
  fireEvent.click(screen.getByRole("button", { name: "Agent permissions" }));
  await screen.findByRole("heading", { name: "Agents" });
  expect(screen.queryByRole("navigation", { name: "Deployment workspace" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Back to workspace" }));
  await screen.findByRole("option", { name: "Fixture model" });
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect((screen.getByRole("combobox", { name: "Specialized Agent" }) as HTMLSelectElement).value).toBe("code_review");
  expect((screen.getByRole("combobox", { name: "Active deployment environment" }) as HTMLSelectElement).value).toBe("env-1");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("deactivation aborts streaming and never accepts a late success while retaining an unsent follow-up", async () => {
  const completion = deferred<unknown>(); let signal!: AbortSignal;
  m.client.sendAgentMessage.mockImplementation((...args) => { signal = args[5].signal; args[5].onDraft("Partial"); return completion.promise; });
  const view = render(createElement(AgentChatView, { active: true })); await draft();
  fireEvent.click(screen.getByRole("button", { name: "Send" })); await screen.findByText("Partial");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Unsent follow-up" } });
  view.rerender(createElement(AgentChatView, { active: false }));
  expect(signal.aborted).toBe(true);
  await act(async () => { completion.resolve({ ok: true, data: { reply: "Late success", proposal: { id: "late", toolName: "commit_github_file", argsJson: {}, riskLevel: "medium", status: "proposed" } } }); });
  view.rerender(createElement(AgentChatView, { active: true }));
  await waitFor(() => expect(m.client.aiProviderStatus.mock.calls.length).toBeGreaterThan(1));
  expect(screen.queryByText("Late success")).toBeNull(); expect(screen.queryByRole("button", { name: "Approve & run" })).toBeNull();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Unsent follow-up");
  expect(m.client.sendAgentMessage).toHaveBeenCalledOnce();
});
it("requires recovery and settlement before another send after a stopped request", async () => {
  let rejectOld!: (reason: Error) => void;
  const old = new Promise<never>((_resolve, reject) => { rejectOld = reject; });
  m.client.sendAgentMessage.mockImplementationOnce((...args) => { args[5].onDraft("Old pending response"); return old; });
  const view = render(createElement(AgentChatView, { active: true })); await draft();
  fireEvent.click(screen.getByRole("button", { name: "Send" })); await screen.findByText("Old pending response");
  view.rerender(createElement(AgentChatView, { active: false })); view.rerender(createElement(AgentChatView, { active: true }));
  m.client.sendAgentMessage.mockResolvedValue({ ok: false, error: "Current request budget refusal" });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "New request" } });
  expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", {name: "Reload saved conversation"}));
  await waitFor(() => expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1); // Abort is not settlement.
  await act(async () => { rejectOld(new Error("Old transport failed")); });
  expect(screen.queryByText("Old transport failed")).toBeNull();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("New request");
  fireEvent.click(screen.getByRole("button", { name: "Send" })); await screen.findByText("Current request budget refusal");
  expect(screen.getByText("Current request budget refusal")).toBeTruthy();
});
it("does not install stale evidence from a stopped request's delayed history refresh", async () => {
  const old = deferred<unknown>();
  const view = render(createElement(AgentChatView, { active: true })); await draft();
  m.client.getAgentConversation.mockReturnValueOnce(old.promise);
  m.client.sendAgentMessage.mockResolvedValue({ ok: true, data: { reply: "First accepted reply", proposal: null, usage: null } });
  fireEvent.click(screen.getByRole("button", { name: "Send" })); await screen.findByText("First accepted reply");
  view.rerender(createElement(AgentChatView, { active: false })); view.rerender(createElement(AgentChatView, { active: true }));
  m.client.sendAgentMessage.mockResolvedValue({ ok: false, error: "Current request budget refusal" });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "New request" } });
  await waitFor(() => expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", {name: "Reload saved conversation"}));
  await waitFor(() => expect(m.client.getAgentConversation).toHaveBeenCalledTimes(3));
  await waitFor(() => expect((screen.getByRole("button", {name: "Send"}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1);
  await act(async () => { old.resolve({ ok: true, data: { ...summary, turns: [], actions: [{ id: "stale", toolName: "read_github_file", argsJson: { repositoryFullName: "fixture/repository", branch: "main", path: "stale-probe.ts" }, riskLevel: "low", status: "executed", resultJson: { content: "Old evidence" }, errorMessage: null, createdAt: "2026-10-20" }] } }); });
  expect(screen.queryByText(/stale-probe.ts/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Send" })); await screen.findByText("Current request budget refusal");
  expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(2);
});

it("opens recorded repository evidence inside the Agent without another service request", async () => {
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [], actions: [{ id: "read-record", toolName: "read_github_file", argsJson: {path: "src/main.ts"}, resultJson: { path: "src/main.ts", content: "recorded source", sha: "saved-sha" }, riskLevel: "low", status: "executed" }] } });
  render(createElement(AgentChatView));
  const disclosure = await screen.findByText("Inspect recorded repository evidence");
  const reads = m.client.getAgentConversation.mock.calls.length;
  fireEvent.click(disclosure);
  expect(screen.getByText("recorded source")).toBeTruthy();
  expect(m.client.getAgentConversation).toHaveBeenCalledTimes(reads);
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  expect(m.client.approveAgentAction).not.toHaveBeenCalled();
});

it("retains an unsaved local file across actual App navigation without another file read", async () => {
  m.client.hasAuth.mockReturnValue(true);
  m.client.verifyCurrentCredential.mockResolvedValue({ ok: true, data: { kind: "desktop_session", organizationId: "fixture-workspace", role: "owner", capabilities: [], access: { allowed: true, code: "active", title: "Access active", message: "Fixture", billingStatus: "no_plan", planTier: "trial" } } });
  m.invoke.mockImplementation(async (command: string) => {
    if (command === "default_repos_directory") return "/owned";
    if (command === "list_local_repositories") return ["/owned/A"];
    if (command === "repository_status") return {rootPath: "/owned/A", repositoryFullName: "fixture/repository", branch: "feature", ahead: 0, behind: 0, changedFiles: []};
    if (command === "list_repository_files") return ["main.ts"];
    if (command === "detect_repository_checks") return [];
    if (command === "read_repository_file") return "saved local content";
    throw new Error(`Unexpected command ${command}`);
  });
  render(createElement(App));
  await screen.findByRole("button", {name: "Agent permissions"});
  fireEvent.click(screen.getByRole("button", {name: "GitHub repositories"}));
  fireEvent.click(await screen.findByRole("button", {name: "main.ts"}));
  fireEvent.change(await screen.findByRole("textbox", {name: "Editing main.ts"}), {target: {value: "unsaved local draft"}});
  fireEvent.click(screen.getByRole("button", {name: "Agent"}));
  fireEvent.click(screen.getByRole("button", {name: "GitHub repositories"}));
  expect((await screen.findByRole("textbox", {name: "Editing main.ts"}) as HTMLTextAreaElement).value).toBe("unsaved local draft");
  expect(m.invoke.mock.calls.filter(([command]) => command === "read_repository_file")).toHaveLength(1);
  expect(m.invoke.mock.calls.filter(([command]) => command === "write_repository_file")).toHaveLength(0);
});

it("keeps unsent prompts separate when switching conversations", async () => {
  const second = {...summary, id: "conversation-2", title: "Second task"};
  m.client.listAgentConversations.mockResolvedValue({ok: true, data: {conversations: [summary, second]}});
  m.client.getAgentConversation.mockImplementation(async (id: string) => ({ok: true, data: {...summary, id, turns: [], actions: []}}));
  render(createElement(AgentChatView)); await draft();
  fireEvent.change(screen.getByRole("combobox", {name: "Agent conversation"}), {target: {value: second.id}});
  await waitFor(() => expect((screen.getByRole("combobox", {name: "Agent conversation"}) as HTMLSelectElement).value).toBe(second.id));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  fireEvent.change(screen.getByRole("textbox"), {target: {value: "Second unsent task"}});
  fireEvent.change(screen.getByRole("combobox", {name: "Agent conversation"}), {target: {value: summary.id}});
  await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep this unsent request"));
  fireEvent.change(screen.getByRole("combobox", {name: "Agent conversation"}), {target: {value: second.id}});
  await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Second unsent task"));
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("preserves the previous unsent prompt when starting a new chat", async () => {
  m.client.createAgentConversation.mockResolvedValue({ok: true, data: {...summary, id: "new-chat"}});
  m.client.getAgentConversation.mockImplementation(async (id: string) => ({ok: true, data: {...summary, id, turns: [], actions: []}}));
  render(createElement(AgentChatView)); await draft();
  fireEvent.click(screen.getByRole("button", {name: "New chat"}));
  await waitFor(() => expect((screen.getByRole("combobox", {name: "Agent conversation"}) as HTMLSelectElement).value).toBe("new-chat"));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  fireEvent.change(screen.getByRole("combobox", {name: "Agent conversation"}), {target: {value: summary.id}});
  await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep this unsent request"));
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("blocks overflowing draft navigation without discarding or creating a chat", async () => {
  render(createElement(AgentChatView)); await draft();
  const prompt = "x".repeat(500001);
  fireEvent.change(screen.getByRole("textbox"), {target: {value: prompt}});
  fireEvent.click(screen.getByRole("button", {name: "New chat"}));
  expect(screen.getByText(/Local draft capacity reached/)).toBeTruthy();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(prompt);
  expect(m.client.createAgentConversation).not.toHaveBeenCalled();
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("preserves the current prompt after a failed conversation switch", async () => {
  m.client.listAgentConversations.mockResolvedValue({ok: true, data: {conversations: [summary, {...summary, id: "other"}]}});
  render(createElement(AgentChatView)); await draft();
  m.client.getAgentConversation.mockResolvedValueOnce({ok: false, error: "fixture_failure"});
  fireEvent.change(screen.getByRole("combobox", {name: "Agent conversation"}), {target: {value: "other"}});
  await screen.findByText("The selected conversation could not be verified.");
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect((screen.getByRole("combobox", {name: "Agent conversation"}) as HTMLSelectElement).value).toBe(summary.id);
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});

it("refreshes enabled skill shortcuts after returning to the Agent and preserves the prompt when selecting one", async () => {
  const skill = {id: "safe-repository-change", name: "Safe repository change", description: "Existing workflow", category: "GitHub", toolNames: ["read_github_file"], status: "enabled", installedAt: null, updatedAt: null};
  const view = render(createElement(AgentChatView, {active: true})); await draft();
  view.rerender(createElement(AgentChatView, {active: false}));
  m.client.listAgentSkills.mockResolvedValue({ok: true, data: {skills: [skill]}});
  view.rerender(createElement(AgentChatView, {active: true}));
  fireEvent.click(await screen.findByRole("button", {name: "/safe-repository-change"}));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("/safe-repository-change Keep this unsent request");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("shows a failed skill lookup and retries it without sending the prompt", async () => {
  m.client.listAgentSkills.mockResolvedValueOnce({ok: false, error: "unavailable"}).mockResolvedValue({ok: true, data: {skills: []}});
  render(createElement(AgentChatView)); await draft();
  fireEvent.click(await screen.findByRole("button", {name: "Retry skills"}));
  await waitFor(() => expect(m.client.listAgentSkills).toHaveBeenCalledTimes(2));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("rejects late enabled-skill shortcuts after leaving and returning with a newer catalog", async () => {
  const old = deferred<{ok: true; data: {skills: unknown[]}}>();
  m.client.listAgentSkills.mockReturnValueOnce(old.promise).mockResolvedValue({ok: true, data: {skills: []}});
  const view = render(createElement(AgentChatView, {active: true})); await draft();
  view.rerender(createElement(AgentChatView, {active: false}));
  view.rerender(createElement(AgentChatView, {active: true}));
  await waitFor(() => expect(m.client.listAgentSkills).toHaveBeenCalledTimes(2));
  await act(async () => {old.resolve({ok: true, data: {skills: [{id: "stale-skill", status: "enabled"}]}});});
  expect(screen.queryByRole("button", {name: "/stale-skill"})).toBeNull();
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("hides previously enabled shortcuts when focus refresh cannot verify installation storage", async () => {
  const skill = {id: "safe-repository-change", name: "Safe repository change", status: "enabled"};
  m.client.listAgentSkills.mockResolvedValueOnce({ok: true, data: {skills: [skill]}}).mockResolvedValue({ok: true, data: {skills: [skill], storageAvailable: false}});
  render(createElement(AgentChatView));
  await screen.findByRole("button", {name: "/safe-repository-change"});
  fireEvent(window, new Event("focus"));
  await screen.findByRole("button", {name: "Retry skills"});
  expect(screen.queryByRole("button", {name: "/safe-repository-change"})).toBeNull();
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("applies a context-bound marketplace skill once after verifying enabled installation without sending", async () => {
  m.client.listAgentSkills.mockResolvedValue({ok: true, data: {skills: [{id: "safe-repository-change", status: "enabled"}]}});
  const view = render(createElement(AgentChatView)); await draft();
  const request = {skillId: "safe-repository-change", context: m.client.config};
  view.rerender(createElement(AgentChatView, {requestedSkill: request}));
  await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("/safe-repository-change Keep this unsent request"));
  fireEvent.change(screen.getByRole("textbox"), {target: {value: "Later unsent edits"}});
  view.rerender(createElement(AgentChatView, {requestedSkill: request}));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Later unsent edits");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("rejects a marketplace intent from a different credential context", async () => {
  m.client.listAgentSkills.mockResolvedValue({ok: true, data: {skills: [{id: "safe-repository-change", status: "enabled"}]}});
  const view = render(createElement(AgentChatView)); await draft();
  view.rerender(createElement(AgentChatView, {requestedSkill: {skillId: "safe-repository-change", context: {}}}));
  await screen.findByText(/Skill selection belongs to a different sign-in/);
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("connects an enabled marketplace skill to the actual App's retained Agent draft", async () => {
  m.client.hasAuth.mockReturnValue(true);
  m.client.verifyCurrentCredential.mockResolvedValue({ok: true, data: {kind: "desktop_session", organizationId: "fixture-workspace", role: "owner", capabilities: [], access: {allowed: true, code: "active", title: "Access active", message: "Fixture", billingStatus: "no_plan", planTier: "trial"}}});
  m.client.listAgentSkills.mockResolvedValue({ok: true, data: {skills: [{id: "safe-repository-change", name: "Safe repository change", description: "Existing workflow", category: "GitHub", toolNames: ["read_github_file"], status: "enabled"}]}});
  render(createElement(App)); await draft();
  fireEvent.click(screen.getByRole("button", {name: "Plugins & Skills"}));
  fireEvent.click(await screen.findByRole("button", {name: "Use in Agent"}));
  await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("/safe-repository-change Keep this unsent request"));
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  expect(m.client.approveAgentAction).not.toHaveBeenCalled();
});
it("rejects an unverified marketplace skill without modifying the draft", async () => {
  const view = render(createElement(AgentChatView)); await draft();
  view.rerender(createElement(AgentChatView, {requestedSkill: {skillId: "missing-skill", context: m.client.config}}));
  await screen.findByText(/selected skill is not verified as enabled/);
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("waits for the fresh activation catalog before applying a marketplace handoff", async () => {
  const skill = {id: "safe-repository-change", status: "enabled"};
  const fresh = deferred<{ok: true; data: {skills: unknown[]}}>();
  m.client.listAgentSkills.mockResolvedValueOnce({ok: true, data: {skills: [skill]}}).mockReturnValueOnce(fresh.promise);
  const view = render(createElement(AgentChatView, {active: true})); await draft();
  await screen.findByRole("button", {name: "/safe-repository-change"});
  view.rerender(createElement(AgentChatView, {active: false}));
  view.rerender(createElement(AgentChatView, {active: true, requestedSkill: {skillId: skill.id, context: m.client.config}}));
  await waitFor(() => expect(m.client.listAgentSkills).toHaveBeenCalledTimes(2));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  await act(async () => {fresh.resolve({ok: true, data: {skills: []}});});
  await screen.findByText(/selected skill is not verified as enabled/);
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("prepares local selected code once in read-only mode without sending or replacing the existing prompt", async () => {
  const view = render(createElement(AgentChatView)); await draft();
  const request = {context: m.client.config, path: "src/main.ts", excerpt: "const answer = 42;"};
  view.rerender(createElement(AgentChatView, {requestedLocalCode: request}));
  await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toContain('"excerpt":"const answer = 42;"'));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toMatch(/^Keep this unsent request\n\n/);
  expect((screen.getByRole("combobox", {name: "Specialized Agent"}) as HTMLSelectElement).value).toBe("code_review");
  fireEvent.change(screen.getByRole("textbox"), {target: {value: "Later draft"}});
  view.rerender(createElement(AgentChatView, {requestedLocalCode: request}));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Later draft");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  expect(m.client.approveAgentAction).not.toHaveBeenCalled();
});
it("rejects a selected-code intent from a previous sign-in", async () => {
  const view = render(createElement(AgentChatView)); await draft();
  view.rerender(createElement(AgentChatView, {requestedLocalCode: {context: {}, path: "src/main.ts", excerpt: "PRIVATE SENTINEL"}}));
  await screen.findByText(/Local selection belongs to a different sign-in/);
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("connects confirmed local selection to the actual App Agent while retaining the local draft", async () => {
  m.client.hasAuth.mockReturnValue(true);
  m.client.verifyCurrentCredential.mockResolvedValue({ok: true, data: {kind: "desktop_session", organizationId: "fixture-workspace", role: "owner", capabilities: [], access: {allowed: true, code: "active", title: "Access active", message: "Fixture", billingStatus: "no_plan", planTier: "trial"}}});
  m.invoke.mockImplementation(async (command: string) => {
    if (command === "default_repos_directory") return "/owned";
    if (command === "list_local_repositories") return ["/owned/A"];
    if (command === "repository_status") return {rootPath: "/owned/A", repositoryFullName: "fixture/repository", branch: "feature", ahead: 0, behind: 0, changedFiles: []};
    if (command === "list_repository_files") return ["main.ts"];
    if (command === "detect_repository_checks") return [];
    if (command === "read_repository_file") return "original code";
    throw new Error(`Unexpected command ${command}`);
  });
  render(createElement(App)); await draft();
  fireEvent.click(screen.getByRole("button", {name: "GitHub repositories"}));
  fireEvent.click(await screen.findByRole("button", {name: "main.ts"}));
  const editor = await screen.findByRole("textbox", {name: "Editing main.ts"}) as HTMLTextAreaElement;
  fireEvent.change(editor, {target: {value: "unsaved selected code"}});
  editor.setSelectionRange(0, 7); fireEvent.select(editor);
  fireEvent.click(screen.getByRole("button", {name: "Ask Agent about selection"}));
  fireEvent.click(screen.getByRole("button", {name: "Prepare Agent draft"}));
  await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toContain('"excerpt":"unsaved"'));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toMatch(/^Keep this unsent request/);
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "GitHub repositories"}));
  expect((screen.getByRole("textbox", {name: "Editing main.ts"}) as HTMLTextAreaElement).value).toBe("unsaved selected code");
  expect(m.invoke.mock.calls.filter(([name]) => name === "write_repository_file")).toHaveLength(0);
});
it.each([false, true, "with-new-file"])("connects a saved AI file proposal to local review and explicit Save without approving GitHub (multi=%s)", async multi => {
  m.client.hasAuth.mockReturnValue(true);
  m.client.verifyCurrentCredential.mockResolvedValue({ok: true, data: {kind: "desktop_session", organizationId: "fixture-workspace", role: "owner", capabilities: [], access: {allowed: true, code: "active", title: "Access active", message: "Fixture", billingStatus: "no_plan", planTier: "trial"}}});
  const proposal = {id: "file-proposal", toolName: "commit_github_file", status: "proposed", riskLevel: "medium", argsJson: {repositoryFullName: "fixture/repository", branch: "feature", path: "main.ts", content: "proposed local change", _review: {kind: "github_file", baseSha: "blob-sha", baseContent: "original"}}};
  const action = multi ? {...proposal, toolName: "commit_github_files", argsJson: {repositoryFullName: "fixture/repository", branch: "feature", files: [{path: "main.ts", content: "proposed local change"}, {path: "other.ts", content: "second change"}], _review: {kind: "github_files", files: [{path: "main.ts", baseSha: "a", baseContent: "original"}, {path: "other.ts", baseSha: multi === "with-new-file" ? null : "b", baseContent: multi === "with-new-file" ? "" : "second original"}]}}} : proposal;
  m.client.getAgentConversation.mockResolvedValue({ok: true, data: {...summary, turns: [], actions: [action]}});
  m.invoke.mockImplementation(async (command: string) => {
    if (command === "default_repos_directory") return "/owned";
    if (command === "list_local_repositories") return ["/owned/A"];
    if (command === "repository_status") return {rootPath: "/owned/A", repositoryFullName: "fixture/repository", branch: "feature", ahead: 0, behind: 0, changedFiles: []};
    if (command === "list_repository_files") return ["main.ts"];
    if (command === "detect_repository_checks") return [];
    if (command === "read_repository_file") return "original";
    if (command === "write_repository_file") return;
    throw new Error(`Unexpected command ${command}`);
  });
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button", {name: "Review in local editor"}));
  expect(screen.getByLabelText(multi ? "Agent proposed diff for main.ts" : "Agent proposed local diff")).toBeTruthy();
  if (multi) expect(screen.getByLabelText("Agent proposed diff for other.ts")).toBeTruthy();
  fireEvent.click(await screen.findByRole("button", {name: "main.ts"}));
  await screen.findByDisplayValue("original");
  fireEvent.click(screen.getByRole("button", {name: "Load editor draft"}));
  await screen.findByDisplayValue("proposed local change");
  expect(m.invoke.mock.calls.filter(([name]) => name === "write_repository_file")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", {name: "Save ⌘S"}));
  await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("write_repository_file", {repositoryPath: "/owned/A", relativePath: "main.ts", content: "proposed local change", expectedContent: "original"}));
  expect(m.client.approveAgentAction).not.toHaveBeenCalled();
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("returns a failed native check receipt to an unsent scoped Agent prompt", async () => {
  m.client.hasAuth.mockReturnValue(true);
  m.client.verifyCurrentCredential.mockResolvedValue({ok: true, data: {kind: "desktop_session", organizationId: "fixture-workspace", role: "owner", capabilities: [], access: {allowed: true, code: "active", title: "Access active", message: "Fixture", billingStatus: "no_plan", planTier: "trial"}}});
  m.invoke.mockImplementation(async (command: string) => {
    if (command === "default_repos_directory") return "/owned";
    if (command === "list_local_repositories") return ["/owned/A"];
    if (command === "repository_status") return {rootPath: "/owned/A", repositoryFullName: "fixture/repository", branch: "feature", ahead: 0, behind: 0, changedFiles: []};
    if (command === "list_repository_files") return ["main.ts"];
    if (command === "detect_repository_checks") return [{id: "npm:test", label: "Tests", command: "npm test", description: "fixture"}];
    if (command === "prepare_repository_check") return "owned-run";
    if (command === "run_repository_check") return {checkId: "npm:test", success: false, exitCode: 1, output: "test assertion failed", durationMs: 1};
    throw Error(`Unexpected command ${command}`);
  });
  render(createElement(App)); await draft();
  fireEvent.click(screen.getByRole("button", {name: "GitHub repositories"}));
  fireEvent.click(await screen.findByRole("button", {name: "Tests"}));
  fireEvent.click(await screen.findByRole("button", {name: "Run check"}));
  await screen.findByText("test assertion failed");
  fireEvent.click(screen.getByRole("button", {name: "Prepare check output for Agent"}));
  fireEvent.click(await screen.findByRole("button", {name: "Prepare check draft"}));
  await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toContain('"excerpt":"test assertion failed"'));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toMatch(/^Keep this unsent request/);
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  expect(m.client.approveAgentAction).not.toHaveBeenCalled();
  expect(m.invoke.mock.calls.filter(([command]) => command === "run_repository_check")).toHaveLength(1);
});

it("opens the repository on its first visit from the shared Documentation journey", async () => {
  m.client.hasAuth.mockReturnValue(true);
  m.client.verifyCurrentCredential.mockResolvedValue({ ok: true, data: { kind: "desktop_session", organizationId: "fixture-workspace", role: "owner", capabilities: [], access: { allowed: true, code: "active", title: "Access active", message: "Fixture", billingStatus: "no_plan", planTier: "trial" } } });
  m.invoke.mockImplementation(async (command: string) => {
    if (command === "default_repos_directory") return "/owned";
    if (command === "list_local_repositories") return ["/owned/A"];
    if (command === "repository_status") return {rootPath: "/owned/A", repositoryFullName: "fixture/repository", branch: "feature", ahead: 0, behind: 0, changedFiles: []};
    if (command === "list_repository_files") return ["main.ts"];
    if (command === "detect_repository_checks") return [];
    if (command === "read_repository_file") return "saved local content";
    throw new Error(`Unexpected command ${command}`);
  });
  render(createElement(App));
  await screen.findByRole("button", {name: "Agent permissions"});
  fireEvent.click(screen.getByRole("button", {name: "Documentation"}));
  fireEvent.click(await screen.findByRole("button", {name: "Open repository"}));
  expect(await screen.findByRole("button", {name: "main.ts"})).toBeTruthy();
  expect(m.invoke.mock.calls.filter(([command]) => command === "write_repository_file")).toHaveLength(0);
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});

it("honors saved command-enter submission and preserves Enter, Shift and IME input", async () => {
  m.preferences.mockResolvedValue({ submit_with_command_enter: true });
  render(createElement(AgentChatView)); await draft();
  await screen.findByRole("option", { name: "Fixture model" });
  const input = screen.getByRole("textbox");
  fireEvent.keyDown(input, { key: "Enter" });
  fireEvent.keyDown(input, { key: "Enter", metaKey: true, shiftKey: true });
  fireEvent.keyDown(input, { key: "Enter", metaKey: true, isComposing: true });
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Enter", metaKey: true });
  await waitFor(() => expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1));
});

it("applies a successfully changed keyboard preference to an already mounted composer", async () => {
  render(createElement(AgentChatView)); await draft();
  await screen.findByRole("option", { name: "Fixture model" });
  m.preferences.mockResolvedValue({ submit_with_command_enter: true });
  await act(async () => { window.dispatchEvent(new Event("axiom:preferences-changed")); });
  const input = screen.getByRole("textbox");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
  await waitFor(() => expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1));
});
