/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
const mock = vi.hoisted(() => ({ client: { config: { sessionToken: "paired" }, observeDeploymentExecution: vi.fn() } }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: mock.client }));
import { AgentRestartReceipts } from "../../../desktop/src/components/AgentRestartReceipts";
const execution = { id: "receipt-1", repositoryFullName: "owner/repo", environmentId: "env-1", source: "agent", status: "queued", conclusion: null, rollbackStatus: "not_started", workflowRunId: "12", evidence: { operation: "unknown", requestedOperation: "service_restart", statusScope: "github_workflow", sourceArtifactVerified: false, applicationHealthVerified: false, rollbackImageVerified: false } };
const action = { id: "action-1", toolName: "trigger_aws_deploy", status: "executed", argsJson: { repositoryFullName: "owner/repo", environmentId: "env-1" }, resultJson: { dispatched: true, execution, secret: "never-render-this" } };
beforeEach(() => { mock.client.config = { sessionToken: "paired" }; vi.resetAllMocks(); });
afterEach(cleanup);
it("restores a persisted queued receipt without claiming ECS completion or polling", () => {
  render(createElement(AgentRestartReceipts, { conversationId: "conversation-1", actions: [action] }));
  expect(screen.getByText(/GitHub workflow: queued/)).toBeTruthy(); expect(screen.getByText(/application health.*remain unverified/)).toBeTruthy();
  expect(screen.queryByText(/never-render-this/)).toBeNull(); expect(mock.client.observeDeploymentExecution).not.toHaveBeenCalled();
});
it("manually reads the canonical receipt and keeps workflow success distinct from health", async () => {
  mock.client.observeDeploymentExecution.mockResolvedValue({ ok: true, data: { ...execution, status: "completed", conclusion: "success" } });
  render(createElement(AgentRestartReceipts, { conversationId: "conversation-1", actions: [action] }));
  fireEvent.click(screen.getByRole("button", { name: "Refresh workflow receipt" }));
  await screen.findByText(/GitHub workflow: completed · success/); expect(mock.client.observeDeploymentExecution).toHaveBeenCalledExactlyOnceWith("receipt-1");
  expect(screen.getByText(/application health.*remain unverified/)).toBeTruthy();
});
it("refuses a receipt from another environment instead of rendering raw results", () => {
  render(createElement(AgentRestartReceipts, { conversationId: "conversation-1", actions: [{ ...action, resultJson: { execution: { ...execution, environmentId: "foreign" } } }] }));
  expect(screen.getByText(/Workflow receipt unavailable/)).toBeTruthy(); expect(screen.queryByRole("button", { name: "Refresh workflow receipt" })).toBeNull();
});
it("keeps the recorded receipt on a failed observation", async () => {
  mock.client.observeDeploymentExecution.mockResolvedValue({ ok: false, error: "not_authorized" });
  render(createElement(AgentRestartReceipts, { conversationId: "conversation-1", actions: [action] })); fireEvent.click(screen.getByRole("button", { name: "Refresh workflow receipt" }));
  await screen.findByRole("alert"); expect(screen.getByText(/GitHub workflow: queued/)).toBeTruthy();
});
it("drops a late result after conversation switch or credential change", async () => {
  let resolve!: (value: unknown) => void; mock.client.observeDeploymentExecution.mockReturnValue(new Promise(done => { resolve = done; }));
  const view = render(createElement(AgentRestartReceipts, { conversationId: "conversation-1", actions: [action] })); fireEvent.click(screen.getByRole("button", { name: "Refresh workflow receipt" }));
  view.rerender(createElement(AgentRestartReceipts, { conversationId: "conversation-2", actions: [] })); await act(async () => { resolve({ ok: true, data: { ...execution, status: "completed", conclusion: "success" } }); });
  expect(screen.queryByText(/GitHub workflow: completed/)).toBeNull();
  view.rerender(createElement(AgentRestartReceipts, { conversationId: "conversation-2", actions: [action] }));
  mock.client.config = { sessionToken: "changed" }; view.rerender(createElement(AgentRestartReceipts, { conversationId: "conversation-2", actions: [action] }));
  expect(screen.queryByText(/GitHub workflow:/)).toBeNull();
});
