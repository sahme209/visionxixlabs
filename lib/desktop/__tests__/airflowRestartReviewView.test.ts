/** @vitest-environment jsdom */
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
const mock = vi.hoisted(() => ({ revision: 0, listeners: new Set<() => void>(), review: vi.fn(), approve: vi.fn(), reject: vi.fn(), connection: vi.fn(), automations: vi.fn() }));
// Presentation shell alone depends on native notification plumbing; retain the
// actual Airflow view, client calls, review card, buttons and state transitions.
vi.mock("../../../desktop/src/components/Primitives", () => ({ ViewShell: ({ children }: { children: ReactNode }) => createElement("div", null, children) }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: {
  getContextRevision: () => mock.revision,
  subscribeContext: (listener: () => void) => { mock.listeners.add(listener); return () => mock.listeners.delete(listener); },
  getAirflowExecutionReview: mock.review, approveAirflowExecution: mock.approve, rejectAirflowExecution: mock.reject,
  airflowConnection: mock.connection, listAirflowAutomations: mock.automations,
  listGithubRepositories: async () => ({ ok: true, data: { repositories: [] } }), listEnvironments: async () => ({ ok: true, data: { environments: [] } }),
} }));
import { AirflowRestartReviewCard } from "../../../desktop/src/components/AirflowRestartReviewCard";
import { AirflowAutomationView } from "../../../desktop/src/views/AirflowAutomationView";
const data = { executionId: "execution", digest: "a".repeat(64), requestedOperation: "service_restart", source: { dagId: "dag", runId: "run-1", state: "success" }, repositoryFullName: "fixture/repo", sourceRef: "main", dependencyPolicy: "latest_run_freshness", target: { kind: "ecs_restart_target", provider: "aws", organizationId: "org", environmentId: "env-1", environmentTier: "prod", targetId: "target-1", targetUpdatedAt: "2026-10-16T00:00:00Z", roleArn: "arn:aws:iam::123456789012:role/restart", region: "us-east-1", ecsCluster: "cluster-A", ecsService: "service-A" } };
const onRun = vi.fn(async (work: () => Promise<unknown>) => { await work(); });
const props = { executionId: "execution", busy: false, onRun };
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; }
beforeEach(() => { vi.resetAllMocks(); mock.revision = 0; mock.listeners.clear(); mock.review.mockResolvedValue({ ok: true, data }); mock.approve.mockResolvedValue({ ok: true }); mock.reject.mockResolvedValue({ ok: true });
  mock.connection.mockResolvedValue({ ok: true, data: { connected: false, status: "disconnected" } });
  mock.automations.mockResolvedValue({ ok: true, data: { automations: [{ id: "rule", name: "Synthetic restart", actionType: "deploy" }], executions: [{ id: "execution", automationId: "rule", sourceDagId: "dag", sourceDagRunId: "run-1", sourceDagState: "success", status: "pending_approval" }] } });
});
afterEach(cleanup);
it("requires an explicit exact destination read and submits its digest", async () => {
  render(createElement(AirflowRestartReviewCard, props));
  expect(mock.review).not.toHaveBeenCalled(); expect((screen.getByRole("button", { name: "Approve service restart" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Review restart destination" }));
  await screen.findByText("service-A"); expect(screen.getByText(data.target.roleArn)).toBeTruthy(); expect(screen.getByText(/latest-run freshness/)).toBeTruthy();
  expect(screen.getByText(/does not promote a source release/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Approve service restart" }));
  expect(mock.approve).toHaveBeenCalledWith("execution", data.digest);
});
it("keeps rejection available when historical review storage is unavailable", async () => {
  mock.review.mockResolvedValue({ ok: false, error: "airflow_review_required" }); render(createElement(AirflowRestartReviewCard, props));
  fireEvent.click(screen.getByRole("button", { name: "Review restart destination" }));
  expect((await screen.findByRole("alert")).textContent).toContain("new scheduler proposal");
  expect((screen.getByRole("button", { name: "Approve service restart" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reject" })); expect(mock.reject).toHaveBeenCalledWith("execution");
});
it("hides a displayed destination synchronously on credential or API-base revision", async () => {
  render(createElement(AirflowRestartReviewCard, props)); fireEvent.click(screen.getByRole("button", { name: "Review restart destination" })); await screen.findByText("service-A");
  act(() => { mock.revision++; mock.listeners.forEach(listener => listener()); });
  expect(screen.queryByText("service-A")).toBeNull(); expect((screen.getByRole("button", { name: "Approve service restart" }) as HTMLButtonElement).disabled).toBe(true);
});
it("ignores a review returned after context replacement", async () => {
  const pending = deferred(); mock.review.mockReturnValue(pending.promise); render(createElement(AirflowRestartReviewCard, props)); fireEvent.click(screen.getByRole("button", { name: "Review restart destination" }));
  await act(async () => { mock.revision++; mock.listeners.forEach(listener => listener()); pending.resolve({ ok: true, data }); });
  expect(screen.queryByText("service-A")).toBeNull(); expect(mock.approve).not.toHaveBeenCalled();
});
it("ignores a review after selection changes and rejects mismatched execution evidence", async () => {
  const pending = deferred(); mock.review.mockReturnValueOnce(pending.promise); const view = render(createElement(AirflowRestartReviewCard, props)); fireEvent.click(screen.getByRole("button", { name: "Review restart destination" }));
  view.rerender(createElement(AirflowRestartReviewCard, { ...props, executionId: "other" }));
  await act(async () => pending.resolve({ ok: true, data })); expect(screen.queryByText("service-A")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Review restart destination" }));
  expect((await screen.findByRole("alert")).textContent).toContain("did not match"); expect(mock.approve).not.toHaveBeenCalled();
});
it("the actual Batch automation approvals panel reaches the digest-bound restart card", async () => {
  render(createElement(AirflowAutomationView)); await screen.findByText("Connect Airflow first");
  fireEvent.click(screen.getByRole("button", { name: "approvals" })); await screen.findByText("Synthetic restart");
  expect(screen.queryByRole("button", { name: "Approve & run" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Review restart destination" })); await screen.findByText("service-A");
  fireEvent.click(screen.getByRole("button", { name: "Approve service restart" })); expect(mock.approve).toHaveBeenCalledWith("execution", data.digest);
});
it("the actual view cannot reintroduce old approval rows from a late workspace load", async () => {
  const pending = deferred(); mock.automations.mockReturnValueOnce(pending.promise); mock.automations.mockResolvedValue({ ok: true, data: { automations: [], executions: [] } });
  render(createElement(AirflowAutomationView)); await screen.findByText("Connect Airflow first");
  await act(async () => { mock.revision++; mock.listeners.forEach(listener => listener()); pending.resolve({ ok: true, data: { automations: [{ id: "rule", name: "Old tenant", actionType: "deploy" }], executions: [{ id: "execution", automationId: "rule", status: "pending_approval" }] } }); });
  fireEvent.click(screen.getByRole("button", { name: "approvals" })); await screen.findByText("No actions are waiting for approval.");
  expect(screen.queryByText("Old tenant")).toBeNull(); expect(mock.review).not.toHaveBeenCalled();
});
it("the actual view ignores an approval result after its paired context changes", async () => {
  const pending = deferred(); mock.approve.mockReturnValue(pending.promise);
  render(createElement(AirflowAutomationView)); await screen.findByText("Connect Airflow first");
  fireEvent.click(screen.getByRole("button", { name: "approvals" })); await screen.findByText("Synthetic restart");
  fireEvent.click(screen.getByRole("button", { name: "Review restart destination" })); await screen.findByText("service-A");
  fireEvent.click(screen.getByRole("button", { name: "Approve service restart" }));
  mock.automations.mockResolvedValue({ ok: true, data: { automations: [], executions: [] } });
  await act(async () => { mock.revision++; mock.listeners.forEach(listener => listener()); pending.resolve({ ok: true }); });
  expect(screen.queryByText("Service restart processed. Review the recorded outcome.")).toBeNull();
  expect(screen.queryByText("service-A")).toBeNull();
});
