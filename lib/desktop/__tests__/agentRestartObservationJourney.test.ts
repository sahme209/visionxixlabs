/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const m = vi.hoisted(() => ({ client: { config: { sessionToken: "paired" }, listAgentConversations: vi.fn(), getAgentConversation: vi.fn(), aiProviderStatus: vi.fn(), listAgentSkills: vi.fn(), listGithubRepositories: vi.fn(), listEnvironments: vi.fn(), sendAgentMessage: vi.fn(), createAgentConversation: vi.fn(), approveAgentAction: vi.fn(), observeDeploymentExecution: vi.fn() } }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: m.client }));
import { AgentChatView } from "../../../desktop/src/views/AgentChatView";
const execution = { id: "receipt-1", repositoryFullName: "owner/repo", environmentId: "env-1", source: "agent", status: "tracking_unavailable", conclusion: null, rollbackStatus: "not_started", workflowRunId: null };
const proposal = { id: "proposal-1", toolName: "trigger_aws_deploy", status: "proposed", riskLevel: "high", argsJson: { repositoryFullName: "owner/repo", environmentId: "env-1", _review: { kind: "ecs_restart_target", environmentId: "env-1", environmentTier: "dev", roleArn: "arn:aws:iam::123456789012:role/restart", region: "us-east-1", ecsCluster: "cluster", ecsService: "service", targetUpdatedAt: "2026-10-16T00:00:00Z" } } };
function conversation(actions: unknown[], turns: unknown[] = []) { return { ok: true, data: { id: "conversation-1", title: "Restart", actions, turns } }; }
beforeEach(() => {
  vi.resetAllMocks(); window.localStorage.clear(); Element.prototype.scrollIntoView = vi.fn(); Element.prototype.scrollTo = vi.fn(); m.client.config = { sessionToken: "paired" };
  m.client.listAgentConversations.mockResolvedValue({ ok: true, data: { conversations: [{ id: "conversation-1", title: "Restart", turnCount: 0, createdAt: "2026-10-16T00:00:00Z", updatedAt: "2026-10-16T00:00:00Z" }] } });
  m.client.aiProviderStatus.mockResolvedValue({ ok: true, data: { providers: [{ provider: "vercel_gateway", models: [] }], policy: { enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: "service-default" }, fallbackOrder: ["vercel_gateway"] } } });
  m.client.listAgentSkills.mockResolvedValue({ ok: true, data: { skills: [] } }); m.client.listGithubRepositories.mockResolvedValue({ ok: true, data: { repositories: [] } }); m.client.listEnvironments.mockResolvedValue({ ok: true, data: { environments: [] } });
});
afterEach(cleanup);
it("actual approval click refreshes durable conversation and restores truthful receipt on reopen", async () => {
  const executed = { ...proposal, status: "executed", resultJson: { dispatched: true, execution } };
  m.client.getAgentConversation.mockResolvedValueOnce(conversation([proposal])).mockResolvedValue(conversation([executed], [{ id: "turn", role: "tool_result", actionProposalId: proposal.id, content: "trigger_aws_deploy approved and executed." }]));
  m.client.approveAgentAction.mockResolvedValue({ ok: true, data: { id: proposal.id, status: "executed", errorMessage: null } });
  const view = render(createElement(AgentChatView)); fireEvent.click(await screen.findByRole("button", { name: "Approve & run" }));
  await screen.findByText("ECS restart workflow request recorded"); expect(screen.queryByText(/Restart AWS ECS service — done/)).toBeNull();
  expect(screen.getByText(/GitHub workflow: tracking unavailable/)).toBeTruthy(); expect(m.client.observeDeploymentExecution).not.toHaveBeenCalled();
  view.unmount(); render(createElement(AgentChatView)); await screen.findByText("ECS restart workflow request recorded");
  expect(screen.queryByText("trigger_aws_deploy approved and executed.")).toBeNull(); expect(screen.getByText(/Service outcome and application health remain unverified/)).toBeTruthy();
  expect(m.client.approveAgentAction).toHaveBeenCalledOnce();
});
it("does not reapprove if the saved decision's receipt read fails", async () => {
  m.client.getAgentConversation.mockResolvedValueOnce(conversation([proposal])).mockRejectedValue(new Error("synthetic transport failure"));
  m.client.approveAgentAction.mockResolvedValue({ ok: true, data: { id: proposal.id, status: "executed", errorMessage: null } });
  render(createElement(AgentChatView)); fireEvent.click(await screen.findByRole("button", { name: "Approve & run" }));
  await screen.findByText(/decision is saved.*receipt could not be read/); await waitFor(() => expect(screen.queryByRole("button", { name: "Approve & run" })).toBeNull()); expect(m.client.approveAgentAction).toHaveBeenCalledOnce();
});

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function summaries(ids: string[]) { return { ok: true, data: { conversations: ids.map(id => ({ id, title: id, turnCount: 0, createdAt: "2026-10-16T00:00:00Z", updatedAt: "2026-10-16T00:00:00Z" })) } }; }
function loaded(id: string, content: string, actions: unknown[] = []) { const result = conversation(actions, [{ id: `turn-${id}`, role: "assistant", content }]); result.data.id = id; return result; }
it("navigation during a pending decision drops old UI callbacks and recovers the durable receipt on reopen", async () => {
  const pending = deferred<unknown>(); let approved = false;
  m.client.listAgentConversations.mockResolvedValue(summaries(["conversation-1", "conversation-2"]));
  m.client.getAgentConversation.mockImplementation(async id => id === "conversation-2" ? loaded(id, "Second conversation") : conversation(approved ? [{ ...proposal, status: "executed", resultJson: { execution } }] : [proposal]));
  m.client.approveAgentAction.mockReturnValue(pending.promise);
  render(createElement(AgentChatView)); fireEvent.click(await screen.findByRole("button", { name: "Approve & run" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Agent conversation" }), { target: { value: "conversation-2" } }); await screen.findByText("Second conversation");
  await act(async () => { approved = true; pending.resolve({ ok: true, data: { id: proposal.id, status: "executed", errorMessage: null } }); });
  expect(screen.queryByText(/ECS restart workflow request accepted/)).toBeNull(); expect(screen.queryByLabelText("ECS restart workflow receipt")).toBeNull(); expect(screen.queryByRole("button", { name: "Approve & run" })).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "Agent conversation" }), { target: { value: "conversation-1" } }); await screen.findByLabelText("ECS restart workflow receipt"); expect(m.client.approveAgentAction).toHaveBeenCalledOnce();
});
it("never publishes an old startup restore after credential change", async () => {
  const pending = deferred<unknown>(); m.client.getAgentConversation.mockReturnValue(pending.promise);
  const view = render(createElement(AgentChatView)); await waitFor(() => expect(m.client.getAgentConversation).toHaveBeenCalledOnce());
  m.client.listAgentConversations.mockResolvedValue(summaries(["new-conversation"]));
  m.client.getAgentConversation.mockResolvedValue(loaded("new-conversation", "New tenant conversation"));
  m.client.config = { sessionToken: "other-tenant" }; view.rerender(createElement(AgentChatView));
  await act(async () => { pending.resolve(loaded("conversation-1", "OLD TENANT RESTORE", [{ ...proposal, status: "executed", resultJson: { execution } }])); });
  expect(screen.queryByText("OLD TENANT RESTORE")).toBeNull(); expect(screen.queryByLabelText("ECS restart workflow receipt")).toBeNull();
});
it("keeps the latest selection when queued conversation loads complete in reverse order", async () => {
  const a = deferred<unknown>(), b = deferred<unknown>();
  m.client.listAgentConversations.mockResolvedValue(summaries(["conversation-1", "conversation-2", "conversation-3"]));
  m.client.getAgentConversation.mockImplementation(id => id === "conversation-1" ? Promise.resolve(loaded(id, "Initial conversation")) : id === "conversation-2" ? a.promise : b.promise);
  render(createElement(AgentChatView)); await screen.findByText("Initial conversation");
  act(() => { fireEvent.change(screen.getByRole("combobox", { name: "Agent conversation" }), { target: { value: "conversation-2" } }); fireEvent.change(screen.getByRole("combobox", { name: "Agent conversation" }), { target: { value: "conversation-3" } }); });
  await act(async () => { b.resolve(loaded("conversation-3", "Newest conversation")); });
  await act(async () => { a.resolve(loaded("conversation-2", "STALE conversation", [{ ...proposal, status: "executed", resultJson: { execution } }])); });
  expect(screen.getByText("Newest conversation")).toBeTruthy(); expect(screen.queryByText("STALE conversation")).toBeNull(); expect(screen.queryByLabelText("ECS restart workflow receipt")).toBeNull();
});
it("drops a post-message receipt refresh after credential change", async () => {
  const pending = deferred<unknown>(); m.client.getAgentConversation.mockResolvedValueOnce(loaded("conversation-1", "Initial conversation")).mockReturnValue(pending.promise);
  m.client.sendAgentMessage.mockResolvedValue({ ok: true, data: { reply: "Read requested", proposal: null, usage: null } });
  const view = render(createElement(AgentChatView)); await screen.findByText("Initial conversation");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Inspect the workflow" } }); fireEvent.click(screen.getByRole("button", { name: "Send" })); await waitFor(() => expect(m.client.getAgentConversation).toHaveBeenCalledTimes(2));
  m.client.listAgentConversations.mockResolvedValue(summaries(["new-conversation"]));
  m.client.getAgentConversation.mockResolvedValue(loaded("new-conversation", "New tenant conversation"));
  m.client.config = { sessionToken: "other-tenant" }; view.rerender(createElement(AgentChatView));
  await act(async () => { pending.resolve(loaded("conversation-1", "OLD TENANT REFRESH", [{ ...proposal, status: "executed", resultJson: { execution } }])); });
  expect(screen.queryByLabelText("ECS restart workflow receipt")).toBeNull(); expect(screen.queryByText("OLD TENANT REFRESH")).toBeNull();
});

it("clears populated old state and pending-send locks, then loads and sends in the new credential context", async () => {
  const oldSend = deferred<unknown>();
  m.client.getAgentConversation.mockResolvedValue(loaded("conversation-1", "PRIVATE OLD CONTENT", [{ ...proposal, status: "executed", resultJson: { execution } }]));
  m.client.sendAgentMessage.mockReturnValueOnce(oldSend.promise);
  const view = render(createElement(AgentChatView)); await screen.findByText("PRIVATE OLD CONTENT"); await screen.findByLabelText("ECS restart workflow receipt");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Old request" } }); fireEvent.click(screen.getByRole("button", { name: "Send" }));
  m.client.listAgentConversations.mockResolvedValue(summaries(["fresh-conversation"])); m.client.getAgentConversation.mockResolvedValue(loaded("fresh-conversation", "Fresh tenant loaded"));
  m.client.sendAgentMessage.mockResolvedValue({ ok: true, data: { reply: "Fresh tenant reply", proposal: null, usage: null } });
  m.client.config = { sessionToken: "new-credential" }; view.rerender(createElement(AgentChatView));
  expect(screen.queryByText("PRIVATE OLD CONTENT")).toBeNull(); expect(screen.queryByLabelText("ECS restart workflow receipt")).toBeNull();
  await screen.findByText("Fresh tenant loaded");
  await act(async () => { oldSend.resolve({ ok: true, data: { reply: "STALE OLD REPLY", proposal, usage: null } }); });
  expect(screen.queryByText("STALE OLD REPLY")).toBeNull(); expect(screen.queryByRole("button", { name: "Approve & run" })).toBeNull();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Fresh request" } }); fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Fresh tenant reply"); expect(m.client.sendAgentMessage.mock.calls.at(-1)?.[0]).toBe("fresh-conversation");
});
