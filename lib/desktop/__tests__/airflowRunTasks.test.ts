/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mock = vi.hoisted(() => ({ revision: 0, tasks: vi.fn() }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { getContextRevision: () => mock.revision, listAirflowTaskInstances: mock.tasks } }));
import { AirflowRunTasks } from "../../../desktop/src/components/AirflowRunTasks";
afterEach(() => { cleanup(); vi.resetAllMocks(); mock.revision = 0; });
it("loads only on intent, displays task identity and pages without executing", async () => {
 mock.tasks.mockResolvedValue({ ok: true, data: { tasks: [{ taskId: "extract", mapIndex: 2, tryNumber: 3, state: "failed" }], offset: 0, totalEntries: 2 } });
 render(createElement(AirflowRunTasks, { dagId: "daily", runId: "run" }));
 expect(mock.tasks).not.toHaveBeenCalled(); fireEvent.click(screen.getByText("Inspect tasks"));
 await screen.findByText("extract [2] · failed · try 3"); fireEvent.click(screen.getByText("Next task page"));
 expect(mock.tasks).toHaveBeenLastCalledWith("daily", "run", 1);
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
