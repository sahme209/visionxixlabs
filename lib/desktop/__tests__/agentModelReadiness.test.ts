/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
const m = vi.hoisted(() => ({ invoke: vi.fn(), preferences: vi.fn(), client: { subscribeContext: () => () => {}, getContextRevision: () => 0, config: {} as { sessionToken?: string }, hasAuth: vi.fn(), verifyCurrentCredential: vi.fn(), listAgentConversations: vi.fn(), getAgentConversation: vi.fn(), aiProviderStatus: vi.fn(), listAgentSkills: vi.fn(), listGithubRepositories: vi.fn(), listGithubBranches: vi.fn(), listGithubFiles: vi.fn(), listEnvironments: vi.fn(), sendAgentMessage: vi.fn(), createAgentConversation: vi.fn(), approveAgentAction: vi.fn(), rejectAgentAction: vi.fn(), deploymentRequests: vi.fn(), listDeploymentExecutions: vi.fn(), airflowConnection: vi.fn(), listAirflowAutomations: vi.fn() } }));
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
  vi.resetAllMocks(); m.invoke.mockRejectedValue(new Error("native_fixture_unavailable")); m.preferences.mockResolvedValue(null); window.localStorage.clear(); Element.prototype.scrollTo = vi.fn(); m.client.config = {};
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
async function draft() { await waitFor(() => expect((screen.getByRole("combobox", { name: "Agent conversation" }) as HTMLSelectElement).value).toBe("conversation-1")); fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: "Keep this unsent request" } }); }
it("publishes ready model and context while conversation history is still loading", async () => {
  const history = deferred<unknown>(); m.client.listAgentConversations.mockReturnValue(history.promise);
  render(createElement(AgentChatView)); await openWorkspaceContext();
  await screen.findByRole("option", { name: "Fixture model" });
  await waitFor(() => expect((screen.getByRole("combobox", { name: "Active GitHub repository" }) as HTMLSelectElement).disabled).toBe(false));
  expect(screen.getByRole("option", { name: "Development · dev" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { history.resolve({ ok: true, data: { conversations: [summary] } }); });
});
it.each([{ ok: false, error: "provider_policy_unavailable" }, { ok: true, data: {} }])("keeps successful context usable and blocks click and Enter after unavailable model data %j", async failure => {
  m.client.aiProviderStatus.mockResolvedValue(failure); render(createElement(AgentChatView)); await openWorkspaceContext(); await draft();
  await screen.findByRole("button", { name: "Retry models" });
  expect((screen.getByRole("combobox", { name: "Active GitHub repository" }) as HTMLSelectElement).disabled).toBe(false);
  expect((screen.getByRole("combobox", { name: "Active deployment environment" }) as HTMLSelectElement).disabled).toBe(false);
  expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Send" })); fireEvent.keyDown(screen.getByRole("textbox", {name:"Agent request"}), { key: "Enter" });
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
});
it("retries only models without changing draft, conversation or selected context or sending", async () => {
  m.client.aiProviderStatus.mockResolvedValueOnce({ ok: false, error: "provider_policy_unavailable" }).mockResolvedValue(ready);
  render(createElement(AgentChatView)); await openWorkspaceContext(); await draft();
  fireEvent.change(screen.getByRole("combobox", { name: "Active deployment environment" }), { target: { value: "env-1" } });
  fireEvent.click(await screen.findByRole("button", { name: "Retry models" }));
  await screen.findByRole("option", { name: "Fixture model" });
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
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
  fireEvent.keyDown(screen.getByRole("textbox", {name:"Agent request"}), { key: "Enter" }); expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
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
  fireEvent.keyDown(screen.getByRole("textbox", {name:"Agent request"}), { key: "Enter" }); await screen.findByText("Fixture reply");
  expect(m.client.sendAgentMessage.mock.calls[0][2]).toBe("vercel_gateway");
});
it("blocks new sends while model verification is loading", async () => {
  const pending = deferred<unknown>(); m.client.aiProviderStatus.mockReturnValue(pending.promise); render(createElement(AgentChatView));
  await draft(); await screen.findByText(/Checking workspace models/); fireEvent.keyDown(screen.getByRole("textbox", {name:"Agent request"}), { key: "Enter" });
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
it("shows an uncertain approved action without offering to execute that approval again", async () => {
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [], actions: [{ id: "proposal", status: "proposed", toolName: "create_github_branch", riskLevel: "medium", argsJson: { repositoryFullName: "fixture/repository", baseBranch: "main", newBranchName: "change" } }] } });
  m.client.approveAgentAction.mockResolvedValue({ ok: true, data: { status: "failed", errorMessage: "action_outcome_unknown" } });
  render(createElement(AgentChatView));
  fireEvent.click(await screen.findByRole("button", { name: "Approve & run" }));
  await screen.findByText(/Action outcome unconfirmed/);
  expect(screen.getByText(/this approval cannot execute again/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Approve & run" })).toBeNull();
  expect(m.client.approveAgentAction).toHaveBeenCalledTimes(1);
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("allows repository selection while the independent environment catalog is delayed", async () => {
  const environments = deferred<unknown>(); m.client.listEnvironments.mockReturnValue(environments.promise);
  render(createElement(AgentChatView)); await openWorkspaceContext(); await screen.findByRole("option", { name: "fixture/repository · private" });
  expect((screen.getByRole("combobox", { name: "Active GitHub repository" }) as HTMLSelectElement).disabled).toBe(false);
  await act(async () => { environments.resolve({ ok: true, data: { environments: [] } }); });
});
it("does not erase an environment failure when repository branches load successfully", async () => {
  m.client.listEnvironments.mockResolvedValue({ ok: false, error: "unavailable" }); render(createElement(AgentChatView)); await openWorkspaceContext();
  await screen.findByRole("option", { name: "main · protected" }); await screen.findByText(/Deployment environments could not be loaded/);
});
it.each([{ ok: false, error: "provider_policy_unavailable" }, { ok: true, data: {} }])("opens Settings Models through the real App callback and retries its failed lookup before returning to Agent %j", async failure => {
  m.client.hasAuth.mockReturnValue(true);
  m.client.verifyCurrentCredential.mockResolvedValue({ ok: true, data: { kind: "desktop_session", organizationId: "fixture-workspace", role: "owner", capabilities: [], access: { allowed: true, code: "active", title: "Access active", message: "Fixture", billingStatus: "no_plan", planTier: "trial" } } });
  m.client.aiProviderStatus.mockResolvedValueOnce({ ...ready, data: { ...ready.data, policy: { ...ready.data.policy, enabled: false } } }).mockResolvedValueOnce(failure).mockResolvedValue(ready);
  render(createElement(App)); fireEvent.click(await screen.findByRole("button", {name: /Build with AI/})); fireEvent.click(await screen.findByRole("button", { name: "Model settings" }));
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
 const data={...ready.data,providers:[{provider:"vercel_gateway",models:[...ready.data.providers[0].models,{id:"xai/grok-4",label:"Grok",tier:"standard"}]}],policy:{...ready.data.policy,gatewaySelection:{version:1,defaultModelId:"fixture/model",approvedModelIds:["fixture/model","xai/grok-4"]}}};m.client.aiProviderStatus.mockResolvedValue({ok:true,data});render(createElement(AgentChatView));await screen.findByRole("option",{name:"Grok"});fireEvent.change(screen.getByRole("combobox",{name:"Agent model"}),{target:{value:JSON.stringify(["vercel_gateway","xai/grok-4"])}});await draft();fireEvent.click(screen.getByRole("button",{name:"Send"}));await waitFor(()=>expect(m.client.sendAgentMessage).toHaveBeenCalledWith("conversation-1","Keep this unsent request","vercel_gateway",expect.objectContaining({mode:"chat"}),"xai/grok-4",expect.objectContaining({signal:expect.anything(),onDraft:expect.any(Function)})));await openAgentConfiguration();fireEvent.click(screen.getByRole("button",{name:"Edit repository file"}));expect((screen.getByRole("combobox",{name:"Agent model"})as HTMLSelectElement).value).toBe(JSON.stringify(["vercel_gateway","xai/grok-4"]));
 await screen.findByRole("option",{name:"src/verified.ts"});fireEvent.change(screen.getByRole("combobox",{name:"Repository file"}),{target:{value:"src/verified.ts"}});fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}),{target:{value:"Review this file"}});await waitFor(()=>expect((screen.getByRole("button",{name:"Send"})as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByRole("button",{name:"Send"}));await waitFor(()=>expect(m.client.sendAgentMessage).toHaveBeenLastCalledWith("conversation-1","Review this file","vercel_gateway",expect.objectContaining({mode:"code",filePath:"src/verified.ts"}),"xai/grok-4",expect.objectContaining({signal:expect.anything(),onDraft:expect.any(Function)})));
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
    await openAgentConfiguration(); fireEvent.click(screen.getByRole("button", { name: "Edit repository file" }));
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
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: "Keep my unsent follow-up" } });
  fireEvent.click(reload);
  await screen.findByText("Saved server explanation");
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep my unsent follow-up");
  expect(screen.queryByText("Response interrupted. Reload the conversation.")).toBeNull();
  expect(screen.getByRole("button", { name: "Approve & run" })).toBeTruthy();
  expect(m.client.getAgentConversation).toHaveBeenCalledTimes(2);
  expect(m.client.sendAgentMessage).toHaveBeenCalledOnce();
  expect(m.client.approveAgentAction).not.toHaveBeenCalled(); expect(m.client.createAgentConversation).not.toHaveBeenCalled();
});
it("opens Agent permissions in Settings without resending or discarding the current draft", async () => {
  const open = vi.fn(); render(createElement(AgentChatView, { onOpenSettings: open })); await draft();
  await openAgentConfiguration();
  fireEvent.click(screen.getByRole("button", { name: "Agent permissions" }));
  expect(open).toHaveBeenCalledExactlyOnceWith("agents");
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("preserves the actual App composer, profile and environment across an in-app Settings visit", async () => {
  m.client.hasAuth.mockReturnValue(true);
  m.client.verifyCurrentCredential.mockResolvedValue({ ok: true, data: { kind: "desktop_session", organizationId: "fixture-workspace", role: "owner", capabilities: [], access: { allowed: true, code: "active", title: "Access active", message: "Fixture", billingStatus: "no_plan", planTier: "trial" } } });
  render(createElement(App)); fireEvent.click(await screen.findByRole("button", {name: /Build with AI/})); await openWorkspaceContext(); await draft();
  await openAgentConfiguration();
  fireEvent.change(screen.getByRole("combobox", { name: "Specialized Agent" }), { target: { value: "code_review" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Active deployment environment" }), { target: { value: "env-1" } });
  await openAgentConfiguration();
  fireEvent.click(screen.getByRole("button", { name: "Agent permissions" }));
  await screen.findByRole("heading", { name: "Agents" });
  expect(screen.queryByRole("navigation", { name: "Deployment workspace" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Back to workspace" }));
  await screen.findByRole("option", { name: "Fixture model" });
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  await openAgentConfiguration();
  expect((screen.getByRole("combobox", { name: "Specialized Agent" }) as HTMLSelectElement).value).toBe("code_review");
  expect((screen.getByRole("combobox", { name: "Active deployment environment" }) as HTMLSelectElement).value).toBe("env-1");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("deactivation aborts streaming and never accepts a late success while retaining an unsent follow-up", async () => {
  const completion = deferred<unknown>(); let signal!: AbortSignal;
  m.client.sendAgentMessage.mockImplementation((...args) => { signal = args[5].signal; args[5].onDraft("Partial"); return completion.promise; });
  const view = render(createElement(AgentChatView, { active: true })); await draft();
  fireEvent.click(screen.getByRole("button", { name: "Send" })); await screen.findByText("Partial");
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: "Unsent follow-up" } });
  view.rerender(createElement(AgentChatView, { active: false }));
  expect(signal.aborted).toBe(true);
  await act(async () => { completion.resolve({ ok: true, data: { reply: "Late success", proposal: { id: "late", toolName: "commit_github_file", argsJson: {}, riskLevel: "medium", status: "proposed" } } }); });
  view.rerender(createElement(AgentChatView, { active: true }));
  await waitFor(() => expect(m.client.aiProviderStatus.mock.calls.length).toBeGreaterThan(1));
  expect(screen.queryByText("Late success")).toBeNull(); expect(screen.queryByRole("button", { name: "Approve & run" })).toBeNull();
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Unsent follow-up");
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
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: "New request" } });
  expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", {name: "Reload saved conversation"}));
  await waitFor(() => expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1); // Abort is not settlement.
  await act(async () => { rejectOld(new Error("Old transport failed")); });
  expect(screen.queryByText("Old transport failed")).toBeNull();
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("New request");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss retained copy" }));
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
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: "New request" } });
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
  render(createElement(App)); fireEvent.click(await screen.findByRole("button", {name: /Build with AI/}));
  await openAgentConfiguration();
  await screen.findByRole("button", {name: "Agent permissions"});
  fireEvent.click(screen.getByRole("button", {name: "Repositories"}));
  fireEvent.click(await screen.findByRole("button", {name: "main.ts"}));
  fireEvent.change(await screen.findByRole("textbox", {name: "Editing main.ts"}), {target: {value: "unsaved local draft"}});
  fireEvent.click(screen.getByRole("button", {name: "Agent"}));
  fireEvent.click(screen.getByRole("button", {name: "Repositories"}));
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
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("");
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), {target: {value: "Second unsent task"}});
  fireEvent.change(screen.getByRole("combobox", {name: "Agent conversation"}), {target: {value: summary.id}});
  await waitFor(() => expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request"));
  fireEvent.change(screen.getByRole("combobox", {name: "Agent conversation"}), {target: {value: second.id}});
  await waitFor(() => expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Second unsent task"));
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("preserves the previous unsent prompt when starting a new chat", async () => {
  m.client.createAgentConversation.mockResolvedValue({ok: true, data: {...summary, id: "new-chat"}});
  m.client.getAgentConversation.mockImplementation(async (id: string) => ({ok: true, data: {...summary, id, turns: [], actions: []}}));
  render(createElement(AgentChatView)); await draft();
  fireEvent.click(screen.getByRole("button", {name: "New chat"}));
  await waitFor(() => expect((screen.getByRole("combobox", {name: "Agent conversation"}) as HTMLSelectElement).value).toBe("new-chat"));
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("");
  fireEvent.change(screen.getByRole("combobox", {name: "Agent conversation"}), {target: {value: summary.id}});
  await waitFor(() => expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request"));
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("blocks overflowing draft navigation without discarding or creating a chat", async () => {
  render(createElement(AgentChatView)); await draft();
  const prompt = "x".repeat(500001);
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), {target: {value: prompt}});
  fireEvent.click(screen.getByRole("button", {name: "New chat"}));
  expect(screen.getByText(/Local draft capacity reached/)).toBeTruthy();
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe(prompt);
  expect(m.client.createAgentConversation).not.toHaveBeenCalled();
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("preserves the current prompt after a failed conversation switch", async () => {
  m.client.listAgentConversations.mockResolvedValue({ok: true, data: {conversations: [summary, {...summary, id: "other"}]}});
  render(createElement(AgentChatView)); await draft();
  m.client.getAgentConversation.mockResolvedValueOnce({ok: false, error: "fixture_failure"});
  fireEvent.change(screen.getByRole("combobox", {name: "Agent conversation"}), {target: {value: "other"}});
  await screen.findByText("The selected conversation could not be verified.");
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect((screen.getByRole("combobox", {name: "Agent conversation"}) as HTMLSelectElement).value).toBe(summary.id);
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});

it("keeps skill shortcuts absent after returning to the Agent and preserves the prompt", async () => {
  const skill = {id: "safe-repository-change", name: "Safe repository change", description: "Existing workflow", category: "GitHub", toolNames: ["read_github_file"], status: "enabled", installedAt: null, updatedAt: null};
  const view = render(createElement(AgentChatView, {active: true})); await draft();
  view.rerender(createElement(AgentChatView, {active: false}));
  m.client.listAgentSkills.mockResolvedValue({ok: true, data: {skills: [skill]}});
  view.rerender(createElement(AgentChatView, {active: true}));
  await waitFor(() => expect(m.client.listAgentSkills).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("button", {name: "/safe-repository-change"})).toBeNull();
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("refreshes a failed skill lookup on focus without adding composer controls or sending", async () => {
  m.client.listAgentSkills.mockResolvedValueOnce({ok: false, error: "unavailable"}).mockResolvedValue({ok: true, data: {skills: []}});
  render(createElement(AgentChatView)); await draft();
  await waitFor(() => expect(m.client.listAgentSkills).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("button", {name: "Retry skills"})).toBeNull();
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(m.client.listAgentSkills).toHaveBeenCalledTimes(2));
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
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
  await waitFor(() => expect(m.client.listAgentSkills).toHaveBeenCalledTimes(1));
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(m.client.listAgentSkills).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("button", {name: "Retry skills"})).toBeNull();
  expect(screen.queryByRole("button", {name: "/safe-repository-change"})).toBeNull();
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("applies a context-bound marketplace skill once after verifying enabled installation without sending", async () => {
  m.client.listAgentSkills.mockResolvedValue({ok: true, data: {skills: [{id: "safe-repository-change", status: "enabled"}]}});
  const view = render(createElement(AgentChatView)); await draft();
  const request = {skillId: "safe-repository-change", context: m.client.config};
  view.rerender(createElement(AgentChatView, {requestedSkill: request}));
  await waitFor(() => expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("/safe-repository-change Keep this unsent request"));
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), {target: {value: "Later unsent edits"}});
  view.rerender(createElement(AgentChatView, {requestedSkill: request}));
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Later unsent edits");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("rejects a marketplace intent from a different credential context", async () => {
  m.client.listAgentSkills.mockResolvedValue({ok: true, data: {skills: [{id: "safe-repository-change", status: "enabled"}]}});
  const view = render(createElement(AgentChatView)); await draft();
  view.rerender(createElement(AgentChatView, {requestedSkill: {skillId: "safe-repository-change", context: {}}}));
  await screen.findByText(/Skill selection belongs to a different sign-in/);
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("connects an enabled marketplace skill to the actual App's retained Agent draft", async () => {
  m.client.hasAuth.mockReturnValue(true);
  m.client.verifyCurrentCredential.mockResolvedValue({ok: true, data: {kind: "desktop_session", organizationId: "fixture-workspace", role: "owner", capabilities: [], access: {allowed: true, code: "active", title: "Access active", message: "Fixture", billingStatus: "no_plan", planTier: "trial"}}});
  m.client.listAgentSkills.mockResolvedValue({ok: true, data: {skills: [{id: "safe-repository-change", name: "Safe repository change", description: "Existing workflow", category: "GitHub", toolNames: ["read_github_file"], status: "enabled"}]}});
  render(createElement(App)); fireEvent.click(await screen.findByRole("button", {name: /Build with AI/})); await draft();
  fireEvent.click(screen.getByRole("button", {name: "Apps & skills"}));
  fireEvent.click(await screen.findByRole("button", {name: "Use in Agent"}));
  await waitFor(() => expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("/safe-repository-change Keep this unsent request"));
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  expect(m.client.approveAgentAction).not.toHaveBeenCalled();
});
it("rejects an unverified marketplace skill without modifying the draft", async () => {
  const view = render(createElement(AgentChatView)); await draft();
  view.rerender(createElement(AgentChatView, {requestedSkill: {skillId: "missing-skill", context: m.client.config}}));
  await screen.findByText(/selected skill is not verified as enabled/);
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("waits for the fresh activation catalog before applying a marketplace handoff", async () => {
  const skill = {id: "safe-repository-change", status: "enabled"};
  const fresh = deferred<{ok: true; data: {skills: unknown[]}}>();
  m.client.listAgentSkills.mockResolvedValueOnce({ok: true, data: {skills: [skill]}}).mockReturnValueOnce(fresh.promise);
  const view = render(createElement(AgentChatView, {active: true})); await draft();
  await waitFor(() => expect(m.client.listAgentSkills).toHaveBeenCalledTimes(1));
  view.rerender(createElement(AgentChatView, {active: false}));
  view.rerender(createElement(AgentChatView, {active: true, requestedSkill: {skillId: skill.id, context: m.client.config}}));
  await waitFor(() => expect(m.client.listAgentSkills).toHaveBeenCalledTimes(2));
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  await act(async () => {fresh.resolve({ok: true, data: {skills: []}});});
  await screen.findByText(/selected skill is not verified as enabled/);
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("prepares local selected code once in read-only mode without sending or replacing the existing prompt", async () => {
  const view = render(createElement(AgentChatView)); await draft();
  const request = {context: m.client.config, path: "src/main.ts", excerpt: "const answer = 42;"};
  view.rerender(createElement(AgentChatView, {requestedLocalCode: request}));
  await waitFor(() => expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toContain('"excerpt":"const answer = 42;"'));
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toMatch(/^Keep this unsent request\n\n/);
  await openAgentConfiguration();
  expect((screen.getByRole("combobox", {name: "Specialized Agent"}) as HTMLSelectElement).value).toBe("code_review");
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), {target: {value: "Later draft"}});
  view.rerender(createElement(AgentChatView, {requestedLocalCode: request}));
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Later draft");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  expect(m.client.approveAgentAction).not.toHaveBeenCalled();
});
it("rejects a selected-code intent from a previous sign-in", async () => {
  const view = render(createElement(AgentChatView)); await draft();
  view.rerender(createElement(AgentChatView, {requestedLocalCode: {context: {}, path: "src/main.ts", excerpt: "PRIVATE SENTINEL"}}));
  await screen.findByText(/Local selection belongs to a different sign-in/);
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
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
  render(createElement(App)); fireEvent.click(await screen.findByRole("button", {name: /Build with AI/})); await draft();
  fireEvent.click(screen.getByRole("button", {name: "Repositories"}));
  fireEvent.click(await screen.findByRole("button", {name: "main.ts"}));
  const editor = await screen.findByRole("textbox", {name: "Editing main.ts"}) as HTMLTextAreaElement;
  fireEvent.change(editor, {target: {value: "unsaved selected code"}});
  editor.setSelectionRange(0, 7); fireEvent.select(editor);
  fireEvent.click(screen.getByRole("button", {name: "Ask Agent about selection"}));
  fireEvent.click(screen.getByRole("button", {name: "Prepare Agent draft"}));
  await waitFor(() => expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toContain('"excerpt":"unsaved"'));
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toMatch(/^Keep this unsent request/);
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "Repositories"}));
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
  render(createElement(App)); fireEvent.click(await screen.findByRole("button", {name: /Build with AI/}));
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
  render(createElement(App)); fireEvent.click(await screen.findByRole("button", {name: /Build with AI/})); await draft();
  fireEvent.click(screen.getByRole("button", {name: "Repositories"}));
  fireEvent.click(await screen.findByRole("button", {name: "Tests"}));
  fireEvent.click(await screen.findByRole("button", {name: "Run check"}));
  await screen.findByText("test assertion failed");
  fireEvent.click(screen.getByRole("button", {name: "Prepare check output for Agent"}));
  fireEvent.click(await screen.findByRole("button", {name: "Prepare check draft"}));
  await waitFor(() => expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toContain('"excerpt":"test assertion failed"'));
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toMatch(/^Keep this unsent request/);
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
  render(createElement(App)); fireEvent.click(await screen.findByRole("button", {name: /Build with AI/}));
  await openAgentConfiguration();
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
  const input = screen.getByRole("textbox", {name:"Agent request"});
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
  const input = screen.getByRole("textbox", {name:"Agent request"});
  fireEvent.keyDown(input, { key: "Enter" });
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
  await waitFor(() => expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1));
});

it("queues a follow-up during streaming and sends it only after a verified completion", async () => {
  const first = deferred<any>();
  m.client.sendAgentMessage.mockReturnValueOnce(first.promise).mockResolvedValue({ ok: true, data: { reply: "Follow-up done", proposal: null, usage: null } });
  render(createElement(AgentChatView)); await draft();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  const input = screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement;
  expect(input.disabled).toBe(false);
  fireEvent.change(input, { target: { value: "Follow-up request" } });
  fireEvent.click(screen.getByRole("button", { name: "Queue message" }));
  expect(screen.getByText("Follow-up request")).toBeTruthy();
  expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1);
  fireEvent.change(input, { target: { value: "Keep this separate draft" } });
  await act(async () => { first.resolve({ ok: true, data: { reply: "First done", proposal: null, usage: { decisionSteps: 1, inputTokens: 1, outputTokens: 1, totalTokens: 2 } } }); });
  await waitFor(() => expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(2));
  expect(m.client.sendAgentMessage.mock.calls[1][1]).toBe("Follow-up request");
  expect(input.value).toBe("Keep this separate draft");
});
it("retains queued text and pauses automatic continuation after an unverified response", async () => {
  const first = deferred<any>(); m.client.sendAgentMessage.mockReturnValue(first.promise);
  render(createElement(AgentChatView)); await draft();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: "Retain queued work" } });
  fireEvent.click(screen.getByRole("button", { name: "Queue message" }));
  await act(async () => { first.resolve({ ok: false, error: "network unavailable" }); });
  expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Retain queued work")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Resume queue" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Edit queued message" }));
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Retain queued work");
});

it.each(["reported_failure", "thrown_failure"])("retains a failed request across saved-history reload without automatically retrying: %s", async failure => {
  if (failure === "reported_failure") m.client.sendAgentMessage.mockResolvedValue({ ok: false, error: "network unavailable" });
  else m.client.sendAgentMessage.mockRejectedValue(Error("synthetic transport failure"));
  render(createElement(AgentChatView)); await draft();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  const restore = await screen.findByRole("button", { name: "Restore retained request" });
  expect((restore as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reload saved conversation" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "Restore retained request" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Restore retained request" }));
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1);
});

it("never overwrites a newer draft with a retained failed request", async () => {
  const response = deferred<any>(); m.client.sendAgentMessage.mockReturnValue(response.promise);
  render(createElement(AgentChatView)); await draft(); fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: "My newer draft" } });
  await act(async () => { response.resolve({ ok: false, error: "network unavailable" }); });
  fireEvent.click(screen.getByRole("button", { name: "Reload saved conversation" }));
  await waitFor(() => expect(m.client.getAgentConversation).toHaveBeenCalledTimes(2));
  expect((screen.getByRole("button", { name: "Restore retained request" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("My newer draft");
  expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1);
});

it("removes the retained recovery copy when the service confirms the request", async () => {
  render(createElement(AgentChatView)); await draft(); fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Fixture reply");
  expect(screen.queryByRole("button", { name: "Restore retained request" })).toBeNull();
});

it("clears retained request text when the verified credential context changes", async () => {
  m.client.sendAgentMessage.mockResolvedValue({ ok: false, error: "network unavailable" });
  const view = render(createElement(AgentChatView)); await draft(); fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByRole("button", { name: "Restore retained request" });
  m.client.config = { sessionToken: "synthetic-other-credential" }; view.rerender(createElement(AgentChatView));
  await waitFor(() => expect((screen.getByRole("combobox", { name: "Agent conversation" }) as HTMLSelectElement).value).toBe("conversation-1"));
  expect(screen.queryByRole("button", { name: "Restore retained request" })).toBeNull();
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("");
  expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1);
});

it("recovers an interrupted request only as a draft after saved-history review", async () => {
  const response = deferred<any>(); let signal!: AbortSignal;
  m.client.sendAgentMessage.mockImplementation((...args) => { signal = args[5].signal; return response.promise; });
  render(createElement(AgentChatView)); await draft(); fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.click(screen.getByRole("button", { name: "Stop response" })); expect(signal.aborted).toBe(true);
  await act(async () => { response.resolve({ ok: false, error: "canceled" }); });
  expect((screen.getByRole("button", { name: "Restore retained request" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reload saved conversation" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "Restore retained request" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Restore retained request" }));
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request"); expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1);
});

it("retains a dispatched queued request when that response fails", async () => {
  const first = deferred<any>(); m.client.sendAgentMessage.mockReturnValueOnce(first.promise).mockResolvedValue({ ok: false, error: "network unavailable" });
  render(createElement(AgentChatView)); await draft(); fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: "Queued request to recover" } }); fireEvent.click(screen.getByRole("button", { name: "Queue message" }));
  await act(async () => { first.resolve({ ok: true, data: { reply: "First confirmed", proposal: null, usage: { decisionSteps: 1, inputTokens: 1, outputTokens: 1, totalTokens: 2 } } }); });
  await screen.findByRole("button", { name: "Restore retained request" }); expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Reload saved conversation" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "Restore retained request" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Restore retained request" }));
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Queued request to recover"); expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(2);
});

it("refuses recovery-copy capacity overflow before dispatch without discarding the input", async () => {
  render(createElement(AgentChatView)); await draft(); const large = "x".repeat(500001);
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: large } }); fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText(/Recovery draft capacity reached/);
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled(); expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe(large);
});

it("dismisses only the retained copy while keeping recovery required and leaving a new draft intact", async () => {
  m.client.sendAgentMessage.mockResolvedValue({ ok: false, error: "network unavailable" });
  render(createElement(AgentChatView)); await draft(); fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByRole("button", { name: "Dismiss retained copy" }); fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: "My separate draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Dismiss retained copy" }));
  expect(screen.queryByRole("button", { name: "Restore retained request" })).toBeNull();
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("My separate draft");
  expect(screen.getByRole("button", { name: "Reload saved conversation" })).toBeTruthy(); expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1);
});

it("does not silently replace an unconfirmed request with different work after history reload", async () => {
  m.client.sendAgentMessage.mockResolvedValueOnce({ ok: false, error: "network unavailable" }).mockResolvedValue({ ok: true, data: { reply: "New request confirmed", proposal: null, usage: null } });
  render(createElement(AgentChatView)); await draft(); fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByRole("button", { name: "Restore retained request" }); fireEvent.click(screen.getByRole("button", { name: "Reload saved conversation" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "Restore retained request" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: "Different new work" } }); fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1); expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Different new work");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss retained copy" })); fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("New request confirmed"); expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(2);
});

it("pauses queued work at a new approval proposal instead of executing the follow-up", async () => {
  const first = deferred<any>(); m.client.sendAgentMessage.mockReturnValue(first.promise);
  render(createElement(AgentChatView)); await draft();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: "Wait for review" } });
  fireEvent.click(screen.getByRole("button", { name: "Queue message" }));
  await act(async () => { first.resolve({ ok: true, data: { reply: "Review required", proposal: { id: "review-1", status: "proposed", toolName: "create_github_branch", riskLevel: "medium", argsJson: {} }, usage: { decisionSteps: 1, inputTokens: 1, outputTokens: 1, totalTokens: 2 } } }); });
  expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("button", { name: "Resume queue" }) as HTMLButtonElement).disabled).toBe(true);
  expect(m.client.approveAgentAction).not.toHaveBeenCalled();
  expect(screen.getByText("Wait for review")).toBeTruthy();
});
it("interrupt retains the follow-up and requires recovery instead of starting a concurrent request", async () => {
  m.preferences.mockResolvedValue({ new_message_behavior: "interrupt" });
  const first = deferred<any>(); let signal!: AbortSignal;
  m.client.sendAgentMessage.mockImplementation((...args) => { signal = args[5].signal; return first.promise; });
  render(createElement(AgentChatView)); await draft();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: "Interrupted follow-up" } });
  fireEvent.click(screen.getByRole("button", { name: "Interrupt & queue" }));
  expect(signal.aborted).toBe(true);
  await act(async () => { first.resolve({ ok: false, error: "canceled" }); });
  expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Interrupted follow-up")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Resume queue" }) as HTMLButtonElement).disabled).toBe(true);
});
it("does not lose an existing draft when editing queued work", async () => {
  const first = deferred<any>(); m.client.sendAgentMessage.mockReturnValue(first.promise);
  render(createElement(AgentChatView)); await draft(); fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: "Queued text" } });
  fireEvent.click(screen.getByRole("button", { name: "Queue message" }));
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: "Separate draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Edit queued message" }));
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Separate draft");
  expect(screen.getByText("Queued text")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Remove queued message" }));
  expect(screen.queryByRole("region", { name: "Queued Agent messages" })).toBeNull();
  await act(async () => { first.resolve({ ok: false, error: "unavailable" }); });
});

it("pauses a queued request when the selected environment changes", async () => {
  m.client.listEnvironments.mockResolvedValue({ ok: true, data: { environments: [{ id: "env-1", name: "Development", tier: "dev" }, { id: "env-2", name: "Production", tier: "prod" }] } });
  const first = deferred<any>(); m.client.sendAgentMessage.mockReturnValue(first.promise);
  render(createElement(AgentChatView)); await openWorkspaceContext(); await draft();
  await screen.findByRole("option", { name: "Production · prod" });
  const environment = screen.getByRole("combobox", { name: "Active deployment environment" });
  fireEvent.change(environment, { target: { value: "env-1" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: "Development-only follow-up" } });
  fireEvent.click(screen.getByRole("button", { name: "Queue message" }));
  fireEvent.change(environment, { target: { value: "env-2" } });
  await act(async () => { first.resolve({ ok: true, data: { reply: "Done", proposal: null, usage: { decisionSteps: 1, inputTokens: 1, outputTokens: 1, totalTokens: 2 } } }); });
  expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Request configuration changed/)).toBeTruthy();
  expect((screen.getByRole("button", { name: "Resume queue" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(environment, { target: { value: "env-1" } });
  expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("button", { name: "Resume queue" }) as HTMLButtonElement).disabled).toBe(false);
});

it("searches saved conversation titles and retains separate drafts while switching through history", async () => {
  const second = { ...summary, id: "conversation-2", title: "Release review" };
  m.client.listAgentConversations.mockResolvedValue({ ok: true, data: { conversations: [summary, second] } });
  m.client.getAgentConversation.mockImplementation(async id => ({ ok: true, data: { ...(id === second.id ? second : summary), turns: [], actions: [] } }));
  render(createElement(AgentChatView)); await draft();
  fireEvent.click(screen.getByRole("button", { name: "Search chats" }));
  const history = within(screen.getByRole("region", { name: "Conversation history" }));
  fireEvent.change(history.getByRole("searchbox", { name: "Search conversations" }), { target: { value: "release" } });
  expect(history.queryByRole("button", { name: /Saved chat/ })).toBeNull();
  fireEvent.click(history.getByRole("button", { name: /Release review/ }));
  await waitFor(() => expect((screen.getByRole("combobox", { name: "Agent conversation" }) as HTMLSelectElement).value).toBe(second.id));
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: "Second conversation draft" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Agent conversation" }), { target: { value: summary.id } });
  await waitFor(() => expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request"));
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("retains a blocked request for explicit draft restoration and opens the correct settings",async()=>{
 const settings=vi.fn();m.client.sendAgentMessage.mockResolvedValue({ok:true,data:{reply:"AI credits exhausted",proposal:null,usage:null,issue:"workspace_ai_credit_pool_exhausted"}});
 render(createElement(AgentChatView,{onOpenSettings:settings}));await draft();fireEvent.click(screen.getByRole("button",{name:"Send"}));
 fireEvent.click(await screen.findByRole("button",{name:"Restore request draft"}));
 expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
 fireEvent.click(screen.getByRole("button",{name:"Review plan & usage"}));expect(settings).toHaveBeenCalledWith("plan");
 expect(m.client.sendAgentMessage).toHaveBeenCalledTimes(1);
});
it("does not pull a reader down during streaming and offers explicit jump to latest",async()=>{
 const pending=deferred<unknown>();m.client.sendAgentMessage.mockReturnValue(pending.promise);
 render(createElement(AgentChatView));await draft();
 const transcript=screen.getByRole("region",{name:"Agent conversation messages"});
 Object.defineProperties(transcript,{scrollHeight:{configurable:true,value:2000},clientHeight:{configurable:true,value:400},scrollTop:{configurable:true,value:200,writable:true}});
 fireEvent.scroll(transcript);
 const scroll=vi.fn();transcript.scrollTo=scroll;
 fireEvent.click(screen.getByRole("button",{name:"Send"}));
 await screen.findByRole("button",{name:"Jump to latest"});
 expect(scroll).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Jump to latest"}));expect(scroll).toHaveBeenCalled();
 await act(async()=>pending.resolve({ok:true,data:{reply:"Done",proposal:null,usage:null}}));
});
it("keeps the editor and Agent drafts mounted across split workspace and Settings",async()=>{
 m.client.hasAuth.mockReturnValue(true);m.client.verifyCurrentCredential.mockResolvedValue({ok:true,data:{kind:"desktop_session",organizationId:"fixture-workspace",role:"owner",capabilities:[],access:{allowed:true,code:"active",title:"Active",message:"Fixture",billingStatus:"no_plan",planTier:"trial"}}});
 m.invoke.mockImplementation(async(command:string)=>{
  if(command==="default_repos_directory")return "/owned";if(command==="list_local_repositories")return ["/owned/A"];
  if(command==="repository_status")return {rootPath:"/owned/A",repositoryFullName:"fixture/repository",branch:"feature",ahead:0,behind:0,changedFiles:[]};
  if(command==="list_repository_files")return ["main.ts"];if(command==="detect_repository_checks"||command==="list_repository_worktrees")return [];
  if(command==="read_repository_file")return "Saved file";throw Error("unexpected fixture command");
 });
 render(createElement(App)); fireEvent.click(await screen.findByRole("button", {name: /Build with AI/}));await draft();fireEvent.click(screen.getByRole("button",{name:"Editor & Agent"}));expect(screen.getByRole("button",{name:"Single pane"})).toBeTruthy();
 fireEvent.click(await screen.findByRole("button",{name:"main.ts"}));fireEvent.change(await screen.findByRole("textbox",{name:"Editing main.ts"}),{target:{value:"Editor draft"}});
 expect((screen.getByRole("textbox",{name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
 fireEvent.click(screen.getByRole("button",{name:"Settings"}));await screen.findByRole("button",{name:"Back to workspace"});fireEvent.click(screen.getByRole("button",{name:"Back to workspace"}));
 expect((screen.getByRole("textbox",{name:"Editing main.ts"}) as HTMLTextAreaElement).value).toBe("Editor draft");
 fireEvent.click(screen.getByRole("button",{name:"Single pane"}));
 expect((screen.getByRole("textbox",{name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
 expect(m.invoke.mock.calls.filter(([command])=>command==="read_repository_file")).toHaveLength(1);expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});

it("loads older chats without changing the selected conversation or its unsent draft",async()=>{
  const older={...summary,id:"older-chat",title:"Older investigation"};
  m.client.listAgentConversations.mockResolvedValueOnce({ok:true,data:{conversations:[summary],nextCursor:"page-two"}}).mockResolvedValueOnce({ok:true,data:{conversations:[older],nextCursor:null}});
  render(createElement(AgentChatView));await draft();fireEvent.click(screen.getByRole("button",{name:"Search chats"}));
  fireEvent.click(screen.getByRole("button",{name:"Load older chats"}));
  await screen.findByRole("button",{name:"Older investigation"});
  expect(m.client.listAgentConversations).toHaveBeenLastCalledWith({cursor:"page-two"});
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect(m.client.getAgentConversation).toHaveBeenCalledTimes(1);
});
it("searches all saved titles only on request and ignores a response for an edited query",async()=>{
  const pending=deferred<unknown>();m.client.listAgentConversations.mockResolvedValueOnce({ok:true,data:{conversations:[summary]}}).mockReturnValueOnce(pending.promise);
  render(createElement(AgentChatView));await draft();fireEvent.click(screen.getByRole("button",{name:"Search chats"}));
  fireEvent.change(screen.getByRole("searchbox",{name:"Search conversations"}),{target:{value:"Airflow"}});
  expect(m.client.listAgentConversations).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button",{name:"Search all saved titles"}));
  expect(m.client.listAgentConversations).toHaveBeenLastCalledWith({query:"Airflow"});
  fireEvent.change(screen.getByRole("searchbox",{name:"Search conversations"}),{target:{value:"release"}});
  await act(async()=>{pending.resolve({ok:true,data:{conversations:[{...summary,id:"old-query",title:"Airflow old result"}],nextCursor:null}});});
  expect(screen.queryByRole("button",{name:"Airflow old result"})).toBeNull();
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
});
it("shows a bounded retryable history error without replacing current chat",async()=>{
  m.client.listAgentConversations.mockResolvedValueOnce({ok:true,data:{conversations:[summary],nextCursor:"page-two"}}).mockRejectedValueOnce(new Error("private transport detail"));
  render(createElement(AgentChatView));await draft();fireEvent.click(screen.getByRole("button",{name:"Search chats"}));fireEvent.click(screen.getByRole("button",{name:"Load older chats"}));
  await screen.findByText("Saved chats could not be loaded. Try again.");
  expect(screen.queryByText("private transport detail")).toBeNull();expect(screen.getByRole("button",{name:"Load older chats"})).toBeTruthy();
});

it("opens a server title match and restores the first chat draft when returning",async()=>{
  const match={...summary,id:"older-chat",title:"Airflow from last month"};
  m.client.listAgentConversations.mockResolvedValueOnce({ok:true,data:{conversations:[summary]}}).mockResolvedValueOnce({ok:true,data:{conversations:[match],nextCursor:null,historyQueryVersion:1}});
  m.client.getAgentConversation.mockImplementation(async id=>({ok:true,data:{...(id===match.id?match:summary),turns:[],actions:[]}}));
  render(createElement(AgentChatView));await draft();fireEvent.click(screen.getByRole("button",{name:"Search chats"}));fireEvent.change(screen.getByRole("searchbox",{name:"Search conversations"}),{target:{value:"Airflow"}});fireEvent.click(screen.getByRole("button",{name:"Search all saved titles"}));
  fireEvent.click(await screen.findByRole("button",{name:match.title}));
  await waitFor(()=>expect((screen.getByRole("combobox",{name:"Agent conversation"}) as HTMLSelectElement).value).toBe(match.id));
  fireEvent.change(screen.getByRole("combobox",{name:"Agent conversation"}),{target:{value:summary.id}});
  await waitFor(()=>expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request"));expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("does not label an old service's unfiltered response as saved title matches",async()=>{
  m.client.listAgentConversations.mockResolvedValue({ok:true,data:{conversations:[summary]}});
  render(createElement(AgentChatView));await draft();fireEvent.click(screen.getByRole("button",{name:"Search chats"}));fireEvent.change(screen.getByRole("searchbox",{name:"Search conversations"}),{target:{value:"Airflow"}});fireEvent.click(screen.getByRole("button",{name:"Search all saved titles"}));
  await screen.findByText(/This service needs an update/);expect(screen.queryByText(/Saved title matches for/)).toBeNull();
});
it("restores the chosen Inspect mode after remount without carrying it into another workspace",async()=>{
 Object.assign(m.client.config,{apiBase:"https://visionxixlabs.com"});const identity={organizationId:"mode-workspace-one"} as never;
 const view=render(createElement(AgentChatView,{identity}));await screen.findByRole("option",{name:"Fixture model"});fireEvent.click(screen.getByRole("button",{name:"Inspect"}));view.unmount();
 const reopened=render(createElement(AgentChatView,{identity}));await screen.findByRole("option",{name:"Fixture model"});expect(screen.getByRole("button",{name:"Inspect"}).getAttribute("aria-pressed")).toBe("true");
 reopened.rerender(createElement(AgentChatView,{identity:{organizationId:"mode-workspace-two"} as never}));await screen.findByRole("option",{name:"Fixture model"});expect(screen.getByRole("button",{name:"Engineer"}).getAttribute("aria-pressed")).toBe("true");expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("does not carry a saved mode to another API origin or accept a malformed stored mode",async()=>{
 Object.assign(m.client.config,{apiBase:"https://visionxixlabs.com"});const identity={organizationId:"mode-workspace"} as never;
 const view=render(createElement(AgentChatView,{identity}));await screen.findByRole("option",{name:"Fixture model"});fireEvent.click(screen.getByRole("button",{name:"Inspect"}));
 m.client.config={apiBase:"https://other.invalid"} as typeof m.client.config;view.rerender(createElement(AgentChatView,{identity}));await screen.findByRole("option",{name:"Fixture model"});expect(screen.getByRole("button",{name:"Engineer"}).getAttribute("aria-pressed")).toBe("true");view.unmount();
 const key=Object.keys(window.localStorage).find(key=>key.startsWith("axiom.workspace.operation-mode.v1:")&&key.includes("other.invalid"))!;expect(key).toBeTruthy();window.localStorage.setItem(key,"unrecognized-mode");render(createElement(AgentChatView,{identity}));await screen.findByRole("option",{name:"Fixture model"});expect(screen.getByRole("button",{name:"Engineer"}).getAttribute("aria-pressed")).toBe("true");expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});

async function openAgentConfiguration() {
 const control = await screen.findByRole("button", { name: /Agent configuration ·/ });
 if (control.getAttribute("aria-expanded") === "false") fireEvent.click(control);
}

async function openWorkspaceContext() {
  const control = await screen.findByRole("button", { name: /^Workspace context/ });
  if (control.getAttribute("aria-expanded") !== "true") fireEvent.click(control);
}
it("unblocks the composer after cancelling an own proposal without a model call",async()=>{
 m.client.getAgentConversation.mockResolvedValue({ok:true,data:{...summary,turns:[],actions:[{id:"own-proposal",status:"proposed",toolName:"create_github_branch",riskLevel:"medium",requiresIndependentReviewer:true,argsJson:{repositoryFullName:"fixture/repository",baseBranch:"main",newBranchName:"scratch"}}]}});
 m.client.rejectAgentAction.mockResolvedValue({ok:true,data:{status:"rejected"}});
 render(createElement(AgentChatView));
 const cancel=await screen.findByRole("button",{name:"Cancel proposal"});
 expect((screen.getByRole("button",{name:"Approve & run"})as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(cancel);await screen.findByText(/Create a branch — rejected/);
 fireEvent.change(screen.getByRole("textbox",{name:"Agent request"}),{target:{value:"Unsent next request"}});
 await waitFor(()=>expect((screen.getByRole("button",{name:"Send"})as HTMLButtonElement).disabled).toBe(false));
 expect(m.client.rejectAgentAction).toHaveBeenCalledWith("own-proposal");
 expect(m.client.approveAgentAction).not.toHaveBeenCalled();expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});

it("retains an approved but budget-blocked model and draft until the user explicitly selects another approved model", async () => {
  const blocked = { id: "spacexai/grok-4.20-multi-agent", label: "Grok 4.20 Multi-Agent", tier: "standard" };
  m.client.aiProviderStatus.mockResolvedValue({ ok: true, data: { ...ready.data,
    providers: [{ provider: "vercel_gateway", models: [blocked, ...ready.data.providers[0].models] }],
    policy: { ...ready.data.policy, modelSelections: { vercel_gateway: blocked.id }, gatewaySelection: {
      version: 1, defaultModelId: blocked.id, approvedModelIds: [blocked.id, "fixture/model"],
    } },
  } });
  render(createElement(AgentChatView)); await draft();
  await screen.findByText(/This model is unavailable because its output budget cannot be enforced/);
  const selector = screen.getByRole("combobox", { name: "Agent model" }) as HTMLSelectElement;
  expect(selector.disabled).toBe(false);
  expect(selector.value).toBe(JSON.stringify(["vercel_gateway", blocked.id]));
  expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.keyDown(screen.getByRole("textbox", {name:"Agent request"}), { key: "Enter" });
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  fireEvent.change(selector, { target: { value: JSON.stringify(["vercel_gateway", "fixture/model"]) } });
  expect(screen.queryByText(/This model is unavailable because its output budget cannot be enforced/)).toBeNull();
  expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(false);
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});

it("refreshes a web-reviewed pending action on focus without executing or sending again", async () => {
  const proposal = { id: "external-review", status: "proposed", toolName: "create_github_branch", riskLevel: "medium", argsJson: { repositoryFullName: "fixture/repository", baseBranch: "main", newBranchName: "change" } };
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [], actions: [proposal] } });
  render(createElement(AgentChatView)); await screen.findByRole("button", { name: "Approve & run" });
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [{ id: "external-result", role: "tool_result", actionProposalId: proposal.id, content: "External reviewer executed this branch change." }], actions: [{ ...proposal, status: "executed" }] } });
  fireEvent(window, new Event("focus"));
  await screen.findByText("External reviewer executed this branch change.");
  expect(screen.queryByRole("button", { name: "Approve & run" })).toBeNull();
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).disabled).toBe(false);
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled(); expect(m.client.approveAgentAction).not.toHaveBeenCalled();
});

it("observes focus immediately when a pending approval first enters the document", async () => {
  const proposal = { id: "mount-focus", status: "proposed", toolName: "create_github_branch", riskLevel: "medium", argsJson: { repositoryFullName: "fixture/repository", baseBranch: "main", newBranchName: "change" } };
  m.client.getAgentConversation.mockResolvedValueOnce({ ok: true, data: { ...summary, turns: [], actions: [proposal] } });
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [{ id: "mount-result", role: "tool_result", content: "Independent execution observed on initial focus." }], actions: [{ ...proposal, status: "executed" }] } });
  let focused = false;
  const observer = new MutationObserver(() => {
    if (!focused && screen.queryByRole("button", { name: "Approve & run" })) {
      focused = true;
      fireEvent(window, new Event("focus"));
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  try {
    render(createElement(AgentChatView));
    await screen.findByText("Independent execution observed on initial focus.");
    expect(focused).toBe(true);
    expect(m.client.getAgentConversation).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Approve & run" })).toBeNull();
    expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
    expect(m.client.approveAgentAction).not.toHaveBeenCalled();
    expect(m.client.rejectAgentAction).not.toHaveBeenCalled();
  } finally { observer.disconnect(); }
});

it("rechecks an external decision when focus returns during a stale pending read", async () => {
  const proposal = { id: "overlapping-focus", status: "proposed", toolName: "create_github_branch", riskLevel: "medium", argsJson: { repositoryFullName: "fixture/repository", baseBranch: "main", newBranchName: "change" } };
  const pending = { ok: true, data: { ...summary, turns: [], actions: [proposal] } };
  m.client.getAgentConversation.mockResolvedValue(pending);
  render(createElement(AgentChatView));
  await screen.findByRole("button", { name: "Approve & run" });
  await act(async () => {});
  const stale = deferred<unknown>();
  m.client.getAgentConversation.mockReturnValueOnce(stale.promise);
  const before = m.client.getAgentConversation.mock.calls.length;
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(m.client.getAgentConversation.mock.calls.length).toBe(before + 1));
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [{ id: "fresh-external-result", role: "tool_result", content: "Independent execution observed after overlapping focus." }], actions: [{ ...proposal, status: "executed" }] } });
  fireEvent(window, new Event("focus"));
  fireEvent(window, new Event("focus"));
  await act(async () => { stale.resolve(pending); });
  await screen.findByText("Independent execution observed after overlapping focus.");
  expect(m.client.getAgentConversation).toHaveBeenCalledTimes(before + 2);
  expect(screen.queryByRole("button", { name: "Approve & run" })).toBeNull();
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  expect(m.client.approveAgentAction).not.toHaveBeenCalled();
  expect(m.client.rejectAgentAction).not.toHaveBeenCalled();
});

it("retains pending approval when a focus refresh cannot verify the conversation", async () => {
  const proposal = { id: "external-review", status: "proposed", toolName: "create_github_branch", riskLevel: "medium", argsJson: { repositoryFullName: "fixture/repository", baseBranch: "main", newBranchName: "change" } };
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [], actions: [proposal] } });
  render(createElement(AgentChatView)); await screen.findByRole("button", { name: "Approve & run" });
  const before = m.client.getAgentConversation.mock.calls.length;
  m.client.getAgentConversation.mockResolvedValue({ ok: false, error: "unavailable" });
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(m.client.getAgentConversation.mock.calls.length).toBeGreaterThan(before));
  expect(screen.getByRole("button", { name: "Approve & run" })).toBeTruthy();
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});

it("observes an external rejection by polling without requiring a focus event", async () => {
  const proposal = { id: "external-review", status: "proposed", toolName: "create_github_branch", riskLevel: "medium", argsJson: { repositoryFullName: "fixture/repository", baseBranch: "main", newBranchName: "change" } };
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [], actions: [proposal] } });
  const interval = vi.spyOn(window, "setInterval");
  render(createElement(AgentChatView)); await screen.findByRole("button", { name: "Approve & run" });
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [{ id: "external-rejection", role: "tool_result", content: "External reviewer rejected this proposal." }], actions: [{ ...proposal, status: "rejected" }] } });
  // The button renders before React is required to flush the polling effect.
  await waitFor(() => expect(typeof interval.mock.calls.find(([, delay]) => delay === 15_000)?.[0]).toBe("function"));
  const polling = interval.mock.calls.find(([, delay]) => delay === 15_000)![0];
  await act(async () => { (polling as () => void)(); });
  await screen.findByText("External reviewer rejected this proposal.");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled(); expect(m.client.rejectAgentAction).not.toHaveBeenCalled();
  interval.mockRestore();
});

it("ignores an external-decision read that finishes after the desktop credential changes", async () => {
  const proposal = { id: "external-review", status: "proposed", toolName: "create_github_branch", riskLevel: "medium", argsJson: { repositoryFullName: "fixture/repository", baseBranch: "main", newBranchName: "change" } };
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [], actions: [proposal] } });
  const listening = vi.spyOn(window, "addEventListener");
  const view = render(createElement(AgentChatView)); await screen.findByRole("button", { name: "Approve & run" });
  await waitFor(() => expect(listening.mock.calls.some(([event]) => event === "focus")).toBe(true));
  const old = deferred<unknown>(); m.client.getAgentConversation.mockReturnValueOnce(old.promise);
  const before = m.client.getAgentConversation.mock.calls.length;
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(m.client.getAgentConversation.mock.calls.length).toBe(before + 1));
  m.client.config = { sessionToken: "replacement" }; view.rerender(createElement(AgentChatView));
  await act(async () => { old.resolve({ ok: true, data: { ...summary, turns: [{ id: "old-result", role: "tool_result", content: "Must not show an old workspace result." }], actions: [{ ...proposal, status: "executed" }] } }); });
  expect(screen.queryByText("Must not show an old workspace result.")).toBeNull();
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  listening.mockRestore();
});

it("restores a recorded GitHub commit receipt without sending or approving again", async () => {
  const sha = "a".repeat(40);
  m.client.getAgentConversation.mockResolvedValue({ok:true,data:{...summary,turns:[],actions:[{id:"commit-receipt",toolName:"commit_github_files",riskLevel:"medium",status:"executed",argsJson:{repositoryFullName:"fixture/repository",branch:"feature",files:[{path:"a.ts"},{path:"b.ts"}]},resultJson:{sha,htmlUrl:`https://github.com/fixture/repository/commit/${sha}`,fileCount:2}}]}});
  render(createElement(AgentChatView));
  expect(await screen.findByRole("link",{name:"View recorded commit"})).toBeTruthy();
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled(); expect(m.client.approveAgentAction).not.toHaveBeenCalled();
});

it("recovers a web-approved commit receipt on focus without a second execution", async () => {
  const sha="b".repeat(40);
  const proposal={id:"external-commit",status:"proposed",toolName:"commit_github_files",riskLevel:"medium",argsJson:{repositoryFullName:"fixture/repository",branch:"feature",files:[{path:"a.ts",content:"a"},{path:"b.ts",content:"b"}]}};
  m.client.getAgentConversation.mockResolvedValue({ok:true,data:{...summary,turns:[],actions:[proposal]}});
  render(createElement(AgentChatView)); await screen.findByRole("button",{name:"Approve & run"});
  m.client.getAgentConversation.mockResolvedValue({ok:true,data:{...summary,turns:[],actions:[{...proposal,status:"executed",resultJson:{sha,htmlUrl:`https://github.com/fixture/repository/commit/${sha}`,fileCount:2}}]}});
  fireEvent(window,new Event("focus"));
  expect(await screen.findByRole("link",{name:"View recorded commit"})).toBeTruthy();
  expect(screen.queryByRole("button",{name:"Approve & run"})).toBeNull();
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();expect(m.client.approveAgentAction).not.toHaveBeenCalled();
  m.client.createAgentConversation.mockResolvedValue({ok:true,data:{...summary,id:"new-empty",turns:[],actions:[]}});
  fireEvent.click(screen.getByRole("button",{name:"New chat"}));
  await waitFor(()=>expect(screen.queryByRole("link",{name:"View recorded commit"})).toBeNull());
});

it("reconciles a second external decision after cancelling and replacing a proposal in the same conversation", async () => {
  const first = { id: "cancelled-first", status: "proposed", toolName: "create_github_branch", riskLevel: "medium", argsJson: { repositoryFullName: "fixture/repository", baseBranch: "main", newBranchName: "first" } };
  const second = { ...first, id: "reviewed-second", argsJson: { ...first.argsJson, newBranchName: "second" } };
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [], actions: [first] } });
  m.client.rejectAgentAction.mockResolvedValue({ ok: true, data: { status: "rejected" } });
  const interval = vi.spyOn(window, "setInterval");
  render(createElement(AgentChatView));
  fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
  await screen.findByText(/Create a branch — rejected/);
  m.client.sendAgentMessage.mockResolvedValue({ ok: true, data: { reply: "Replacement for review", proposal: second, usage: { steps: 1, inputTokens: 1, outputTokens: 1 } } });
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [], actions: [{ ...first, status: "rejected" }, second] } });
  await draft();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Replacement for review");
  await waitFor(() => expect((screen.getByRole("button", { name: "Approve & run" }) as HTMLButtonElement).disabled).toBe(false));
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [{ id: "second-result", role: "tool_result", content: "Second independent decision executed." }], actions: [{ ...first, status: "rejected" }, { ...second, status: "executed" }] } });
  const polling = interval.mock.calls.filter(([, delay]) => delay === 15_000).at(-1)?.[0];
  await act(async () => { (polling as () => void)(); });
  await screen.findByText("Second independent decision executed.");
  expect(screen.queryByRole("button", { name: "Approve & run" })).toBeNull();
  expect(m.client.sendAgentMessage).toHaveBeenCalledOnce();
  expect(m.client.approveAgentAction).not.toHaveBeenCalled();
  expect(m.client.rejectAgentAction).toHaveBeenCalledOnce();
  interval.mockRestore();
});

it.each(["visible", "hidden"] as const)("immediately reconciles an external decision when returning from Settings with visibility %s without focus or a polling tick", async visibility => {
  const visibilitySpy = vi.spyOn(document, "visibilityState", "get").mockReturnValue(visibility);
  try {
  const proposal = { id: "reviewed-away", status: "proposed", toolName: "create_github_branch", riskLevel: "medium", argsJson: { repositoryFullName: "fixture/repository", baseBranch: "main", newBranchName: "change" } };
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [], actions: [proposal] } });
  const view = render(createElement(AgentChatView, { active: true }));
  await screen.findByRole("button", { name: "Approve & run" });
  view.rerender(createElement(AgentChatView, { active: false }));
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [{ id: "reviewed-away-result", role: "tool_result", content: "Independent reviewer decided while Settings was open." }], actions: [{ ...proposal, status: "rejected" }] } });
  view.rerender(createElement(AgentChatView, { active: true }));
  await screen.findByText("Independent reviewer decided while Settings was open.");
  expect(screen.queryByRole("button", { name: "Approve & run" })).toBeNull();
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  expect(m.client.approveAgentAction).not.toHaveBeenCalled();
  expect(m.client.rejectAgentAction).not.toHaveBeenCalled();
  } finally { visibilitySpy.mockRestore(); }
});

it("keeps background decision polling suppressed while the native document is hidden", async () => {
  const visibilitySpy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  let poll: (() => void) | undefined;
  const originalInterval = window.setInterval.bind(window);
  const interval = vi.spyOn(window, "setInterval").mockImplementation((handler, delay) => {
    if (delay === 15_000) poll = handler as () => void;
    return originalInterval(handler, delay) as unknown as ReturnType<typeof setInterval>;
  });
  try {
    const proposal = { id: "hidden-poll", status: "proposed", toolName: "create_github_branch", riskLevel: "medium", argsJson: { repositoryFullName: "fixture/repository", baseBranch: "main", newBranchName: "change" } };
    m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [], actions: [proposal] } });
    render(createElement(AgentChatView));
    await screen.findByRole("button", { name: "Approve & run" });
    await waitFor(() => expect(poll).toBeTypeOf("function"));
    const reads = m.client.getAgentConversation.mock.calls.length;
    await act(async () => { poll?.(); fireEvent(window, new Event("focus")); });
    expect(m.client.getAgentConversation).toHaveBeenCalledTimes(reads);
    expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  } finally { interval.mockRestore(); visibilitySpy.mockRestore(); }
});

it("manually refreshes an independently reviewed decision without another send or approval", async () => {
  const proposal = { id: "manual-refresh", status: "proposed", toolName: "create_github_branch", riskLevel: "medium", argsJson: { repositoryFullName: "fixture/repository", baseBranch: "main", newBranchName: "change" } };
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [], actions: [proposal] } });
  render(createElement(AgentChatView));
  const refresh = await screen.findByRole("button", { name: "Refresh decision" });
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [{ id: "manual-result", role: "tool_result", content: "Independent decision read from service." }], actions: [{ ...proposal, status: "executed" }] } });
  fireEvent.click(refresh);
  await screen.findByText("Independent decision read from service.");
  expect(screen.queryByRole("button", { name: "Approve & run" })).toBeNull();
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled(); expect(m.client.approveAgentAction).not.toHaveBeenCalled(); expect(m.client.rejectAgentAction).not.toHaveBeenCalled();
});

it("keeps a pending decision and offers retry when manual refresh cannot verify it", async () => {
  const proposal = { id: "manual-unavailable", status: "proposed", toolName: "create_github_branch", riskLevel: "medium", argsJson: { repositoryFullName: "fixture/repository", baseBranch: "main", newBranchName: "change" } };
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [], actions: [proposal] } });
  render(createElement(AgentChatView));
  const refresh = await screen.findByRole("button", { name: "Refresh decision" });
  m.client.getAgentConversation.mockResolvedValue({ ok: false, error: "unavailable" });
  fireEvent.click(refresh);
  await screen.findByText("The decision could not be verified. Try refreshing again.");
  expect(screen.getByRole("button", { name: "Approve & run" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "Refresh decision" }) as HTMLButtonElement).disabled).toBe(false);
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled(); expect(m.client.approveAgentAction).not.toHaveBeenCalled();
});

it("coalesces manual decision reads and discards their result after credentials change", async () => {
  const proposal = { id: "manual-late", status: "proposed", toolName: "create_github_branch", riskLevel: "medium", argsJson: { repositoryFullName: "fixture/repository", baseBranch: "main", newBranchName: "change" } };
  m.client.getAgentConversation.mockResolvedValue({ ok: true, data: { ...summary, turns: [], actions: [proposal] } });
  const view = render(createElement(AgentChatView));
  const refresh = await screen.findByRole("button", { name: "Refresh decision" });
  const before = m.client.getAgentConversation.mock.calls.length;
  const read = deferred<unknown>(); m.client.getAgentConversation.mockReturnValueOnce(read.promise);
  fireEvent.click(refresh);
  const checking = screen.getByRole("button", { name: "Checking decision…" }) as HTMLButtonElement;
  expect(checking.disabled).toBe(true); fireEvent.click(checking);
  expect(m.client.getAgentConversation.mock.calls.length).toBe(before + 1);
  m.client.config = { sessionToken: "new-context" }; view.rerender(createElement(AgentChatView));
  await act(async () => read.resolve({ ok: true, data: { ...summary, turns: [{ id: "late-manual", role: "tool_result", content: "Wrong-context decision must stay hidden." }], actions: [{ ...proposal, status: "executed" }] } }));
  expect(screen.queryByText("Wrong-context decision must stay hidden.")).toBeNull();
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled(); expect(m.client.approveAgentAction).not.toHaveBeenCalled();
});

it("sends an explicit one-call bound and clamps it to the selected mode", async () => {
  render(createElement(AgentChatView)); await draft(); await openAgentConfiguration();
  fireEvent.change(screen.getByRole("combobox", { name: "Model-call limit" }), { target: { value: "4" } });
  fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
  expect((screen.getByRole("combobox", { name: "Model-call limit" }) as HTMLSelectElement).value).toBe("2");
  fireEvent.change(screen.getByRole("combobox", { name: "Model-call limit" }), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(m.client.sendAgentMessage).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.objectContaining({ maxDecisionSteps: 1, operationMode: "inspect" }), expect.anything(), expect.anything()));
});

it("does not insert skill shortcuts into the Agent composer after catalog loading", async () => {
  m.client.listAgentSkills.mockResolvedValue({ok: true, data: {skills: [{id: "safe-repository-change", status: "enabled"}]}});
  render(createElement(AgentChatView)); await draft();
  await waitFor(() => expect(m.client.listAgentSkills).toHaveBeenCalled());
  expect(screen.queryByText("Skill shortcuts")).toBeNull();
  expect(screen.queryByRole("button", {name: "/safe-repository-change"})).toBeNull();
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});

it("offers the unified welcome and enters the retained AI workspace without sending", async () => {
  m.client.hasAuth.mockReturnValue(true);
  m.client.verifyCurrentCredential.mockResolvedValue({ok: true, data: {kind: "desktop_session", organizationId: "fixture-workspace", role: "owner", capabilities: [], access: {allowed: true}}});
  render(createElement(App));
  await screen.findByRole("heading", {name: "What would you like to accomplish today?"});
  expect(screen.getByRole("button", {name: "Axiom home"}).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("button", {name: "Agent"}).getAttribute("aria-current")).toBeNull();
  expect(screen.getByRole("button", {name: /Automate Operations/})).toBeTruthy();
  expect(screen.getByRole("button", {name: /Deploy and Manage/})).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name: /Build with AI/}));
  await draft();
  expect(screen.getByRole("button", {name: "Editor & Agent"}).getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(screen.getByRole("button", {name: "Editor & Agent"}));
  expect(screen.getByRole("button", {name: "Single pane"}).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", {name: "Repositories"}));
  expect(screen.queryByRole("textbox", {name: "Agent request"})).toBeNull();
  expect(screen.getByRole("button", {name: "Repositories"}).getAttribute("aria-current")).toBe("page");
  fireEvent.click(screen.getByRole("button", {name: "Agent"}));
  expect(screen.getByRole("button", {name: "Agent"}).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("button", {name: "Axiom home"}).getAttribute("aria-current")).toBeNull();
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "Axiom home"}));
  await screen.findByRole("heading", {name: "What would you like to accomplish today?"});
  fireEvent.click(screen.getByRole("button", {name: /Build with AI/}));
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
});

it("enters real deployment intake from welcome and retains its unsent form through home", async () => {
  m.client.hasAuth.mockReturnValue(true);
  m.client.verifyCurrentCredential.mockResolvedValue({ok: true, data: {kind: "desktop_session", organizationId: "fixture-workspace", role: "owner", capabilities: [], access: {allowed: true}}});
  m.client.deploymentRequests.mockResolvedValue({ok: true, data: []});
  m.client.listDeploymentExecutions.mockResolvedValue({ok: true, data: {executions: []}});
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button", {name: /Deploy and Manage/}));
  fireEvent.click(await screen.findByRole("button", {name: "Start from ticket"}));
  fireEvent.change(screen.getByRole("textbox", {name: "Request title"}), {target: {value: "Unsent release acceptance"}});
  fireEvent.click(screen.getByRole("button", {name: "Axiom home"}));
  fireEvent.click(await screen.findByRole("button", {name: /Deploy and Manage/}));
  expect((screen.getByRole("textbox", {name: "Request title"}) as HTMLInputElement).value).toBe("Unsent release acceptance");
  fireEvent.click(screen.getByRole("button", {name: "Back to release requests"}));
  expect(screen.queryByRole("textbox", {name: "Request title"})).toBeNull();
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it("enters real Airflow recovery and opens connection setup without connecting", async () => {
  m.client.hasAuth.mockReturnValue(true);
  m.client.verifyCurrentCredential.mockResolvedValue({ok: true, data: {kind: "desktop_session", organizationId: "fixture-workspace", role: "owner", capabilities: [], access: {allowed: true}}});
  m.client.airflowConnection.mockResolvedValue({ok: true, data: {connected: false, status: "not_connected"}});
  m.client.listAirflowAutomations.mockResolvedValue({ok: true, data: {automations: [], executions: []}});
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button", {name: /Automate Operations/}));
  await screen.findByRole("heading", {name: "Connect Airflow first"});
  fireEvent.click(screen.getByRole("button", {name: "Open connection setup"}));
  expect((await screen.findByRole("button", {name: "Validate & connect"}) as HTMLButtonElement).disabled).toBe(true);
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});

it("can enter Agent for the first time through a verified marketplace handoff from welcome", async () => {
  m.client.hasAuth.mockReturnValue(true);
  m.client.verifyCurrentCredential.mockResolvedValue({ok: true, data: {kind: "desktop_session", organizationId: "fixture-workspace", role: "owner", capabilities: [], access: {allowed: true}}});
  m.client.listAgentSkills.mockResolvedValue({ok: true, data: {skills: [{id: "safe-repository-change", name: "Safe repository change", description: "Existing workflow", category: "GitHub", toolNames: ["read_github_file"], status: "enabled"}]}});
  render(createElement(App));
  await screen.findByRole("heading", {name: "What would you like to accomplish today?"});
  fireEvent.click(screen.getByRole("button", {name: "Apps & skills"}));
  fireEvent.click(await screen.findByRole("button", {name: "Use in Agent"}));
  await waitFor(() => expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("/safe-repository-change "));
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});

it("keeps model checking inside the existing selector rather than inserting a composer panel", async () => {
  const pending = deferred<unknown>();
  m.client.aiProviderStatus.mockReturnValueOnce(pending.promise);
  render(createElement(AgentChatView)); await draft();
  const selector = screen.getByRole("combobox", {name: "Agent model"}) as HTMLSelectElement;
  expect(selector.disabled).toBe(true);
  expect(within(selector).getByRole("option", {name: "Checking workspace models…"})).toBeTruthy();
  expect(screen.queryByRole("button", {name: "Retry models"})).toBeNull();
  const width = selector.className;
  await act(async () => {pending.resolve(ready);});
  await screen.findByRole("option", {name: "Fixture model"});
  expect(screen.getByRole("combobox", {name: "Agent model"})).toBe(selector);
  expect(selector.className).toBe(width);
  expect((screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Keep this unsent request");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
