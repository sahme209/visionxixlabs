/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mock = vi.hoisted(() => ({ revision: 0, tasks: vi.fn(), releaseTasks: vi.fn() }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { getContextRevision: () => mock.revision, listAirflowTaskInstances: mock.tasks, releaseBatchTasks: mock.releaseTasks } }));
import { AirflowRunTasks } from "../../../desktop/src/components/AirflowRunTasks";
afterEach(() => { cleanup(); vi.resetAllMocks(); mock.revision = 0; });
it("loads only on intent, displays task identity and pages without executing", async () => {
 mock.tasks.mockResolvedValue({ ok: true, data: { tasks: [{ taskId: "extract", mapIndex: 2, tryNumber: 3, state: "failed" }], offset: 0, totalEntries: 2 } });
 render(createElement(AirflowRunTasks, { dagId: "daily", runId: "run" }));
 expect(mock.tasks).not.toHaveBeenCalled(); fireEvent.click(screen.getByText("Inspect tasks"));
 await screen.findByText("extract [2] · failed · try 3"); fireEvent.click(screen.getByText("Next task page"));
 expect(mock.tasks).toHaveBeenLastCalledWith("daily", "run", 1);
});
it("preserves keyboard focus and retries a failed page at its exact offset", async () => {
 const task = { taskId: "extract", mapIndex: -1, tryNumber: 1, state: "success" };
 mock.tasks
  .mockResolvedValueOnce({ ok: true, data: { tasks: [task], offset: 0, totalEntries: 2 } })
  .mockResolvedValueOnce({ ok: false })
  .mockResolvedValueOnce({ ok: true, data: { tasks: [{ ...task, taskId: "validate" }], offset: 1, totalEntries: 2 } });
 render(createElement(AirflowRunTasks, { dagId: "daily", runId: "run" }));
 fireEvent.click(screen.getByRole("button", { name: "Inspect tasks" }));
 const next = await screen.findByRole("button", { name: "Next task page" });
 next.focus();
 fireEvent.click(next);
 const retry = await screen.findByRole("button", { name: "Retry tasks" });
 expect(document.activeElement).toBe(retry);
 expect(screen.queryByText(/extract/)).toBeNull();
 fireEvent.click(retry);
 await screen.findByText("validate · success · try 1");
 expect(mock.tasks.mock.calls.map(call => call[2])).toEqual([0, 1, 1]);
 expect(screen.getByRole("status").textContent).toContain("2–2 of 2 tasks");
 expect(document.activeElement).toBe(screen.getByRole("button", { name: "Refresh tasks" }));
});
it("does not publish a late result into a changed workspace", async () => {
 let resolve!: (value: unknown) => void; mock.tasks.mockReturnValue(new Promise(done => { resolve = done; }));
 render(createElement(AirflowRunTasks, { dagId: "daily", runId: "run" })); fireEvent.click(screen.getByText("Inspect tasks")); mock.revision++;
 await act(async () => resolve({ ok: true, data: { tasks: [{ taskId: "private", mapIndex: -1, tryNumber: 1, state: "success" }], offset: 0, totalEntries: 1 } }));
 expect(screen.queryByText(/private/)).toBeNull();
});
it("handles provider failures without retaining stale success", async () => {
 mock.tasks.mockRejectedValue(new Error("fixture")); render(createElement(AirflowRunTasks, { dagId: "daily", runId: "run" })); fireEvent.click(screen.getByText("Inspect tasks"));
 await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("No execution outcome"));
});

it("returns to the actual prior offset after short pages and retries or refreshes the selected page", async () => {
  const task = {taskId:"extract",mapIndex:-1,tryNumber:1,state:"failed"};
  function page(offset: number) {
    return {ok:true,data:{tasks:[{...task,taskId:`task-${offset}`}],offset,totalEntries:3}};
  }
  mock.tasks.mockResolvedValueOnce(page(0)).mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(2))
    .mockResolvedValueOnce({ok:false}).mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(0));
  render(createElement(AirflowRunTasks,{dagId:"daily",runId:"run"}));
  fireEvent.click(screen.getByText("Inspect tasks"));
  fireEvent.click(await screen.findByText("Next task page"));
  await screen.findByText("task-1 · failed · try 1");
  fireEvent.click(screen.getByText("Next task page"));
  await screen.findByText("task-2 · failed · try 1");
  const previous = screen.getByText("Previous task page");
  previous.focus();
  fireEvent.click(previous);
  const retry = await screen.findByText("Retry tasks");
  expect(document.activeElement).toBe(retry);
  fireEvent.click(retry);
  await screen.findByText("task-1 · failed · try 1");
  fireEvent.click(screen.getByText("Refresh tasks"));
  await screen.findByText("task-1 · failed · try 1");
  fireEvent.click(screen.getByText("Previous task page"));
  await screen.findByText("task-0 · failed · try 1");
  expect(mock.tasks.mock.calls.map(call => call[2])).toEqual([0,1,2,1,1,1,0]);
});

it("shows exact release task timing in UTC and withholds an end before its start", async () => {
  mock.releaseTasks.mockResolvedValue({ok:true,data:{offset:0,totalEntries:1,tasks:[{
    taskId:"validate",mapIndex:-1,tryNumber:2,state:"failed",
    startedAt:"2026-11-17T12:05:00+02:00",endedAt:"2026-11-17T10:04:00Z",
  }]}});
  render(createElement(AirflowRunTasks,{dagId:"daily",runId:"run",release:{id:"release",version:2}}));
  fireEvent.click(screen.getByText("Inspect tasks"));
  expect((await screen.findByText("2026-11-17 10:05:00")).getAttribute("dateTime")).toBe("2026-11-17T10:05:00.000Z");
  expect(screen.getByText("Ended (UTC)").nextElementSibling?.textContent).toBe("Unavailable");
  expect(mock.releaseTasks).toHaveBeenCalledExactlyOnceWith("release",2,"daily","run",0);
  expect(mock.tasks).not.toHaveBeenCalled();
});
