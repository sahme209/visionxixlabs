/** @vitest-environment jsdom */
import {createElement} from "react";
import {act, cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {afterEach, beforeEach, expect, it, vi} from "vitest";

const m = vi.hoisted(() => ({config: {apiBase: "https://desktop-fixture.example.invalid"}, revision: 1, read: vi.fn(), lookup: vi.fn(), readiness: vi.fn(), declarations: vi.fn(), monitor: vi.fn(), tasks: vi.fn(), start: vi.fn(), stop: vi.fn()}));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({
  desktopClient: {get config() {return m.config;}, getContextRevision: () => m.revision, deploymentRequests: m.read, savedDeploymentRequest: m.lookup, releaseBatchReadiness: m.readiness, releaseBatchDeclarations: m.declarations, releaseBatchTasks: m.tasks, releaseBatchWait: m.monitor, startReleaseBatchWait: m.start, cancelReleaseBatchWait: m.stop, subscribeContext: () => () => {}},
}));
vi.mock("../../../desktop/src/views/AirflowAutomationView", () => ({
  AirflowAutomationView: ({active}: {active: boolean}) => createElement("input", {"aria-label": "Airflow draft", "data-active": String(active)}),
}));
import {BatchesWorkspaceView} from "../../../desktop/src/views/BatchesWorkspaceView";

const release = {id: "fixture-release", version: 3, title: "Fixture rollout", status: "submitted",
  releaseContext: {scope: {targetEnvironment: "Staging"}, batches: {selectedRunCount: 2}}};
const load = () => fireEvent.click(screen.getByRole("button", {name: "Release dependencies"}));
const show = (canRead = true, onOpenRelease = vi.fn(), canCheckReadiness = true) => render(createElement(BatchesWorkspaceView, {
  canRead, canCheckReadiness, ownerConfig: m.config, revision: m.revision, onOpenRelease, onInspect: vi.fn(),
}));

beforeEach(() => {
  m.config = {apiBase: "https://desktop-fixture.example.invalid"};
  m.revision = 1;
  m.readiness.mockReset();
  m.declarations.mockReset().mockResolvedValue({ok: false});
  m.lookup.mockReset().mockResolvedValue({ok: true, data: null});
  m.monitor.mockReset();
  m.tasks.mockReset().mockResolvedValue({ok: true, data: {tasks: [], offset: 0, totalEntries: 0}});
  m.start.mockReset();
  m.stop.mockReset();
  m.read.mockReset().mockResolvedValue({ok: true, data: [release, {...release, id: "no-runs", title: "No selections", releaseContext: {...release.releaseContext, batches: {selectedRunCount: 0}}}]});
});
afterEach(cleanup);

it("loads only on explicit view entry and opens the exact release while retaining the Airflow editor", async () => {
  const onOpenRelease = vi.fn();
  show(true, onOpenRelease);
  const draft = screen.getByRole("textbox", {name: "Airflow draft"});
  fireEvent.change(draft, {target: {value: "Unsent automation"}});
  expect(m.read).not.toHaveBeenCalled();
  load();
  expect(await screen.findByRole("heading", {name: "Fixture rollout"})).toBeTruthy();
  expect(screen.queryByText("No selections")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Open release Fixture rollout"}));
  expect(onOpenRelease).toHaveBeenCalledExactlyOnceWith({id: "fixture-release", version: 3});
  fireEvent.click(screen.getByRole("button", {name: "Airflow automation"}));
  expect(screen.getByRole("textbox", {name: "Airflow draft"})).toBe(draft);
  expect(draft).toHaveProperty("value", "Unsent automation");
});

it.each([false, true])("revalidates the exact dependency on return from Airflow (explicit selection %s)", async explicit => {
  m.read.mockResolvedValueOnce({ok: true, data: [release]})
    .mockResolvedValueOnce({ok: true, data: [{...release, version: 4}]});
  const open = vi.fn();
  show(true, open);
  load();
  await screen.findByText("Release version 3");
  const search = screen.getByRole("searchbox", {name: "Search release dependencies"});
  fireEvent.change(search, {target: {value: "Fixture"}});
  const directory = within(screen.getByRole("navigation", {name: "Select a release dependency"}));
  if (explicit) fireEvent.click(directory.getByRole("button", {name: /Fixture rollout/}));
  fireEvent.click(screen.getByRole("button", {name: "Airflow automation"}));
  expect(screen.queryByRole("article", {name: "Selected release dependency"})).toBeNull();
  expect(m.read).toHaveBeenCalledTimes(1);

  load();
  expect(screen.getByRole("searchbox", {name: "Search release dependencies"})).toHaveProperty("value", "Fixture");
  expect(await screen.findByText(/The selected release version is unavailable/)).toBeTruthy();
  expect(screen.queryByRole("article", {name: "Selected release dependency"})).toBeNull();
  expect(open).not.toHaveBeenCalled();
  expect(m.readiness).not.toHaveBeenCalled();
  expect(m.monitor).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", {name: /Fixture rollout/}));
  expect(screen.getByText("Release version 4")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name: "Open release Fixture rollout"}));
  expect(open).toHaveBeenCalledExactlyOnceWith({id: release.id, version: 4});
});

it("restores the same dependency after a failed return and a deliberate retry", async () => {
  const other = {...release, id: "other", title: "Other rollout", version: 8};
  m.read.mockResolvedValueOnce({ok: true, data: [release, other]})
    .mockResolvedValueOnce({ok: false})
    .mockResolvedValueOnce({ok: true, data: [release, other]});
  const open = vi.fn();
  show(true, open);
  load();
  await screen.findByText("Release version 3");
  fireEvent.click(screen.getByRole("button", {name: /Other rollout/}));
  fireEvent.click(screen.getByRole("button", {name: "Airflow automation"}));

  load();
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByRole("article", {name: "Selected release dependency"})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Refresh dependencies"}));
  expect(await screen.findByText("Release version 8")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name: "Open release Other rollout"}));
  expect(open).toHaveBeenCalledExactlyOnceWith({id: other.id, version: 8});
  expect(m.readiness).not.toHaveBeenCalled();
  expect(m.monitor).not.toHaveBeenCalled();
});

it("does not read without paired workspace authority and distinguishes service failure from no matches", async () => {
  const denied = show(false);
  load();
  expect(m.read).not.toHaveBeenCalled();
  denied.unmount();
  m.read.mockResolvedValue({ok: false});
  show();
  load();
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText(/No declared Airflow runs/)).toBeNull();
});

it("does not show or open a delayed result after credential replacement", async () => {
  let complete!: (result: unknown) => void;
  m.read.mockReturnValue(new Promise(resolve => {complete = resolve;}));
  show();
  load();
  m.config = {apiBase: "https://desktop-fixture.example.invalid"};
  m.revision++;
  await act(async () => complete({ok: true, data: [release]}));
  expect(screen.queryByRole("button", {name: "Open release Fixture rollout"})).toBeNull();
});

it("checks only the selected submitted release on request and clears its evidence on selection change", async () => {
  m.read.mockResolvedValue({ok: true, data: [release, {...release, id: "second", title: "Draft rollout", status: "draft"}]});
  m.readiness.mockResolvedValue({ok: true, data: {ready: true, requestVersion: 3, observations: {
    requestId: "fixture-release", version: 3, runs: [
      {dagId: "payments", dagRunId: "staging", state: "success"},
      {dagId: "ledger", dagRunId: "staging", state: "success"},
    ],
  }}});
  show();
  load();
  const check = await screen.findByRole("button", {name: "Check batches"});
  const progress = within(screen.getByRole("list", {name: "Release dependency progress"}));
  expect(progress.getByText("Request submitted")).toBeTruthy();
  expect(progress.getByText("Awaiting check")).toBeTruthy();
  expect(progress.getByText("Wave 1").nextElementSibling?.textContent).toBe("Unavailable");
  expect(progress.getByText("Wave 2").nextElementSibling?.textContent).toBe("Unavailable");
  expect(m.readiness).not.toHaveBeenCalled();
  fireEvent.click(check);
  expect(m.readiness).toHaveBeenCalledExactlyOnceWith("fixture-release", 3, true);
  expect(await screen.findByText(/Selected batches completed. Release approval is still required/)).toBeTruthy();
  expect(progress.getByText("2 / 2 completed")).toBeTruthy();
  expect(progress.getByText("Approve").nextElementSibling?.textContent).toBe("Unavailable");
  expect(progress.getByText("Wave 1").nextElementSibling?.textContent).toBe("Unavailable");
  const runs = within(screen.getByRole("table", {name: "Observed Airflow runs"}));
  const payments = runs.getByRole("row", {name: /payments staging Succeeded/});
  const ledger = runs.getByRole("row", {name: /ledger staging Succeeded/});
  const paymentsTasks = runs.getByRole("region", {name: "Tasks for payments / staging"});
  const ledgerTasks = runs.getByRole("region", {name: "Tasks for ledger / staging"});
  expect(paymentsTasks.closest("tr")?.previousElementSibling).toBe(payments);
  expect(ledgerTasks.closest("tr")?.previousElementSibling).toBe(ledger);
  expect(m.tasks).not.toHaveBeenCalled();
  fireEvent.click(within(ledgerTasks).getByRole("button", {name: "Inspect tasks"}));
  expect(m.tasks).toHaveBeenCalledExactlyOnceWith(release.id, release.version, "ledger", "staging", 0);
  expect(await within(ledgerTasks).findByText("0 of 0 tasks · observed state only")).toBeTruthy();
  expect(within(paymentsTasks).queryByRole("status")?.textContent).toBe("");
  const list = within(screen.getByRole("navigation", {name: "Select a release dependency"}));
  fireEvent.click(list.getByRole("button", {name: /Draft rollout/}));
  expect(screen.queryByRole("table", {name: "Observed Airflow runs"})).toBeNull();
  expect(screen.queryByRole("button", {name: "Check batches"})).toBeNull();
  expect(screen.queryByText(/Selected batches completed/)).toBeNull();
  expect(screen.getByText("Batch readiness is available for submitted release versions.")).toBeTruthy();
});

it("requires pipeline read for the readiness operation", async () => {
  show(true, vi.fn(), false);
  load();
  expect(await screen.findByText("Batch readiness requires pipeline read access.")).toBeTruthy();
  expect(screen.queryByRole("button", {name: "Check batches"})).toBeNull();
  expect(m.readiness).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", {name: "View monitor status"})).toBeNull();
  expect(m.monitor).not.toHaveBeenCalled();
});

it("reads exact monitor status on demand without granting monitor actions", async () => {
  m.read.mockResolvedValue({ok: true, data: [release, {...release, id: "second", version: 4, title: "Other rollout"}]});
  m.monitor.mockResolvedValueOnce({ok: true, data: {requestVersion: 3, monitoringEnabled: true, canStart: false, canCancel: true,
    wait: {status: "paused_for_input", phase: "preflight_required"}}})
    .mockResolvedValueOnce({ok: true, data: {requestVersion: 4, monitoringEnabled: true, canStart: true, canCancel: false, wait: null}});
  show();
  load();
  const monitor = await screen.findByRole("button", {name: "View monitor status"});
  expect(m.monitor).not.toHaveBeenCalled();
  fireEvent.click(monitor);
  expect(await screen.findByText(/Recorded monitor status · paused for input/)).toBeTruthy();
  expect(screen.getByText(/Release approval is still required/)).toBeTruthy();
  expect(screen.queryByRole("button", {name: "Stop watching"})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: /Other rollout/}));
  expect(screen.queryByText(/Recorded monitor status/)).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "View monitor status"}));
  expect(await screen.findByText(/No monitoring record is saved/)).toBeTruthy();
  expect(screen.queryByRole("button", {name: "Start watching"})).toBeNull();
  expect(m.monitor.mock.calls).toEqual([["fixture-release", 3], ["second", 4]]);
  expect(m.start).not.toHaveBeenCalled();
  expect(m.stop).not.toHaveBeenCalled();
});

it("moves through loaded dependencies and returns to the exact selected version without running a check", async () => {
  m.read.mockResolvedValue({ok: true, data: [release, {...release, id: "next", version: 4, title: "Next rollout"}]});
  const openRelease = vi.fn();
  show(true, openRelease);
  load();
  const list = within(await screen.findByRole("navigation", {name: "Select a release dependency"}));
  const first = list.getByRole("button", {name: /Fixture rollout/});
  const next = list.getByRole("button", {name: /Next rollout/});
  expect(first.tabIndex).toBe(0);
  expect(next.tabIndex).toBe(-1);
  first.focus();
  fireEvent.keyDown(first, {key: "End"});
  expect(document.activeElement).toBe(next);
  expect(next.getAttribute("aria-current")).toBe("true");
  expect(first.tabIndex).toBe(-1);
  expect(next.tabIndex).toBe(0);
  fireEvent.click(next);
  const details = screen.getByRole("article", {name: "Selected release dependency"});
  expect(document.activeElement).toBe(details);
  expect(within(details).getByText("Release version 4")).toBeTruthy();
  fireEvent.keyDown(details, {key: "Escape"});
  expect(document.activeElement).toBe(next);
  expect(m.readiness).not.toHaveBeenCalled();
  expect(m.monitor).not.toHaveBeenCalled();
  expect(openRelease).not.toHaveBeenCalled();
});

it.each([true, false])("requires explicit replacement when refresh advances the release (explicit selection %s)", async explicitlySelected => {
  m.read.mockResolvedValueOnce({ok: true, data: [release]})
    .mockResolvedValueOnce({ok: true, data: [{...release, version: 4}]});
  const open = vi.fn();
  show(true, open);
  load();
  const directory = within(await screen.findByRole("navigation", {name: "Select a release dependency"}));
  if (explicitlySelected) fireEvent.click(directory.getByRole("button", {name: /Fixture rollout/}));
  expect(screen.getByText("Release version 3")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name: "Refresh dependencies"}));
  const unavailable = await screen.findByText(/The selected release version is unavailable/);
  expect(document.activeElement).toBe(unavailable);
  expect(screen.queryByRole("article", {name: "Selected release dependency"})).toBeNull();
  const current = screen.getByRole("button", {name: /Fixture rollout/});
  expect(current.getAttribute("aria-current")).toBeNull();
  expect(current.tabIndex).toBe(0);
  expect(open).not.toHaveBeenCalled();
  expect(m.readiness).not.toHaveBeenCalled();
  expect(m.monitor).not.toHaveBeenCalled();
  fireEvent.click(current);
  expect(screen.getByText("Release version 4")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name: "Open release Fixture rollout"}));
  expect(open).toHaveBeenCalledExactlyOnceWith({id: "fixture-release", version: 4});
});


it("announces a replaced dependency without moving focus out of a search in progress", async () => {
  let finishRefresh!: (result: {ok: true; data: Array<typeof release>}) => void;
  m.read.mockResolvedValueOnce({ok: true, data: [release]}).mockReturnValueOnce(new Promise(resolve => {
    finishRefresh = resolve;
  }));
  show();
  load();
  await screen.findByText("Release version 3");
  const refresh = screen.getByRole("button", {name: "Refresh dependencies"});
  refresh.focus();
  fireEvent.click(refresh);
  const search = screen.getByRole<HTMLInputElement>("searchbox", {name: "Search release dependencies"});
  search.focus();
  fireEvent.change(search, {target: {value: "Fixture"}});
  await act(async () => finishRefresh({ok: true, data: [{...release, version: 4}]}));

  expect(screen.getByRole("status").textContent).toContain("The selected release version is unavailable");
  expect(document.activeElement).toBe(search);
  expect(search.value).toBe("Fixture");
  expect(screen.queryByRole("button", {name: "Open release Fixture rollout"})).toBeNull();
  expect(m.readiness).not.toHaveBeenCalled();
  expect(m.monitor).not.toHaveBeenCalled();
});


it("pauses Airflow polling while Batches is behind Home or showing release dependencies", () => {
  const props = {canRead: true, canCheckReadiness: true, ownerConfig: m.config, revision: m.revision,
    onOpenRelease: vi.fn(), onInspect: vi.fn()};
  const view = render(createElement(BatchesWorkspaceView, {...props, active: true}));
  const draft = screen.getByLabelText<HTMLInputElement>("Airflow draft");
  fireEvent.change(draft, {target: {value: "Saved in the editor"}});
  expect(draft.dataset.active).toBe("true");

  view.rerender(createElement(BatchesWorkspaceView, {...props, active: false}));
  expect(draft.dataset.active).toBe("false");
  load();
  view.rerender(createElement(BatchesWorkspaceView, {...props, active: true}));
  expect(draft.dataset.active).toBe("false");

  fireEvent.click(screen.getByRole("button", {name: "Airflow automation"}));
  expect(draft.dataset.active).toBe("true");
  expect(draft.value).toBe("Saved in the editor");
});

it.each([
  {outcome: "exact dependency", data: release, available: true},
  {outcome: "advanced version", data: {...release, version: 4}, available: false},
  {outcome: "no declared runs", data: {...release, releaseContext: {...release.releaseContext, batches: {selectedRunCount: 0}}}, available: false},
  {outcome: "missing release", data: null, available: false},
])("preserves an older release selection on return only with $outcome", async ({data, available}) => {
  const other = {...release, id: "newer", title: "Other rollout"};
  m.read.mockResolvedValueOnce({ok: true, data: [release]}).mockResolvedValueOnce({ok: true, data: [other]});
  m.lookup.mockResolvedValueOnce({ok: true, data});
  const open = vi.fn();
  show(true, open);
  load();
  await screen.findByText("Release version 3");
  const search = screen.getByRole("searchbox", {name: "Search release dependencies"});
  fireEvent.change(search, {target: {value: "Fixture"}});
  fireEvent.click(screen.getByRole("button", {name: "Airflow automation"}));
  load();

  if (available) {
    await screen.findByRole("article", {name: "Selected release dependency"});
    fireEvent.click(screen.getByRole("button", {name: "Open release Fixture rollout"}));
    expect(open).toHaveBeenCalledExactlyOnceWith({id: "fixture-release", version: 3});
  } else {
    expect(await screen.findByText(/The selected release version is unavailable/)).toBeTruthy();
    expect(screen.queryByRole("article", {name: "Selected release dependency"})).toBeNull();
    expect(open).not.toHaveBeenCalled();
  }
  expect(m.lookup).toHaveBeenCalledExactlyOnceWith({id: "fixture-release", version: 3});
  expect(screen.getByRole("searchbox", {name: "Search release dependencies"})).toHaveProperty("value", "Fixture");
  expect(m.readiness).not.toHaveBeenCalled();
  expect(m.monitor).not.toHaveBeenCalled();
});

it("keeps current dependencies visible when an exact lookup rejects and recovers the exact version", async () => {
  const other = {...release, id: "newer", title: "Other rollout", version: 9};
  m.read.mockResolvedValue({ok: true, data: [other]});
  m.lookup.mockRejectedValueOnce(new Error("Lookup unavailable")).mockResolvedValueOnce({ok: true, data: release});
  const open = vi.fn();
  const props = {canRead: true, canCheckReadiness: true, ownerConfig: m.config, revision: m.revision,
    onOpenRelease: open, onInspect: vi.fn()};
  const view = render(createElement(BatchesWorkspaceView, props));
  load();
  await screen.findByText("Release version 9");

  view.rerender(createElement(BatchesWorkspaceView, {...props, requestedRelease: {id: release.id, version: release.version}}));
  const unavailable = await screen.findByText(/The selected release version could not be verified/);
  expect(document.activeElement).toBe(unavailable);
  expect(screen.getByRole("button", {name: /Other rollout/}).getAttribute("aria-current")).toBeNull();
  expect(screen.queryByRole("article", {name: "Selected release dependency"})).toBeNull();

  fireEvent.click(screen.getByRole("button", {name: "Refresh dependencies"}));
  await screen.findByText("Release version 3");
  fireEvent.click(screen.getByRole("button", {name: "Open release Fixture rollout"}));
  expect(open).toHaveBeenCalledExactlyOnceWith({id: release.id, version: 3});
  expect(m.lookup.mock.calls).toEqual(Array(2).fill([{id: release.id, version: 3}]));
  expect(m.readiness).not.toHaveBeenCalled();
});

it("shows only the selected release version's recorded approval and recovery facts", async () => {
  const recorded = {...release, releaseContext: {...release.releaseContext,
    readiness: {approvalDecision: "ready_for_human_approval", developmentReady: true, productionReady: false, validationStepCount: 2, deferredValidation: true},
    recovery: {rollbackAvailability: "yes", backupRequired: true, evidenceCount: 4},
    observation: {recordedMonitoringPlan: true},
  }};
  const legacy = {...release, id: "older", title: "Legacy rollout", releaseContext: {...release.releaseContext,
    readiness: {approvalDecision: "unexpected"},
    recovery: {rollbackAvailability: "unknown", backupRequired: "unexpected"},
  }};
  m.read.mockResolvedValue({ok: true, data: [recorded, legacy]});
  show();
  load();
  const approval = within(await screen.findByRole("region", {name: "Approval gate"}));
  const recovery = within(screen.getByRole("region", {name: "Recovery"}));
  expect(approval.getByText("Ready for human review")).toBeTruthy();
  expect(recovery.getByText("Available in release plan")).toBeTruthy();
  expect(recovery.getByText("Required")).toBeTruthy();
  const safetyChecks = within(screen.getByRole("region", {name: "Recorded safety checks"}));
  expect(safetyChecks.getByText("Development readiness").nextElementSibling?.textContent).toBe("Recorded");
  expect(safetyChecks.getByText("Production readiness").nextElementSibling?.textContent).toBe("Not recorded");
  expect(safetyChecks.getByText("Validation plan").nextElementSibling?.textContent).toBe("2 steps planned · deferred");
  expect(safetyChecks.getByText("Monitoring plan").nextElementSibling?.textContent).toBe("Recorded");
  expect(safetyChecks.getByText("Release evidence references").nextElementSibling?.textContent).toBe("4");
  expect(screen.queryByRole("button", {name: /approve|execute|rollback/i})).toBeNull();
  expect(m.readiness).not.toHaveBeenCalled();
  expect(m.monitor).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", {name: /Legacy rollout/}));
  expect(within(screen.getByRole("region", {name: "Approval gate"})).getByText("Unavailable")).toBeTruthy();
  expect(within(screen.getByRole("region", {name: "Recovery"})).getAllByText("Unavailable")).toHaveLength(2);
  expect(within(screen.getByRole("region", {name: "Recorded safety checks"})).getAllByText("Unavailable")).toHaveLength(5);
});

it("shows the recorded UTC window only for the selected exact release", async () => {
  const window = {startUtc: "2026-11-17T18:00:00Z", endUtc: "2026-11-17T19:00:00Z"};
  const scheduled = {...release, releaseContext: {...release.releaseContext, window}};
  const other = {...release, id: "other", title: "Other rollout", releaseContext: {
    ...release.releaseContext, window: {startUtc: window.endUtc, endUtc: window.startUtc},
  }};
  m.read.mockResolvedValueOnce({ok: true, data: [scheduled, other]});
  show();
  load();
  const config = within(await screen.findByRole("region", {name: "Recorded run configuration"}));
  const field = config.getByText("Recorded window").nextElementSibling;
  expect([...field!.querySelectorAll("time")].map(time => time.dateTime)).toEqual([
    "2026-11-17T18:00:00.000Z", "2026-11-17T19:00:00.000Z",
  ]);
  const directory = within(screen.getByRole("navigation", {name: "Select a release dependency"}));
  fireEvent.click(directory.getByRole("button", {name: /Other rollout/}));
  const otherConfig = within(screen.getByRole("region", {name: "Recorded run configuration"}));
  expect(otherConfig.getByText("Recorded window").nextElementSibling?.textContent).toBe("Unavailable");
  expect(m.readiness).not.toHaveBeenCalled();
  expect(m.monitor).not.toHaveBeenCalled();
});

it("opens only the observed failed run and clears it when a new check cannot verify the release", async () => {
  m.readiness.mockResolvedValueOnce({ok: true, data: {ready: false, reason: "unavailable", observations: {
    requestId: release.id, version: release.version, runs: [
      {dagId: "one", dagRunId: "fixture", state: "success"},
      {dagId: "two", dagRunId: "fixture", state: "failed"},
    ],
  }}});
  let finish!: (result: unknown) => void;
  m.readiness.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
  show();
  load();
  const check = await screen.findByRole("button", {name: "Check batches"});
  const progress = within(screen.getByRole("list", {name: "Release dependency progress"}));
  fireEvent.click(check);
  expect(await progress.findByText("1 / 2 completed · 1 failed")).toBeTruthy();
  expect(m.tasks).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "Inspect failed run"}));
  const failedTasks = within(screen.getByRole("region", {name: "Tasks for two / fixture"}));
  expect(await failedTasks.findByText("0 of 0 tasks · observed state only")).toBeTruthy();
  expect(document.activeElement).toBe(failedTasks.getByRole("button", {name: "Refresh tasks"}));
  expect(m.tasks).toHaveBeenCalledExactlyOnceWith(release.id, release.version, "two", "fixture", 0);
  expect(m.start).not.toHaveBeenCalled();
  expect(m.stop).not.toHaveBeenCalled();
  fireEvent.click(check);
  expect(progress.getByText("Checking…")).toBeTruthy();
  expect(screen.queryByRole("button", {name: "Inspect failed run"})).toBeNull();
  expect(progress.queryByText("1 / 2 completed · 1 failed")).toBeNull();
  await act(async () => finish({ok: true, data: {ready: false, reason: "changed"}}));
  expect(progress.getByText("Release changed")).toBeTruthy();
  expect(screen.queryByRole("button", {name: "Inspect failed run"})).toBeNull();
  expect(screen.queryByRole("table", {name: "Observed Airflow runs"})).toBeNull();
  expect(progress.getByText("Wave 2").nextElementSibling?.textContent).toBe("Unavailable");
});

it("navigates the selected dependency and discloses unavailable logs without loading or changing the release", async () => {
  const open = vi.fn();
  show(true, open);
  load();
  await screen.findByRole("heading", {name: "Fixture rollout"});
  const navigation = within(screen.getByRole("navigation", {name: "Release dependency sections"}));
  const link = (name: string) => navigation.getByRole("button", {name});
  expect(link("Overview").getAttribute("aria-current")).toBe("location");
  for (const [name, region] of [
    ["Dependencies", "Declared release runs"],
    ["Approvals", "Approval gate"],
    ["Evidence", "Recorded safety checks"],
    ["Overview", "Dependency readiness"],
  ]) {
    fireEvent.click(link(name));
    expect(link(name).getAttribute("aria-current")).toBe("location");
    expect(document.activeElement).toBe(screen.getByRole("region", {name: region}));
  }
  const logs = screen.getByText("View logs").closest("details");
  expect(logs?.open).toBe(false);
  fireEvent.click(link("Logs"));
  expect(logs?.open).toBe(true);
  expect(document.activeElement).toBe(logs);
  expect(screen.getByText("Task logs are unavailable for this release.")).toBeTruthy();
  expect(screen.getByText("Release version 3")).toBeTruthy();
  expect(m.readiness).not.toHaveBeenCalled();
  expect(m.tasks).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
});
