/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const m = vi.hoisted(() => ({ client: { config: {} as { sessionToken?: string }, hasAuth: vi.fn(), verifyCurrentCredential: vi.fn(), listAgentConversations: vi.fn(), getAgentConversation: vi.fn(), aiProviderStatus: vi.fn(), listAgentSkills: vi.fn(), listGithubRepositories: vi.fn(), listGithubBranches: vi.fn(), listGithubFiles: vi.fn(), listEnvironments: vi.fn(), sendAgentMessage: vi.fn(), createAgentConversation: vi.fn(), approveAgentAction: vi.fn(), rejectAgentAction: vi.fn() } }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: m.client }));
vi.mock("../../../desktop/src/lib/useNativeMenuActions", () => ({ useNativeMenuActions: vi.fn() }));
vi.mock("../../../desktop/src/lib/preferences", () => ({ readDesktopPreferences: async () => null, writeDesktopPreferences: vi.fn() }));
import { AgentChatView } from "../../../desktop/src/views/AgentChatView";
import App from "../../../desktop/src/App";
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
  fireEvent.click(screen.getByRole("button", { name: "Agent" })); await screen.findByRole("option", { name: "Fixture model" });
  expect(m.client.sendAgentMessage).not.toHaveBeenCalled(); expect(m.client.createAgentConversation).not.toHaveBeenCalled();
});
