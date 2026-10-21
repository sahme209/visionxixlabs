/** @vitest-environment jsdom */
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mock = vi.hoisted(() => ({ revision: 0, listeners: new Set<() => void>(), review: vi.fn(), approve: vi.fn(), reject: vi.fn(), connection: vi.fn(), automations: vi.fn(), repositories: vi.fn(), environments: vi.fn(), dags: vi.fn(), runs: vi.fn() }));
// Presentation shell alone depends on native notification plumbing; retain the
// actual Airflow view, client calls, review card, buttons and state transitions.
vi.mock("../../../desktop/src/components/Primitives", () => ({ ViewShell: ({ children }: { children: ReactNode }) => createElement("div", null, children) }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: {
  getContextRevision: () => mock.revision,
  subscribeContext: (listener: () => void) => { mock.listeners.add(listener); return () => mock.listeners.delete(listener); },
  getAirflowExecutionReview: mock.review, approveAirflowExecution: mock.approve, rejectAirflowExecution: mock.reject,
  airflowConnection: mock.connection, listAirflowAutomations: mock.automations,
  listGithubRepositories: mock.repositories, listEnvironments: mock.environments,
  listAirflowDags: mock.dags, listAirflowDagRuns: mock.runs,
} }));
import { AirflowRestartReviewCard } from "../../../desktop/src/components/AirflowRestartReviewCard";
import { AirflowAutomationView } from "../../../desktop/src/views/AirflowAutomationView";
const data = { executionId: "execution", digest: "a".repeat(64), requestedOperation: "service_restart", source: { dagId: "dag", runId: "run-1", state: "success" }, repositoryFullName: "fixture/repo", sourceRef: "main", dependencyPolicy: "latest_run_freshness", target: { kind: "ecs_restart_target", provider: "aws", organizationId: "org", environmentId: "env-1", environmentTier: "prod", targetId: "target-1", targetUpdatedAt: "2026-10-16T00:00:00Z", roleArn: "arn:aws:iam::123456789012:role/restart", region: "us-east-1", ecsCluster: "cluster-A", ecsService: "service-A" } };
const onRun = vi.fn(async (work: () => Promise<unknown>) => { await work(); });
const props = { executionId: "execution", busy: false, onRun };
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; }
beforeEach(() => { vi.resetAllMocks(); mock.revision = 0; mock.listeners.clear(); mock.review.mockResolvedValue({ ok: true, data }); mock.approve.mockResolvedValue({ ok: true }); mock.reject.mockResolvedValue({ ok: true });
  mock.dags.mockResolvedValue({ ok: true, data: { dags: [{ dagId: "batch-dag", displayName: "Batch DAG", paused: false }] } }); mock.runs.mockResolvedValue({ ok: true, data: { runs: [] } });
  mock.repositories.mockResolvedValue({ ok: true, data: { repositories: [] } }); mock.environments.mockResolvedValue({ ok: true, data: { environments: [] } });
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

it.each(["repositories", "environments"] as const)("shows available approvals while the independent %s catalog is pending", async (catalog) => {
  const pending = deferred(); mock[catalog].mockReturnValue(pending.promise);
  render(createElement(AirflowAutomationView));
  await screen.findByText("Connect Airflow first");
  fireEvent.click(screen.getByRole("button", { name: "approvals" }));
  await screen.findByText("Synthetic restart");
  expect(mock.approve).not.toHaveBeenCalled();
  await act(async () => pending.resolve({ ok: true, data: catalog === "repositories" ? { repositories: [] } : { environments: [] } }));
});

it("loads connected DAGs while approval history is delayed", async () => {
  const pending = deferred(); mock.automations.mockReturnValue(pending.promise);
  mock.connection.mockResolvedValue({ ok: true, data: { connected: true, status: "connected" } });
  render(createElement(AirflowAutomationView));
  await screen.findByRole("option", { name: "Batch DAG" });
  expect((screen.getByRole("button", { name: "Run now" }) as HTMLButtonElement).disabled).toBe(false);
  await act(async () => pending.resolve({ ok: true, data: { automations: [], executions: [] } }));
});
it("contains an unexpected catalog rejection without hiding available approval evidence", async () => {
  mock.repositories.mockRejectedValue(new Error("private transport detail"));
  render(createElement(AirflowAutomationView));
  await screen.findByText(/Some Airflow workspace data could not be loaded/);
  fireEvent.click(screen.getByRole("button", { name: "approvals" }));
  await screen.findByText("Synthetic restart");
  expect(screen.queryByText("private transport detail")).toBeNull();
  expect(mock.approve).not.toHaveBeenCalled();
});

it("never displays the previous DAG's runs while a newly selected DAG is loading", async () => {
  const pending = deferred();
  mock.connection.mockResolvedValue({ ok: true, data: { connected: true, status: "connected" } });
  mock.dags.mockResolvedValue({ ok: true, data: { dags: [{ dagId: "a", displayName: "DAG A" }, { dagId: "b", displayName: "DAG B" }] } });
  mock.runs.mockResolvedValueOnce({ ok: true, data: { runs: [{ dagRunId: "run-A", state: "success" }] } }).mockReturnValueOnce(pending.promise);
  render(createElement(AirflowAutomationView)); await screen.findByText("run-A");
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "b" } });
  expect(screen.queryByText("run-A")).toBeNull();
  await act(async () => pending.resolve({ ok: true, data: { runs: [{ dagRunId: "run-B", state: "running" }] } }));
  await screen.findByText("run-B");
});
it("ignores a manual run-history refresh returned after the DAG selection changes", async () => {
  const pending = deferred();
  mock.connection.mockResolvedValue({ ok: true, data: { connected: true, status: "connected" } });
  mock.dags.mockResolvedValue({ ok: true, data: { dags: [{ dagId: "a", displayName: "DAG A" }, { dagId: "b", displayName: "DAG B" }] } });
  mock.runs.mockResolvedValueOnce({ ok: true, data: { runs: [{ dagRunId: "run-A", state: "success" }] } }).mockReturnValueOnce(pending.promise).mockResolvedValueOnce({ ok: true, data: { runs: [{ dagRunId: "run-B", state: "running" }] } });
  render(createElement(AirflowAutomationView)); await screen.findByText("run-A");
  fireEvent.click(screen.getByRole("button", { name: "Refresh run history" }));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "b" } });
  await screen.findByText("run-B");
  await act(async () => pending.resolve({ ok: true, data: { runs: [{ dagRunId: "old-refresh-A", state: "success" }] } }));
  expect(screen.queryByText("old-refresh-A")).toBeNull(); expect(screen.getByText("run-B")).toBeTruthy();
});

it("releases action busy state after Airflow refresh even when a repository catalog stays pending", async () => {
  mock.repositories.mockReturnValue(deferred().promise);
  render(createElement(AirflowAutomationView));
  fireEvent.click(screen.getByRole("button", { name: "approvals" }));
  await screen.findByText("Synthetic restart");
  fireEvent.click(screen.getByRole("button", { name: "Reject" }));
  await screen.findByText("Action rejected and recorded.");
  await waitFor(() => expect((screen.getByRole("button", { name: "Reject" }) as HTMLButtonElement).disabled).toBe(false));
});
it("does not replace newer DAG catalogs with an older workspace load", async () => {
  const pending = deferred();
  mock.connection.mockResolvedValue({ ok: true, data: { connected: true, status: "connected" } });
  mock.dags.mockReturnValueOnce(pending.promise).mockResolvedValue({ ok: true, data: { dags: [{ dagId: "new-dag", displayName: "Current DAG" }] } });
  render(createElement(AirflowAutomationView));
  fireEvent.click(screen.getByRole("button", { name: "approvals" }));
  await screen.findByText("Synthetic restart");
  fireEvent.click(screen.getByRole("button", { name: "Reject" }));
  await screen.findByText("Action rejected and recorded.");
  fireEvent.click(screen.getByRole("button", { name: "dags" }));
  await screen.findByRole("option", { name: "Current DAG" });
  await act(async () => pending.resolve({ ok: true, data: { dags: [{ dagId: "old-dag", displayName: "Obsolete DAG" }] } }));
  expect(screen.queryByRole("option", { name: "Obsolete DAG" })).toBeNull();
  expect(screen.getByRole("option", { name: "Current DAG" })).toBeTruthy();
});
