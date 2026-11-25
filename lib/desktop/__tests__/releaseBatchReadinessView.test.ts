/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
const io = vi.hoisted(() => ({ read: vi.fn(), declarations: vi.fn(), tasks: vi.fn(), config: {} }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { releaseBatchReadiness: io.read, releaseBatchDeclarations: io.declarations, releaseBatchTasks: io.tasks, get config() { return io.config; }, subscribeContext: () => () => {}, getContextRevision: () => 0 } }));
import { ReleaseBatchReadiness } from "../../../desktop/src/components/ReleaseBatchReadiness";
beforeEach(() => io.declarations.mockReset().mockResolvedValue({ok: false}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("shows only actual version-bound completion after an explicit read", async () => {
  let complete!: (value: unknown) => void;
  io.read.mockReturnValue(new Promise(resolve => {complete = resolve;}));
  render(createElement(ReleaseBatchReadiness, {requestId: "release", version: 3, count: 2}));
  expect(io.read).not.toHaveBeenCalled();
  const check = screen.getByRole("button", {name: "Check batches"});
  check.focus();
  fireEvent.click(check);
  fireEvent.click(check);
  expect(check.getAttribute("aria-disabled")).toBe("true");
  expect(document.activeElement).toBe(check);
  expect(io.read).toHaveBeenCalledExactlyOnceWith("release", 3);
  await act(async () => complete({ok: true, data: {ready: true, requestVersion: 3}}));
  expect(screen.getByText("Selected batches completed. Release approval is still required.")).toBeTruthy();
  expect(document.activeElement).toBe(check);
  expect(check.getAttribute("aria-disabled")).toBe("false");
});
it("discards an old release version response", async () => {
  let resolve!:(value:unknown)=>void; io.read.mockReturnValue(new Promise(r => resolve = r));
  const view = render(createElement(ReleaseBatchReadiness, { requestId: "release", version: 3, count: 2 })); fireEvent.click(screen.getByText("Check batches"));
  view.rerender(createElement(ReleaseBatchReadiness, { requestId: "release", version: 4, count: 2 }));
  await act(async () => resolve({ ok: true, data: { ready: true, requestVersion: 3 } })); expect(screen.queryByText(/Selected batches completed/)).toBeNull();
  expect((screen.getByText("Check batches") as HTMLButtonElement).disabled).toBe(false);
});
it("never presents a mismatched ready version as completed", async () => {
  io.read.mockResolvedValue({ ok: true, data: { ready: true, requestVersion: 2 } }); render(createElement(ReleaseBatchReadiness, { requestId: "release", version: 3, count: 1 }));
  fireEvent.click(screen.getByText("Check batches")); await screen.findByText("Batch completion could not be verified.");
});

it("keeps focus and retires reads after receiving closure of the exact selected version", async () => {
  const binding = {requestId:"release", version:3};
  io.declarations.mockResolvedValue({ok:true,data:{...binding,runs:[{dagId:"daily",dagRunId:"selected"}]}});
  io.read.mockResolvedValueOnce({ok:true,data:{ready:false,reason:"changed",closedRelease:{...binding,version:4}}})
    .mockResolvedValueOnce({ok:true,data:{ready:false,reason:"changed",closedRelease:binding}});
  render(createElement(ReleaseBatchReadiness,{...binding,count:1,inspectTasks:true}));
  await screen.findByRole("table",{name:"Saved Airflow runs"});
  const check = screen.getByRole("button",{name:"Check batches"});
  check.focus();
  fireEvent.click(check);
  await screen.findByText("Release or connection changed. Reopen release details.");
  expect(check.getAttribute("aria-disabled")).toBe("false");
  fireEvent.click(check);
  await screen.findByText("This saved release was closed. Refresh the release list to open its recorded closure.");
  expect(screen.queryByRole("table",{name:"Saved Airflow runs"})).toBeNull();
  expect(screen.queryByRole("table",{name:"Observed Airflow runs"})).toBeNull();
  expect(check.getAttribute("aria-disabled")).toBe("true");
  expect(document.activeElement).toBe(check);
  fireEvent.click(check);
  expect(io.read).toHaveBeenCalledTimes(2);
});

it("shows only observed UTC times and preserves missing timing in the selected run", async () => {
  io.read.mockResolvedValue({ ok: true, data: { ready: false, reason: "waiting", observations: {
    requestId: "release", version: 3, runs: [{ dagId: "daily", dagRunId: "selected", state: "running",
      timing: { startedAt: "2026-10-24T02:30:00+02:00", endedAt: null } }],
  } } });
  const view = render(createElement(ReleaseBatchReadiness, {requestId: "release", version: 3, count: 1}));
  expect(screen.queryByText("Timing (UTC)")).toBeNull();
  fireEvent.click(screen.getByText("Check batches"));
  const time = await screen.findByText("2026-10-24 00:30:00");
  expect(time.getAttribute("datetime")).toBe("2026-10-24T00:30:00.000Z");
  expect(screen.getByText("Ended").nextElementSibling?.textContent).toBe("Unavailable");
  view.rerender(createElement(ReleaseBatchReadiness, {requestId: "release", version: 4, count: 1}));
  expect(screen.queryByText("Timing (UTC)")).toBeNull();
});

it("reads tasks only on demand for an observed run on the selected release version", async () => {
  io.declarations.mockResolvedValue({ok: true, data: {
    requestId: "release", version: 3, runs: [{dagId: "daily", dagRunId: "selected"}],
  }});
  io.read.mockResolvedValue({ok:true,data:{ready:false,reason:"unavailable",observations:{
    requestId:"release",version:3,runs:[{dagId:"daily",dagRunId:"selected",state:"failed"}],
  }}});
  io.tasks.mockResolvedValue({ok:true,data:{tasks:[{taskId:"reconcile",mapIndex:-1,tryNumber:2,state:"failed"}],totalEntries:1,offset:0}});
  const props={requestId:"release",version:3,count:1,inspectTasks:true};
  const view=render(createElement(ReleaseBatchReadiness, props));
  fireEvent.click(screen.getByText("Check batches"));
  const inspect=await screen.findByRole("button",{name:"Inspect tasks"});
  expect(io.tasks).not.toHaveBeenCalled();
  inspect.focus();
  fireEvent.click(inspect);
  expect(await screen.findByRole("row", {name: /reconcile failed 2/})).toBeTruthy();
  expect(io.tasks).toHaveBeenCalledExactlyOnceWith("release",3,"daily","selected",0);
  expect(document.activeElement).toBe(inspect);
  view.rerender(createElement(ReleaseBatchReadiness,{...props,version:4}));
  expect(screen.queryByRole("table", {name: "Observed task states"})).toBeNull();
});

it("shows saved identities as unverified, with no provider task entry or old-version carryover", async () => {
  io.read.mockResolvedValue({ok:true,data:{ready:false,reason:"unavailable",declarations:{
    requestId:"release",version:3,runs:[{dagId:"daily",dagRunId:"selected"}],
  }}});
  const props = {requestId:"release",version:3,count:1,inspectTasks:true};
  const view = render(createElement(ReleaseBatchReadiness, props));
  fireEvent.click(screen.getByRole("button",{name:"Check batches"}));
  expect(await screen.findByRole("table",{name:"Saved Airflow runs"})).toBeTruthy();
  expect(screen.getByText("selected")).toBeTruthy();
  expect(screen.getByText("Unverified")).toBeTruthy();
  expect(screen.queryByRole("button",{name:"Inspect tasks"})).toBeNull();
  expect(io.read).toHaveBeenCalledExactlyOnceWith("release",3,true);
  view.rerender(createElement(ReleaseBatchReadiness,{...props,version:4}));
  expect(screen.queryByRole("table",{name:"Saved Airflow runs"})).toBeNull();
});

it("loads exact saved identities without observing Airflow and clears them on version change", async () => {
  let stale!: (value: unknown) => void;
  io.declarations.mockReturnValueOnce(new Promise(resolve => { stale = resolve; }));
  io.declarations.mockResolvedValueOnce({ok: true, data: {
    requestId: "release", version: 4, runs: [{dagId: "daily", dagRunId: "current"}],
  }});
  const props = {requestId: "release", version: 3, count: 1, inspectTasks: true};
  const view = render(createElement(ReleaseBatchReadiness, props));
  view.rerender(createElement(ReleaseBatchReadiness, {...props, version: 4}));
  await screen.findByText("current");
  await act(async () => stale({ok: true, data: {requestId: "release", version: 3, runs: [{dagId: "daily", dagRunId: "older"}]}}));
  expect(screen.queryByText("older")).toBeNull();
  expect(screen.getByText("Unverified")).toBeTruthy();
  expect(io.declarations.mock.calls).toEqual([["release", 3], ["release", 4]]);
  expect(io.read).not.toHaveBeenCalled();
  expect(io.tasks).not.toHaveBeenCalled();
  io.read.mockResolvedValueOnce({ok: true, data: {ready: false, reason: "changed"}});
  fireEvent.click(screen.getByRole("button", {name: "Check batches"}));
  await screen.findByText("Release or connection changed. Reopen release details.");
  expect(screen.queryByText("current")).toBeNull();
});

it("keeps saved run identities through an unavailable check and clears observed provider data", async () => {
  const identities = {requestId: "release", version: 3, runs: [{dagId: "daily", dagRunId: "selected"}]};
  io.declarations.mockResolvedValue({ok: true, data: identities});
  io.read.mockResolvedValueOnce({ok: true, data: {ready: false, reason: "waiting", observations: {
    ...identities, runs: [{...identities.runs[0], state: "running"}],
  }}}).mockRejectedValueOnce(new Error("Provider unavailable"));
  render(createElement(ReleaseBatchReadiness, {requestId: "release", version: 3, count: 1, inspectTasks: true}));
  await screen.findByRole("table", {name: "Saved Airflow runs"});
  const refresh = screen.getByRole("button", {name: "Check batches"});
  refresh.focus();
  fireEvent.click(refresh);
  await screen.findByRole("table", {name: "Observed Airflow runs"});
  fireEvent.click(refresh);
  expect(screen.getByRole("table", {name: "Saved Airflow runs"})).toBeTruthy();
  expect(screen.queryByRole("button", {name: "Inspect tasks"})).toBeNull();
  await screen.findByText("Batch completion could not be verified.");
  expect(screen.getByText("selected")).toBeTruthy();
  expect(screen.getByText("Unverified")).toBeTruthy();
  expect(screen.queryByRole("table", {name: "Observed Airflow runs"})).toBeNull();
  expect(document.activeElement).toBe(refresh);

  io.read.mockResolvedValueOnce({ok: true, data: {ready: false, reason: "changed"}})
    .mockRejectedValueOnce(new Error("Provider unavailable"))
    .mockResolvedValueOnce({ok: true, data: {ready: false, reason: "unavailable", declarations: identities}});
  fireEvent.click(refresh);
  await screen.findByText("Release or connection changed. Reopen release details.");
  expect(screen.queryByRole("table", {name: "Saved Airflow runs"})).toBeNull();
  fireEvent.click(refresh);
  await screen.findByText("Batch completion could not be verified.");
  expect(screen.queryByRole("table", {name: "Saved Airflow runs"})).toBeNull();
  fireEvent.click(refresh);
  await screen.findByRole("table", {name: "Saved Airflow runs"});
  expect(screen.getByText("Unverified")).toBeTruthy();
});

it("retries the exact saved selection without a provider check and moves focus to the verified table", async () => {
  let resolveRetry!: (value: unknown) => void;
  io.declarations.mockResolvedValueOnce({ok: false})
    .mockImplementationOnce(() => new Promise(resolve => { resolveRetry = resolve; }));
  render(createElement(ReleaseBatchReadiness, {requestId: "release", version: 3, count: 1, inspectTasks: true}));
  const retry = await screen.findByRole("button", {name: "Retry saved runs"});
  expect(screen.getByText("Saved run details could not be verified.")).toBeTruthy();
  retry.focus();
  fireEvent.click(retry);
  fireEvent.click(retry);
  expect(document.activeElement).toBe(retry);
  expect(retry.getAttribute("aria-disabled")).toBe("true");
  expect(io.declarations.mock.calls).toEqual([["release", 3], ["release", 3]]);
  expect(io.read).not.toHaveBeenCalled();
  expect(io.tasks).not.toHaveBeenCalled();

  await act(async () => resolveRetry({ok: true, data: {
    requestId: "release", version: 3, runs: [{dagId: "daily", dagRunId: "recovered"}],
  }}));
  expect(document.activeElement).toBe(screen.getByRole("table", {name: "Saved Airflow runs"}));
  expect(screen.getByText("recovered")).toBeTruthy();
  expect(screen.getByText("Unverified")).toBeTruthy();
  expect(screen.queryByRole("button", {name: "Retry saved runs"})).toBeNull();
});

it("withholds provider evidence when its exact saved run identities disagree", async () => {
  const saved = {requestId: "release", version: 3, runs: [{dagId: "daily", dagRunId: "declared"}]};
  io.declarations.mockResolvedValue({ok: true, data: saved});
  io.read.mockResolvedValueOnce({ok: true, data: {ready: true, requestVersion: 3, observations: {
    ...saved, runs: [{dagId: "daily", dagRunId: "different-run", state: "success"}],
  }}}).mockResolvedValueOnce({ok: true, data: {ready: true, requestVersion: 3, observations: {
    ...saved, runs: [{...saved.runs[0], state: "success"}],
  }}});
  render(createElement(ReleaseBatchReadiness, {requestId: "release", version: 3, count: 1, inspectTasks: true}));
  await screen.findByText("declared");

  const check = screen.getByRole("button", {name: "Check batches"});
  check.focus();
  fireEvent.click(check);
  await screen.findByText("Observed runs do not match the saved release runs. Check again or reopen release details.");
  expect(screen.queryByText("different-run")).toBeNull();
  expect(screen.queryByRole("button", {name: "Inspect tasks"})).toBeNull();
  expect(screen.getByText("declared")).toBeTruthy();
  expect(document.activeElement).toBe(check);

  fireEvent.click(check);
  await screen.findByRole("table", {name: "Observed Airflow runs"});
  expect(screen.getByText("Succeeded")).toBeTruthy();
  expect(io.tasks).not.toHaveBeenCalled();
});

it.each(["success", "failed"] as const)("withholds a %s observation when the declaration read fails and restores focus on an exact retry", async (state) => {
  const saved = {requestId: "release", version: 3, runs: [{dagId: "daily", dagRunId: "selected"}]};
  io.declarations.mockResolvedValueOnce({ok: false}).mockResolvedValueOnce({ok: true, data: saved});
  io.read.mockResolvedValueOnce({ok: true, data: {
    ...(state === "success" ? {ready: true, requestVersion: 3} : {ready: false, reason: "unavailable"}),
    observations: {...saved, runs: [{...saved.runs[0], state}]},
  }});
  const progress = vi.fn();
  render(createElement(ReleaseBatchReadiness, {requestId: "release", version: 3, count: 1, inspectTasks: true, renderProgress: progress}));
  const retry = await screen.findByRole("button", {name: "Retry saved runs"});

  fireEvent.click(screen.getByRole("button", {name: "Check batches"}));
  await screen.findByText(/Last checked/);
  expect(screen.queryByRole("table", {name: "Observed Airflow runs"})).toBeNull();
  expect(screen.queryByRole("button", {name: "Inspect failed run"})).toBeNull();
  expect(screen.queryByText(/\d+ failed runs?/)).toBeNull();
  expect(progress).toHaveBeenLastCalledWith("Unverified", false);
  expect(screen.getByRole("button", {name: "Retry saved runs"})).toBe(retry);

  retry.focus();
  fireEvent.click(retry);
  const table = await screen.findByRole("table", {name: "Observed Airflow runs"});
  expect(document.activeElement).toBe(table);
  expect(progress).toHaveBeenLastCalledWith(state === "success" ? "1 / 1 completed" : "0 / 1 completed · 1 failed", state === "success");
  expect(screen.getByText(state === "success" ? "0 failed runs" : "1 failed run")).toBeTruthy();
  expect(io.read).toHaveBeenCalledExactlyOnceWith("release", 3, true);
  expect(io.declarations.mock.calls).toEqual([["release", 3], ["release", 3]]);
  expect(io.tasks).not.toHaveBeenCalled();
});

it("withholds conflicting status when the declaration read finishes after the observation", async () => {
  let finish!: (data: unknown) => void;
  io.declarations.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  io.read.mockResolvedValueOnce({ok: true, data: {ready: true, requestVersion: 3, observations: {
    requestId: "release", version: 3, runs: [{dagId: "daily", dagRunId: "different-run", state: "success"}],
  }}});
  render(createElement(ReleaseBatchReadiness, {requestId: "release", version: 3, count: 1, inspectTasks: true}));
  fireEvent.click(screen.getByRole("button", {name: "Check batches"}));
  await screen.findByText("Verifying saved run identities…");
  expect(screen.queryByRole("table", {name: "Observed Airflow runs"})).toBeNull();

  await act(async () => finish({ok: true, data: {requestId: "release", version: 3, runs: [{dagId: "daily", dagRunId: "declared"}]}}));
  expect(await screen.findByText("Observed runs do not match the saved release runs. Check again or reopen release details.")).toBeTruthy();
  expect(screen.queryByRole("table", {name: "Observed Airflow runs"})).toBeNull();
  expect(screen.getByText("declared")).toBeTruthy();
  expect(io.tasks).not.toHaveBeenCalled();
});

it.each([
  {ready: true, requestVersion: 3},
  {ready: false, reason: "waiting"},
])("withholds an aggregate-only Batches result and recovers on exact observations (%j)", async result => {
  const declared = {dagId: "daily", dagRunId: "saved-run"};
  io.declarations.mockResolvedValue({ok: true, data: {
    requestId: "release", version: 3, runs: [declared],
  }});
  io.read.mockResolvedValueOnce({ok: true, data: result}).mockResolvedValueOnce({ok: true, data: {
    ready: true, requestVersion: 3,
    observations: {requestId: "release", version: 3, runs: [{...declared, state: "success"}]},
  }});
  const progress = vi.fn();
  render(createElement(ReleaseBatchReadiness, {requestId: "release", version: 3, count: 1, inspectTasks: true, renderProgress: progress}));
  await screen.findByRole("table", {name: "Saved Airflow runs"});
  const check = screen.getByRole("button", {name: "Check batches"});
  check.focus();
  fireEvent.click(check);
  await screen.findByText("Run observations are missing. Check batches again to verify the saved runs.");
  expect(progress).toHaveBeenLastCalledWith("Unverified", false);
  expect(screen.getByRole("table", {name: "Saved Airflow runs"})).toBeTruthy();
  expect(screen.queryByRole("table", {name: "Observed Airflow runs"})).toBeNull();
  expect(document.activeElement).toBe(check);

  fireEvent.click(check);
  await screen.findByRole("table", {name: "Observed Airflow runs"});
  expect(progress).toHaveBeenLastCalledWith("1 / 1 completed", true);
  expect(io.read.mock.calls).toEqual([["release", 3, true], ["release", 3, true]]);
  expect(io.tasks).not.toHaveBeenCalled();
});
