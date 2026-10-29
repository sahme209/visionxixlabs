/** @vitest-environment jsdom */
import { createElement, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
const io = vi.hoisted(() => ({ connection: vi.fn(), runs: vi.fn(), config: {}, revision: 0 }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { airflowConnection: io.connection, listAirflowDagRuns: io.runs, get config() { return io.config; }, subscribeContext: () => () => {}, getContextRevision: () => io.revision } }));
import { ReleaseBatchSelection } from "../../../desktop/src/components/ReleaseBatchSelection";
const connection = { connected: true, connectionId: "connection", connectionUpdatedAt: "2026-10-24T00:00:00.000Z" };
const runs = [{ dagId: "daily", dagRunId: "specific-run", logicalDate: "2026-10-24T00:00:00.000001Z", state: "running" }];
beforeEach(() => { vi.clearAllMocks(); io.config = {}; io.revision = 0; io.connection.mockResolvedValue({ ok: true, data: connection }); io.runs.mockResolvedValue({ ok: true, data: { runs } }); });
afterEach(cleanup);
function Harness() {
  const [value, onChange] = useState<any>();
  return createElement("div", null, createElement(ReleaseBatchSelection, { value, onChange, onIssueChange: () => {} }), createElement("output", { "aria-label": "selection" }, JSON.stringify(value ?? null)));
}
it("selects one exact observed run explicitly without treating running as success", async () => {
  render(createElement(Harness)); fireEvent.click(screen.getByText("Read Airflow connection")); await screen.findByText("Airflow connection verified");
  fireEvent.change(screen.getByLabelText("Batch DAG"), { target: { value: "daily" } }); fireEvent.click(screen.getByText("Find batch runs"));
  const chooser = await screen.findByLabelText("Exact batch run"); expect(screen.getByLabelText("selection").textContent).toBe("null");
  fireEvent.change(chooser, { target: { value: "specific-run" } }); fireEvent.click(screen.getByText("Use selected batch"));
  expect(JSON.parse(screen.getByLabelText("selection").textContent!)).toEqual({ connectionId: connection.connectionId, connectionUpdatedAt: connection.connectionUpdatedAt, runs: [{ dagId: "daily", dagRunId: "specific-run", logicalDate: runs[0].logicalDate }] });
  expect((screen.getByText("Use selected batch") as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Remove batch daily specific-run" })); expect(screen.getByLabelText("selection").textContent).toBe("null");
});
it("does not report a connection when none is configured", async () => {
  io.connection.mockResolvedValue({ ok: true, data: { connected: false } }); render(createElement(Harness)); fireEvent.click(screen.getByText("Read Airflow connection"));
  await screen.findByText("Airflow is not connected to this workspace."); expect(io.runs).not.toHaveBeenCalled();
});
it("ignores a delayed connection response after unmount", async () => {
  let resolve!:(value:unknown)=>void; io.connection.mockReturnValue(new Promise(r => resolve = r)); const changed = vi.fn();
  const view = render(createElement(ReleaseBatchSelection, { onChange: changed, onIssueChange: () => {} })); fireEvent.click(screen.getByText("Read Airflow connection")); view.unmount();
  await act(async () => resolve({ ok: true, data: connection })); expect(changed).not.toHaveBeenCalled();
});

it('does not remain busy or accept a stale result after credentials change',async()=>{
 let resolve!:(value:unknown)=>void;io.connection.mockReturnValueOnce(new Promise(r=>resolve=r));const view=render(createElement(Harness));
 fireEvent.click(screen.getByText('Read Airflow connection'));io.config={changed:true};io.revision=1;view.rerender(createElement(Harness));
 expect((screen.getByText('Read Airflow connection') as HTMLButtonElement).disabled).toBe(false);
 await act(async()=>resolve({ok:true,data:connection}));expect(screen.queryByText('Airflow connection verified')).toBeNull();
});

it.each(['incomplete-date','duplicate'])('refuses %s run observations instead of offering ambiguous selection',async kind=>{
 io.runs.mockResolvedValue({ok:true,data:{runs:kind==='duplicate'?[...runs,...runs]:[{...runs[0],logicalDate:'2026-10-24'}]}});
 render(createElement(Harness));fireEvent.click(screen.getByText('Read Airflow connection'));await screen.findByText('Airflow connection verified');
 fireEvent.change(screen.getByLabelText('Batch DAG'),{target:{value:'daily'}});fireEvent.click(screen.getByText('Find batch runs'));
 await screen.findByText('Batch runs could not be verified.');expect(screen.queryByLabelText('Exact batch run')).toBeNull();
});
