/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const m = vi.hoisted(() => {
  let config = {} as { sessionToken?: string };
  let revision = 0;
  const listeners = new Set<() => void>();
  return { client: {
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

const repo2 = { id: "repo-2", fullName: "fixture/payments", defaultBranch: "develop", visibility: "private" };
it("searches connected catalogs, keeps selected context visible, and sends the exact clicked target", async () => {
  m.client.listGithubRepositories.mockResolvedValue({ ok: true, data: { repositories: [{ id: "repo-1", fullName: "fixture/repository", defaultBranch: "main", visibility: "private" }, repo2] } });
  m.client.listEnvironments.mockResolvedValue({ ok: true, data: { environments: [{ id: "env-1", name: "Development", tier: "dev" }, { id: "env-2", name: "Staging", tier: "stage" }] } });
  render(createElement(AgentChatView)); await openWorkspaceContext();
  const search = await screen.findByRole("searchbox", { name: "Search connected repositories" });
  await waitFor(() => expect((screen.getByLabelText("Active GitHub repository") as HTMLSelectElement).disabled).toBe(false));
  fireEvent.change(search, { target: { value: "PAYMENTS" } });
  fireEvent.change(screen.getByLabelText("Active GitHub repository"), { target: { value: repo2.fullName } });
  fireEvent.change(screen.getByRole("searchbox", { name: "Search deployment environments" }), { target: { value: "stag" } });
  fireEvent.change(screen.getByLabelText("Active deployment environment"), { target: { value: "env-2" } });
  expect(screen.getByLabelText("Selected Agent context").textContent).toContain("fixture/payments");
  expect(screen.getByLabelText("Selected Agent context").textContent).toContain("Staging");
  fireEvent.change(search, { target: { value: "no matching repository" } });
  expect((screen.getByLabelText("Active GitHub repository") as HTMLSelectElement).value).toBe(repo2.fullName);
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: "Inspect selected context" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(m.client.sendAgentMessage).toHaveBeenCalledWith("conversation-1", "Inspect selected context", "vercel_gateway", expect.objectContaining({ repositoryFullName: repo2.fullName, branch: "develop", environmentId: "env-2" }), "fixture/model", expect.objectContaining({ signal: expect.anything(), onDraft: expect.any(Function) })));
});
it("does not use another workspace's stored target while catalogs are pending or unavailable and recovers by retry", async () => {
  window.localStorage.setItem("axiom.workspace.repository.v1", "foreign/private");
  window.localStorage.setItem("axiom.workspace.environment.v1", "foreign-env");
  const repositories = deferred<unknown>(), environments = deferred<unknown>();
  m.client.listGithubRepositories.mockReturnValueOnce(repositories.promise); m.client.listEnvironments.mockReturnValueOnce(environments.promise);
  render(createElement(AgentChatView)); await openWorkspaceContext();
  expect(m.client.listGithubBranches).not.toHaveBeenCalled(); expect(m.client.listGithubFiles).not.toHaveBeenCalled();
  await act(async () => { repositories.resolve({ ok: false, error: "Unavailable" }); environments.resolve({ ok: false, error: "Unavailable" }); });
  expect(screen.getByLabelText("Selected Agent context").textContent).not.toContain("foreign");
  expect((screen.getByLabelText("Active GitHub repository") as HTMLSelectElement).value).toBe("");
  expect((screen.getByLabelText("Active deployment environment") as HTMLSelectElement).value).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Retry repository and environment catalogs" }));
  await waitFor(() => expect((screen.getByLabelText("Active GitHub repository") as HTMLSelectElement).value).toBe("fixture/repository"));
  expect(m.client.listGithubBranches).not.toHaveBeenCalledWith("foreign/private");
});
it("drops a prior session catalog after switching credentials and preserves independent successful catalog choices", async () => {
  const old = deferred<unknown>(); m.client.listGithubRepositories.mockReturnValueOnce(old.promise);
  const view = render(createElement(AgentChatView)); await openWorkspaceContext();
  await screen.findByRole("option", { name: "Development · dev" });
  m.client.config = { sessionToken: "new-session" }; view.rerender(createElement(AgentChatView)); await openWorkspaceContext();
  await waitFor(() => expect((screen.getByLabelText("Active GitHub repository") as HTMLSelectElement).value).toBe("fixture/repository"));
  await act(async () => { old.resolve({ ok: true, data: { repositories: [{ ...repo2, fullName: "foreign/private" }] } }); });
  expect(screen.queryByRole("option", { name: /foreign\/private/ })).toBeNull();
  expect(screen.getByRole("option", { name: "Development · dev" })).toBeTruthy();
});

it("keeps a successful repository catalog usable when environments fail and leaves readiness unavailable", async () => {
  m.client.listEnvironments.mockResolvedValue({ ok: false, error: "Unavailable" });
  render(createElement(AgentChatView)); await openWorkspaceContext();
  await waitFor(() => expect((screen.getByLabelText("Active GitHub repository") as HTMLSelectElement).value).toBe("fixture/repository"));
  expect((screen.getByRole("button", { name: "Review repository" }) as HTMLButtonElement).disabled).toBe(false);
  expect((screen.getByRole("button", { name: "Check deploy readiness" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByLabelText("Active deployment environment") as HTMLSelectElement).value).toBe("");
});
it("preserves explicit manual repository recovery without claiming connected catalog authority", async () => {
  m.client.listGithubRepositories.mockResolvedValue({ ok: false, error: "Unavailable" });
  render(createElement(AgentChatView)); await openWorkspaceContext();
  await waitFor(() => expect((screen.getByLabelText("Active GitHub repository") as HTMLSelectElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText("Active GitHub repository"), { target: { value: "__manual__" } });
  fireEvent.change(screen.getByLabelText("Repository owner and name"), { target: { value: "explicit/recovery" } });
  expect(screen.getByLabelText("Selected Agent context").textContent).toContain("explicit/recovery (manual, catalog unverified)");
  fireEvent.change(screen.getByRole("textbox", { name: "Repository owner and name" }), { target: { value: "explicit/recovery" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Agent request" }), { target: { value: "Inspect manually entered repository" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(m.client.sendAgentMessage).toHaveBeenCalledWith("conversation-1", "Inspect manually entered repository", "vercel_gateway", expect.objectContaining({ repositoryFullName: "explicit/recovery" }), "fixture/model", expect.objectContaining({ signal: expect.anything(), onDraft: expect.any(Function) })));
});

it("restores saved preferences only when returned by current catalogs and preserves the saved environment", async () => {
  window.localStorage.setItem("axiom.workspace.repository.v1", repo2.fullName);
  window.localStorage.setItem("axiom.workspace.environment.v1", "env-1");
  m.client.listGithubRepositories.mockResolvedValue({ ok: true, data: { repositories: [repo2], truncated: true } });
  render(createElement(AgentChatView)); await openWorkspaceContext();
  await waitFor(() => expect((screen.getByLabelText("Active deployment environment") as HTMLSelectElement).value).toBe("env-1"));
  expect((screen.getByLabelText("Active GitHub repository") as HTMLSelectElement).value).toBe(repo2.fullName);
  expect(window.localStorage.getItem("axiom.workspace.environment.v1")).toBe("env-1");
  expect(screen.getByText(/Search filters the loaded connected repositories only/)).toBeTruthy();
});

it("preserves an explicit no-environment choice on catalog retry", async () => {
  window.localStorage.setItem("axiom.workspace.environment.v1", "env-1");
  m.client.listGithubRepositories.mockResolvedValueOnce({ ok: false, error: "Unavailable" });
  render(createElement(AgentChatView)); await openWorkspaceContext();
  await waitFor(() => expect((screen.getByLabelText("Active deployment environment") as HTMLSelectElement).value).toBe("env-1"));
  fireEvent.change(screen.getByLabelText("Active deployment environment"), { target: { value: "" } });
  expect(window.localStorage.getItem("axiom.workspace.environment.v1")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry repository and environment catalogs" }));
  await waitFor(() => expect((screen.getByLabelText("Active GitHub repository") as HTMLSelectElement).disabled).toBe(false));
  expect((screen.getByLabelText("Active deployment environment") as HTMLSelectElement).value).toBe("");
});
it("preserves a selected branch when retrying an unavailable environment catalog", async () => {
  m.client.listGithubBranches.mockResolvedValue({ ok: true, data: { branches: [{ name: "main", protected: true }, { name: "release", protected: true }] } });
  m.client.listEnvironments.mockResolvedValueOnce({ ok: false, error: "Unavailable" });
  render(createElement(AgentChatView)); await openWorkspaceContext();
  await screen.findByRole("option", { name: "release · protected" });
  fireEvent.change(screen.getByLabelText("Active GitHub branch"), { target: { value: "release" } });
  fireEvent.click(screen.getByRole("button", { name: "Retry repository and environment catalogs" }));
  await waitFor(() => expect((screen.getByLabelText("Active GitHub repository") as HTMLSelectElement).disabled).toBe(false));
  expect((screen.getByLabelText("Active GitHub branch") as HTMLSelectElement).value).toBe("release");
});

it("preserves an explicit manual branch when the same repository is revalidated", async () => {
  m.client.listEnvironments.mockResolvedValueOnce({ ok: false, error: "Unavailable" });
  render(createElement(AgentChatView)); await openWorkspaceContext();
  await waitFor(() => expect((screen.getByLabelText("Active GitHub repository") as HTMLSelectElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText("Active GitHub branch"), { target: { value: "__manual__" } });
  fireEvent.change(screen.getByLabelText("Git branch name"), { target: { value: "release/private" } });
  fireEvent.click(screen.getByRole("button", { name: "Retry repository and environment catalogs" }));
  await waitFor(() => expect((screen.getByLabelText("Active GitHub repository") as HTMLSelectElement).disabled).toBe(false));
  expect((screen.getByLabelText("Git branch name") as HTMLInputElement).value).toBe("release/private");
});
it("invalidates a selected file when the branch changes until the new branch catalog returns", async () => {
  m.client.listGithubFiles.mockResolvedValueOnce({ ok: true, data: { files: [{ path: "old-branch.ts", size: 10 }], truncated: false } });
  m.client.listGithubBranches.mockResolvedValue({ ok: true, data: { branches: [{ name: "main" }, { name: "release" }] } });
  render(createElement(AgentChatView)); await openWorkspaceContext();
  await openAgentConfiguration(); fireEvent.click(screen.getByRole("button", { name: "Edit repository file" }));
  await screen.findByRole("option", { name: "old-branch.ts" });
  const nextFiles = deferred<unknown>(); m.client.listGithubFiles.mockReturnValueOnce(nextFiles.promise);
  fireEvent.change(screen.getByLabelText("Active GitHub branch"), { target: { value: "release" } });
  expect(screen.queryByRole("option", { name: "old-branch.ts" })).toBeNull();
  fireEvent.change(screen.getByRole("textbox", {name:"Agent request"}), { target: { value: "Edit the file" } });
  expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { nextFiles.resolve({ ok: true, data: { files: [{ path: "new-branch.ts", size: 10 }], truncated: false } }); });
  await screen.findByRole("option", { name: "new-branch.ts" });
});

it.each(['getItem', 'setItem', 'removeItem'] as const)('keeps connected Agent context usable when preference %s is denied', async method => {
  const spy = vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error('Preference storage denied'); });
  try {
    render(createElement(AgentChatView));
    await waitFor(() => expect((screen.getByLabelText('Active GitHub repository') as HTMLSelectElement).value).toBe('fixture/repository'));
    await waitFor(() => expect((screen.getByLabelText('Active deployment environment') as HTMLSelectElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Active deployment environment'), { target: { value: 'env-1' } });
    expect((screen.getByLabelText('Active deployment environment') as HTMLSelectElement).value).toBe('env-1');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Inspect without preference persistence' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(m.client.sendAgentMessage).toHaveBeenCalledWith('conversation-1', 'Inspect without preference persistence', 'vercel_gateway', expect.objectContaining({ repositoryFullName: 'fixture/repository', environmentId: 'env-1' }), 'fixture/model', expect.objectContaining({ signal: expect.anything(), onDraft: expect.any(Function) })));
  } finally { spy.mockRestore(); }
});


it("keeps compact context discoverable and preserves the draft while opening configuration", async () => {
  render(createElement(AgentChatView));
  await waitFor(() => expect((screen.getByLabelText("Active GitHub repository") as HTMLSelectElement).value).toBe("fixture/repository"));
  const summary = screen.getByRole("button", { name: /^Workspace context/ });
  expect(summary.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("combobox", { name: "Active GitHub repository" })).toBeNull();
  expect(summary.textContent).toContain("fixture/repository");
  const composer = screen.getByRole("textbox", {name:"Agent request"}) as HTMLTextAreaElement;
  fireEvent.change(composer, { target: { value: "Keep my unsent work" } });
  fireEvent.click(summary);
  expect(summary.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("combobox", { name: "Active GitHub repository" })).toBeTruthy();
  fireEvent.click(summary);
  expect(summary.getAttribute("aria-expanded")).toBe("false");
  expect(composer.value).toBe("Keep my unsent work");
  expect(screen.getByLabelText("Agent composer")).toBeTruthy();
  const configuration = screen.getByRole("button", { name: /Agent configuration ·/ });
  expect(composer.compareDocumentPosition(configuration) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});

it("prepares an Airflow diagnosis as an unsent draft in the read-only automation profile", async()=>{
  const identity={organizationId:"org"} as import("../../../desktop/src/lib/desktopClient").VerifiedDesktopIdentity;
  const view=render(createElement(AgentChatView,{identity}));
  await waitFor(()=>expect((screen.getByRole("combobox",{name:"Agent conversation"})as HTMLSelectElement).value).toBe(summary.id));
  fireEvent.change(screen.getByRole("textbox",{name:"Agent request"}),{target:{value:"My existing question"}});
  const request={context:m.client.config,workspace:"org",dagId:"daily",runId:"run-1"};
  view.rerender(createElement(AgentChatView,{identity,requestedAirflow:request}));
  await waitFor(()=>expect((screen.getByRole("textbox",{name:"Agent request"})as HTMLTextAreaElement).value).toContain('"dagId":"daily"'));
  expect((screen.getByRole("textbox",{name:"Agent request"})as HTMLTextAreaElement).value).toContain("My existing question");
  await openAgentConfiguration();
  expect((screen.getByRole("combobox",{name:"Specialized Agent"})as HTMLSelectElement).value).toBe("automation");
  expect(screen.getByRole("button",{name:"Inspect"}).getAttribute("aria-pressed")).toBe("true");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
  view.rerender(createElement(AgentChatView,{identity,requestedAirflow:request}));
  expect((screen.getByRole("textbox",{name:"Agent request"})as HTMLTextAreaElement).value.match(/Airflow diagnostic/g)).toHaveLength(1);
});
it("refuses Airflow context from a replaced desktop credential",async()=>{
  const identity={organizationId:"org"} as import("../../../desktop/src/lib/desktopClient").VerifiedDesktopIdentity;
  render(createElement(AgentChatView,{identity,requestedAirflow:{context:{},workspace:"org",dagId:"foreign"}}));
  await screen.findByText(/Airflow selection belongs to a different sign-in or workspace/);
  expect((screen.getByRole("textbox",{name:"Agent request"})as HTMLTextAreaElement).value).not.toContain("foreign");
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});

async function openAgentConfiguration() {
 const control = await screen.findByRole("button", { name: /Agent configuration ·/ });
 if (control.getAttribute("aria-expanded") === "false") fireEvent.click(control);
}

async function openWorkspaceContext() {
  const control = await screen.findByRole("button", { name: /^Workspace context/ });
  if (control.getAttribute("aria-expanded") !== "true") fireEvent.click(control);
}

it("keeps general chat usable with a failed GitHub catalog and offers one actionable recovery notice", async () => {
 m.client.listGithubRepositories.mockResolvedValue({ok:false,error:"Unavailable"});
 const openSettings=vi.fn(); render(createElement(AgentChatView,{onOpenSettings:openSettings}));
 const recovery=await screen.findByRole("region",{name:"GitHub connection recovery"});
 expect(recovery.textContent).toContain("Chat, research, planning and authorized local work remain available");
 fireEvent.click(screen.getByRole("button",{name:"Review GitHub connection"}));expect(openSettings).toHaveBeenCalledWith("integrations");
 fireEvent.change(screen.getByRole("textbox",{name:"Agent request"}),{target:{value:"Help me plan a local application"}});
 await waitFor(()=>expect((screen.getByRole("button",{name:"Send"}) as HTMLButtonElement).disabled).toBe(false));
 fireEvent.click(screen.getByRole("button",{name:"Send"}));
 await waitFor(()=>expect(m.client.sendAgentMessage).toHaveBeenCalled());
 expect(m.client.sendAgentMessage.mock.calls[0][1]).toBe("Help me plan a local application");
 expect(m.client.listGithubFiles).not.toHaveBeenCalled();
});
it("recovers the catalog without resending a prompt or changing the conversation draft",async()=>{
 m.client.listGithubRepositories.mockResolvedValueOnce({ok:false,error:"Unavailable"});
 render(createElement(AgentChatView));await screen.findByRole("region",{name:"GitHub connection recovery"});
 fireEvent.change(screen.getByRole("textbox",{name:"Agent request"}),{target:{value:"Unsent plan"}});
 fireEvent.click(screen.getByRole("button",{name:"Retry connections"}));
 await waitFor(()=>expect(screen.queryByRole("region",{name:"GitHub connection recovery"})).toBeNull());
 expect((screen.getByRole("textbox",{name:"Agent request"}) as HTMLTextAreaElement).value).toBe("Unsent plan");
 expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
it('starts with general engineering guidance rather than requiring a repository',async()=>{
 m.client.listGithubRepositories.mockResolvedValue({ok:false,error:'GitHub unavailable'});
 render(createElement(AgentChatView));
 await screen.findByText('Ask, research or build');
 expect(screen.getByText('Start a conversation, or open an authorized local workspace from Repositories. GitHub is only needed for GitHub operations.')).toBeTruthy();
 const prompt=screen.getByRole('textbox',{name:'Agent request'});
 fireEvent.change(prompt,{target:{value:'Plan a local utility'}});
 await waitFor(()=>expect((screen.getByRole('button',{name:'Send'}) as HTMLButtonElement).disabled).toBe(false));
 expect(m.client.sendAgentMessage).not.toHaveBeenCalled();
});
