/** @vitest-environment jsdom */
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mock = vi.hoisted(() => ({ revision: 0, listeners: new Set<() => void>(), review: vi.fn(), approve: vi.fn(), reject: vi.fn(), connection: vi.fn(), automations: vi.fn(), repositories: vi.fn(), environments: vi.fn(), dags: vi.fn(), runs: vi.fn(), branches: vi.fn(), create: vi.fn(), trigger: vi.fn(), saveConnection: vi.fn() }));
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
  listGithubBranches: mock.branches, createAirflowAutomation: mock.create, triggerAirflowDag: mock.trigger, saveAirflowConnection: mock.saveConnection,
} }));
import { AirflowRestartReviewCard } from "../../../desktop/src/components/AirflowRestartReviewCard";
import { AirflowAutomationView } from "../../../desktop/src/views/AirflowAutomationView";
const data = { executionId: "execution", digest: "a".repeat(64), requestedOperation: "service_restart", source: { dagId: "dag", runId: "run-1", state: "success" }, repositoryFullName: "fixture/repo", sourceRef: "main", dependencyPolicy: "latest_run_freshness", target: { kind: "ecs_restart_target", provider: "aws", organizationId: "org", environmentId: "env-1", environmentTier: "prod", targetId: "target-1", targetUpdatedAt: "2026-10-16T00:00:00Z", roleArn: "arn:aws:iam::123456789012:role/restart", region: "us-east-1", ecsCluster: "cluster-A", ecsService: "service-A" } };
const onRun = vi.fn(async (work: () => Promise<unknown>) => { await work(); });
const props = { executionId: "execution", busy: false, onRun };
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; }
beforeEach(() => { vi.resetAllMocks(); mock.revision = 0; mock.listeners.clear(); mock.review.mockResolvedValue({ ok: true, data }); mock.approve.mockResolvedValue({ ok: true }); mock.reject.mockResolvedValue({ ok: true });
  mock.branches.mockResolvedValue({ ok: true, data: { branches: [{ name: "main", protected: true }] } }); mock.create.mockResolvedValue({ ok: true });
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
  fireEvent.click(screen.getByRole("button", { name: "Workflows" }));
  await screen.findByRole("option", { name: "Current DAG" });
  await act(async () => pending.resolve({ ok: true, data: { dags: [{ dagId: "old-dag", displayName: "Obsolete DAG" }] } }));
  expect(screen.queryByRole("option", { name: "Obsolete DAG" })).toBeNull();
  expect(screen.getByRole("option", { name: "Current DAG" })).toBeTruthy();
});

it("holds GitHub automation creation until the selected source branch is verified", async () => {
  const pending = deferred(); mock.branches.mockReturnValue(pending.promise);
  mock.connection.mockResolvedValue({ ok: true, data: { connected: true, status: "connected" } });
  mock.repositories.mockResolvedValue({ ok: true, data: { repositories: [{ fullName: "fixture/repo", defaultBranch: "main" }] } });
  render(createElement(AirflowAutomationView)); await screen.findByRole("option", { name: "Batch DAG" });
  fireEvent.click(screen.getByRole("button", { name: "automations" }));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Reviewed batch" } });
  fireEvent.change(screen.getByLabelText("Then"), { target: { value: "open_pull_request" } });
  expect((screen.getByRole("button", { name: "Create automation" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => pending.resolve({ ok: true, data: { branches: [{ name: "main", protected: true }] } }));
  fireEvent.click(screen.getByRole("button", { name: "Create automation" }));
  await waitFor(() => expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({ repositoryFullName: "fixture/repo", sourceRef: "main", approvalRequired: true })));
});
it("does not treat a failed branch lookup as a verified default branch", async () => {
  mock.branches.mockResolvedValue({ ok: false, error: "github_unavailable" });
  mock.connection.mockResolvedValue({ ok: true, data: { connected: true, status: "connected" } });
  mock.repositories.mockResolvedValue({ ok: true, data: { repositories: [{ fullName: "fixture/repo", defaultBranch: "main" }] } });
  render(createElement(AirflowAutomationView)); await screen.findByRole("option", { name: "Batch DAG" });
  fireEvent.click(screen.getByRole("button", { name: "automations" }));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Reviewed batch" } });
  fireEvent.change(screen.getByLabelText("Then"), { target: { value: "open_pull_request" } });
  await screen.findByText(/Source branches could not be verified/);
  expect((screen.getByRole("button", { name: "Create automation" }) as HTMLButtonElement).disabled).toBe(true);
  expect(mock.create).not.toHaveBeenCalled();
  mock.branches.mockResolvedValue({ ok: true, data: { branches: [{ name: "main", protected: true }] } });
  fireEvent.click(screen.getByRole("button", { name: "Retry source branches" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "Create automation" }) as HTMLButtonElement).disabled).toBe(false));
  expect(mock.create).not.toHaveBeenCalled();
});
it("makes a late repository catalog an explicit choice instead of a misleading selected first option", async () => {
  const pending = deferred(); mock.repositories.mockReturnValue(pending.promise);
  mock.connection.mockResolvedValue({ ok: true, data: { connected: true, status: "connected" } });
  render(createElement(AirflowAutomationView)); await screen.findByRole("option", { name: "Batch DAG" });
  fireEvent.click(screen.getByRole("button", { name: "automations" }));
  fireEvent.change(screen.getByLabelText("Then"), { target: { value: "open_pull_request" } });
  await act(async () => pending.resolve({ ok: true, data: { repositories: [{ fullName: "fixture/repo", defaultBranch: "main" }] } }));
  expect((screen.getByLabelText("Repository") as HTMLSelectElement).value).toBe("");
  fireEvent.change(screen.getByLabelText("Repository"), { target: { value: "fixture/repo" } });
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Reviewed batch" } });
  await waitFor(() => expect((screen.getByRole("button", { name: "Create automation" }) as HTMLButtonElement).disabled).toBe(false));
});

it("keeps a late branch response from changing the newly selected repository's proposal", async () => {
  const old = deferred();
  mock.connection.mockResolvedValue({ ok: true, data: { connected: true, status: "connected" } });
  mock.repositories.mockResolvedValue({ ok: true, data: { repositories: [{ fullName: "fixture/old", defaultBranch: "main" }, { fullName: "fixture/current", defaultBranch: "release" }] } });
  mock.branches.mockReturnValueOnce(old.promise).mockResolvedValue({ ok: true, data: { branches: [{ name: "release", protected: true }] } });
  render(createElement(AirflowAutomationView)); await screen.findByRole("option", { name: "Batch DAG" });
  fireEvent.click(screen.getByRole("button", { name: "automations" }));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Reviewed batch" } });
  fireEvent.change(screen.getByLabelText("Then"), { target: { value: "open_pull_request" } });
  fireEvent.change(screen.getByLabelText("Repository"), { target: { value: "fixture/current" } });
  await screen.findByRole("option", { name: "release · protected" });
  await act(async () => old.resolve({ ok: true, data: { branches: [{ name: "main", protected: false }] } }));
  expect((screen.getByLabelText("Source branch") as HTMLSelectElement).value).toBe("release");
  fireEvent.click(screen.getByRole("button", { name: "Create automation" }));
  await waitFor(() => expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({ repositoryFullName: "fixture/current", sourceRef: "release", approvalRequired: true })));
});
it("disables another restart proposal when its environment disappears from refreshed catalogs", async () => {
  mock.connection.mockResolvedValue({ ok: true, data: { connected: true, status: "connected" } });
  mock.repositories.mockResolvedValue({ ok: true, data: { repositories: [{ fullName: "fixture/repo", defaultBranch: "main" }] } });
  mock.environments.mockResolvedValue({ ok: true, data: { environments: [{ id: "dev", name: "Development", tier: "dev" }] } });
  render(createElement(AirflowAutomationView)); await screen.findByRole("option", { name: "Batch DAG" });
  fireEvent.click(screen.getByRole("button", { name: "automations" }));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Reviewed batch" } });
  fireEvent.change(screen.getByLabelText("Then"), { target: { value: "deploy" } });
  await waitFor(() => expect((screen.getByRole("button", { name: "Create automation" }) as HTMLButtonElement).disabled).toBe(false));
  mock.environments.mockResolvedValue({ ok: true, data: { environments: [] } });
  fireEvent.click(screen.getByRole("button", { name: "Create automation" }));
  await waitFor(() => expect(screen.queryByRole("option", { name: "Development · dev" })).toBeNull());
  expect((screen.getByLabelText("Target environment") as HTMLSelectElement).value).toBe("");
  expect((screen.getByRole("button", { name: "Create automation" }) as HTMLButtonElement).disabled).toBe(true);
  expect(mock.create).toHaveBeenCalledTimes(1);
});

it("refuses running or refreshing history for a DAG removed by the refreshed catalog", async () => {
  mock.connection.mockResolvedValue({ ok: true, data: { connected: true, status: "connected" } });
  mock.runs.mockResolvedValue({ ok: true, data: { runs: [{ dagRunId: "old-run", state: "success" }] } });
  render(createElement(AirflowAutomationView)); await screen.findByText("old-run");
  fireEvent.click(screen.getByRole("button", { name: "approvals" }));
  await screen.findByText("Synthetic restart");
  mock.dags.mockResolvedValue({ ok: true, data: { dags: [] } });
  fireEvent.click(screen.getByRole("button", { name: "Reject" }));
  await screen.findByText("Action rejected and recorded.");
  fireEvent.click(screen.getByRole("button", { name: "Workflows" }));
  await waitFor(() => expect(screen.queryByRole("option", { name: "Batch DAG" })).toBeNull());
  expect((screen.getByRole("button", { name: "Run now" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText("old-run")).toBeNull();
  const reads = mock.runs.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Run now" }));
  fireEvent.click(screen.getByRole("button", { name: "Refresh run history" }));
  await act(async () => {});
  expect(mock.trigger).not.toHaveBeenCalled(); expect(mock.runs).toHaveBeenCalledTimes(reads);
});

it.each(["password", "token"] as const)("clears the submitted %s after a confirmed connection save", async (mode) => {
  mock.saveConnection.mockResolvedValue({ ok: true });
  render(createElement(AirflowAutomationView));
  fireEvent.click(screen.getByRole("button", { name: "connection" }));
  await screen.findByText("Secure Airflow connection");
  if (mode === "token") fireEvent.change(screen.getByLabelText("Authentication"), { target: { value: "token" } });
  fireEvent.change(screen.getByLabelText("Airflow HTTPS origin"), {target:{value:"https://airflow.example.com"}});
  if (screen.queryByLabelText("Username")) fireEvent.change(screen.getByLabelText("Username"), {target:{value:"fixture"}});
  const field = screen.getByLabelText(mode === "token" ? "Bearer token" : "Password") as HTMLInputElement;
  fireEvent.change(field, { target: { value: "synthetic-only-secret" } });
  fireEvent.click(screen.getByRole("button", { name: "Validate & connect" }));
  await screen.findByText("Airflow connection validated and saved.");
  expect(field.value).toBe("");
});
it("retains a corrected credential typed while an older connection save is pending", async () => {
  const pending = deferred(); mock.saveConnection.mockReturnValue(pending.promise);
  render(createElement(AirflowAutomationView)); fireEvent.click(screen.getByRole("button", { name: "connection" }));
  await screen.findByText("Secure Airflow connection");
  fireEvent.change(screen.getByLabelText("Airflow HTTPS origin"), {target:{value:"https://airflow.example.com"}});
  if (screen.queryByLabelText("Username")) fireEvent.change(screen.getByLabelText("Username"), {target:{value:"fixture"}});
  const field = screen.getByLabelText("Password") as HTMLInputElement;
  fireEvent.change(field, { target: { value: "synthetic-old" } });
  fireEvent.click(screen.getByRole("button", { name: "Validate & connect" }));
  fireEvent.change(field, { target: { value: "synthetic-corrected" } });
  await act(async () => pending.resolve({ ok: true }));
  expect(field.value).toBe("synthetic-corrected");
});
it("retains the editable credential when connection validation fails without replaying the save", async () => {
  mock.saveConnection.mockResolvedValue({ ok: false, error: "connection_validation_failed" });
  render(createElement(AirflowAutomationView)); fireEvent.click(screen.getByRole("button", { name: "connection" }));
  await screen.findByText("Secure Airflow connection");
  fireEvent.change(screen.getByLabelText("Airflow HTTPS origin"), {target:{value:"https://airflow.example.com"}});
  if (screen.queryByLabelText("Username")) fireEvent.change(screen.getByLabelText("Username"), {target:{value:"fixture"}});
  const field = screen.getByLabelText("Password") as HTMLInputElement;
  fireEvent.change(field, { target: { value: "synthetic-correctable" } });
  fireEvent.click(screen.getByRole("button", { name: "Validate & connect" }));
  await screen.findByText("The Airflow connection could not be validated. Check the endpoint and credentials, then try again.");
  expect(field.value).toBe("synthetic-correctable"); expect(mock.saveConnection).toHaveBeenCalledTimes(1);
});


it.each(["http", "network"])("does not mislabel an unavailable %s connection lookup as a disconnected workspace", async failure => {
  if (failure === "http") mock.connection.mockResolvedValueOnce({ok:false,error:"airflow_storage_unavailable"});
  else mock.connection.mockRejectedValueOnce(new Error("private upstream failure"));
  render(createElement(AirflowAutomationView));
  await screen.findByText("Airflow connection status unavailable");
  expect(screen.queryByText("Connect Airflow first")).toBeNull();
  expect(mock.saveConnection).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Retry connection status"}));
  await screen.findByText("Connect Airflow first");
  fireEvent.click(screen.getByRole("button",{name:"Open connection setup"}));
  await screen.findByText("Secure Airflow connection");
  expect(mock.saveConnection).not.toHaveBeenCalled();
  expect(mock.trigger).not.toHaveBeenCalled();
});
it("keeps pending connection discovery distinct from not connected", async () => {
  const pending=deferred();mock.connection.mockReturnValueOnce(pending.promise);
  render(createElement(AirflowAutomationView));
  await screen.findByText("Checking Airflow connection…");
  expect(screen.queryByText("Connect Airflow first")).toBeNull();
  await act(async()=>pending.resolve({ok:true,data:{connected:false,status:"disconnected"}}));
  await screen.findByText("Connect Airflow first");
});

it.each(["http", "network"])("invalidates the DAG catalog after a failed %s refresh instead of keeping a runnable stale DAG", async failure => {
  mock.connection.mockResolvedValue({ok:true,data:{connected:true,status:"connected"}});
  render(createElement(AirflowAutomationView)); await screen.findByRole("option",{name:"Batch DAG"});
  if(failure === "http") mock.dags.mockResolvedValue({ok:false,error:"private-provider-diagnostic"});
  else mock.dags.mockRejectedValue(new Error("private-provider-diagnostic"));
  fireEvent.click(screen.getByRole("button",{name:"Refresh Airflow workspace"}));
  await screen.findByText(/DAG catalog could not be verified/);
  expect(screen.queryByRole("option",{name:"Batch DAG"})).toBeNull();
  expect((screen.getByRole("button",{name:"Run now"})as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText("private-provider-diagnostic")).toBeNull();
});
it("distinguishes an unavailable approval read from an empty approval queue and does not retain approval buttons",async()=>{
  render(createElement(AirflowAutomationView)); await screen.findByText("Connect Airflow first");
  fireEvent.click(screen.getByRole("button",{name:"approvals"})); await screen.findByText("Synthetic restart");
  mock.automations.mockResolvedValue({ok:false,error:"private-history-diagnostic"});
  fireEvent.click(screen.getByRole("button",{name:"Refresh Airflow workspace"}));
  await screen.findByText(/Automation history could not be verified/);
  expect(screen.queryByText("No actions are waiting for approval.")).toBeNull();
  expect(screen.queryByRole("button",{name:"Approve service restart"})).toBeNull();
});
it("labels failed run history and refreshes real history after one reviewed manual run",async()=>{
  mock.connection.mockResolvedValue({ok:true,data:{connected:true,status:"connected"}});
  mock.runs.mockResolvedValueOnce({ok:false,error:"upstream-secret"}).mockResolvedValue({ok:true,data:{runs:[{dagRunId:"fresh-run",state:"queued"}]}});
  mock.trigger.mockResolvedValue({ok:true});
  render(createElement(AirflowAutomationView)); await screen.findByText(/Run history could not be verified/);
  fireEvent.click(screen.getByRole("button",{name:"Run now"}));
  expect(mock.trigger).not.toHaveBeenCalled();
  expect(screen.getByRole("alertdialog",{name:"Run Airflow DAG"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Confirm DAG run"}));
  await screen.findByText("fresh-run");
  expect(mock.trigger).toHaveBeenCalledExactlyOnceWith("batch-dag");
  expect(screen.queryByText("upstream-secret")).toBeNull();
});
it("keeps incomplete or non-HTTPS connection forms from submitting credentials",async()=>{
 render(createElement(AirflowAutomationView)); fireEvent.click(screen.getByRole("button",{name:"connection"}));await screen.findByText("Secure Airflow connection");
 const connect=screen.getByRole("button",{name:"Validate & connect"})as HTMLButtonElement;expect(connect.disabled).toBe(true);
 fireEvent.change(screen.getByLabelText("Airflow HTTPS origin"),{target:{value:"http://airflow.example.com"}});
 fireEvent.change(screen.getByLabelText("Username"),{target:{value:"fixture"}});fireEvent.change(screen.getByLabelText("Password"),{target:{value:"synthetic"}});
 expect(connect.disabled).toBe(true);fireEvent.change(screen.getByLabelText("Airflow HTTPS origin"),{target:{value:"https://airflow.example.com"}});expect(connect.disabled).toBe(false);
 fireEvent.change(screen.getByLabelText("Authentication"),{target:{value:"token"}});expect(connect.disabled).toBe(true);
 expect(mock.saveConnection).not.toHaveBeenCalled();
});
it("watches run state only after opt-in and stops polling on tab change or unmount",async()=>{
 mock.connection.mockResolvedValue({ok:true,data:{connected:true,status:"connected"}});
 const view=render(createElement(AirflowAutomationView));await screen.findByText("No runs returned.");
 const visibility=vi.spyOn(document,"visibilityState","get").mockReturnValue("visible");
 vi.useFakeTimers();
 try {
  const before=mock.runs.mock.calls.length;
  await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});expect(mock.runs).toHaveBeenCalledTimes(before);
  fireEvent.click(screen.getByRole("button",{name:"Auto-refresh runs"}));
  await act(async()=>{await vi.advanceTimersByTimeAsync(15000);});expect(mock.runs).toHaveBeenCalledTimes(before+1);
  fireEvent.click(screen.getByRole("button",{name:"automations"}));
  await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});expect(mock.runs).toHaveBeenCalledTimes(before+1);
  view.unmount();await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});expect(mock.runs).toHaveBeenCalledTimes(before+1);
  expect(mock.trigger).not.toHaveBeenCalled();expect(mock.create).not.toHaveBeenCalled();
 } finally {vi.useRealTimers();visibility.mockRestore();}
});
it("does not refresh an abandoned view after a submitted action settles",async()=>{
 const pending=deferred();mock.reject.mockReturnValue(pending.promise);
 const view=render(createElement(AirflowAutomationView));await screen.findByText("Connect Airflow first");fireEvent.click(screen.getByRole("button",{name:"approvals"}));await screen.findByText("Synthetic restart");
 fireEvent.click(screen.getByRole("button",{name:"Reject"}));const reads=mock.connection.mock.calls.length;view.unmount();
 await act(async()=>pending.resolve({ok:true}));expect(mock.connection).toHaveBeenCalledTimes(reads);expect(mock.reject).toHaveBeenCalledTimes(1);
});
it("retains an automation draft through pending, failed and recovered catalog refreshes while holding submission",async()=>{
 mock.connection.mockResolvedValue({ok:true,data:{connected:true,status:"connected"}});
 render(createElement(AirflowAutomationView));await screen.findByRole('option',{name:'Batch DAG'});fireEvent.click(screen.getByRole('button',{name:'automations'}));
 fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Preserve this rule draft'}});
 const pending=deferred();mock.dags.mockReturnValueOnce(pending.promise);
 fireEvent.click(screen.getByRole('button',{name:'Refresh Airflow workspace'}));
 expect((screen.getByLabelText('Name')as HTMLInputElement).value).toBe('Preserve this rule draft');
 expect((screen.getByRole('button',{name:'Create automation'})as HTMLButtonElement).disabled).toBe(true);
 await act(async()=>pending.resolve({ok:false,error:'provider_unavailable'}));await screen.findByText(/DAG catalog could not be verified/);
 expect((screen.getByLabelText('Name')as HTMLInputElement).value).toBe('Preserve this rule draft');
 fireEvent.click(screen.getByRole('button',{name:'Refresh Airflow workspace'}));await screen.findByRole('option',{name:'Batch DAG'});
 expect((screen.getByLabelText('Name')as HTMLInputElement).value).toBe('Preserve this rule draft');expect(mock.create).not.toHaveBeenCalled();
});
it("returns keyboard focus to Run now after canceling its review",async()=>{
 mock.connection.mockResolvedValue({ok:true,data:{connected:true,status:'connected'}});render(createElement(AirflowAutomationView));await screen.findByRole('option',{name:'Batch DAG'});
 const opener=screen.getByRole('button',{name:'Run now'});opener.focus();fireEvent.click(opener);fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(document.activeElement).toBe(opener);expect(mock.trigger).not.toHaveBeenCalled();
});

it("keeps unknown provider errors private and never treats an uncertain run as safe to retry",async()=>{
 mock.connection.mockResolvedValue({ok:true,data:{connected:true,status:"active"}});mock.trigger.mockResolvedValue({ok:false,error:"private-provider-host-and-diagnostic"});
 render(createElement(AirflowAutomationView));await screen.findByText("No runs returned.");fireEvent.click(screen.getByRole("button",{name:"Run now"}));fireEvent.click(screen.getByRole("button",{name:"Confirm DAG run"}));
 await screen.findByText("The action's outcome could not be confirmed. Refresh and review its history before retrying.");expect(screen.queryByText("private-provider-host-and-diagnostic")).toBeNull();expect(mock.trigger).toHaveBeenCalledTimes(1);
});
