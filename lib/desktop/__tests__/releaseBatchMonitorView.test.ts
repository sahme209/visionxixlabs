/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
const io = vi.hoisted(() => ({ read: vi.fn(), start: vi.fn(), cancel: vi.fn(), config: {} }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { releaseBatchWait: io.read, startReleaseBatchWait: io.start, cancelReleaseBatchWait: io.cancel, get config() { return io.config; }, subscribeContext: () => () => {}, getContextRevision: () => 0 } }));
import { ReleaseBatchMonitor } from "../../../desktop/src/components/ReleaseBatchMonitor";
const wait = { id: "release_batch_" + "a".repeat(64), version: 2, status: "running", phase: "observe_batches", deadlineAt: Date.now() + 60000, nextObservationAt: null };
const enabled = { requestVersion: 3, monitoringEnabled: true, canStart: true, canCancel: false, wait: null };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("does not read or start monitoring until explicitly requested", async () => {
 io.read.mockResolvedValue({ ok: true, data: { ...enabled, monitoringEnabled: false, canStart: false } });
 render(createElement(ReleaseBatchMonitor, { requestId: "release", version: 3 })); expect(io.read).not.toHaveBeenCalled();
 fireEvent.click(screen.getByText("Monitor batches")); await screen.findByText("Background checks are unavailable. You can still check batches manually."); expect(screen.queryByText("Start watching")).toBeNull(); expect(io.start).not.toHaveBeenCalled();
});
it("starts only with current server permission and refreshes recorded state", async () => {
 io.read.mockResolvedValueOnce({ ok: true, data: enabled }).mockResolvedValue({ ok: true, data: { ...enabled, canStart: false, canCancel: true, wait } }); io.start.mockResolvedValue({ ok: true, data: wait });
 render(createElement(ReleaseBatchMonitor, { requestId: "release", version: 3 })); fireEvent.click(screen.getByText("Monitor batches")); fireEvent.click(await screen.findByText("Start watching"));
 await screen.findByText("Batch monitor saved. Refresh for current status."); expect(io.start).toHaveBeenCalledWith("release", 3, expect.any(Number));
});
it("cancels only the service-authorized current wait version", async () => {
 io.read.mockResolvedValueOnce({ ok: true, data: { ...enabled, canStart: false, canCancel: true, wait } }).mockResolvedValue({ ok: true, data: { ...enabled, canStart: false, wait: { ...wait, status: "cancelled", phase: "cancelled" } } }); io.cancel.mockResolvedValue({ ok: true, data: { ...wait, status: "cancelled" } });
 render(createElement(ReleaseBatchMonitor, { requestId: "release", version: 3 })); fireEvent.click(screen.getByText("Monitor batches")); fireEvent.click(await screen.findByText("Stop watching")); await screen.findByText("Batch monitoring stopped."); expect(io.cancel).toHaveBeenCalledWith("release", wait.id, 2);
});
it("discards a late old-release response", async () => {
 let resolve!: (value: unknown) => void; io.read.mockReturnValue(new Promise(r => resolve = r)); const view = render(createElement(ReleaseBatchMonitor, { requestId: "release", version: 3 })); fireEvent.click(screen.getByText("Monitor batches")); view.rerender(createElement(ReleaseBatchMonitor, { requestId: "release", version: 4 }));
 await act(async () => resolve({ ok: true, data: enabled })); expect(screen.queryByText("Start watching")).toBeNull();
});
it("does not treat recorded completion as deployment permission", async () => {
 io.read.mockResolvedValue({ ok: true, data: { ...enabled, canStart: false, wait: { ...wait, status: "paused_for_input", phase: "preflight_required" } } }); render(createElement(ReleaseBatchMonitor, { requestId: "release", version: 3 })); fireEvent.click(screen.getByText("Monitor batches")); await screen.findByText("Last observation: batches finished. Release approval is still required."); expect(screen.queryByText("Start watching")).toBeNull();
});

it("does not issue a follow-on request under a changed connection after starting", async () => {
 let resolve!: (value: unknown) => void; io.read.mockResolvedValue({ ok: true, data: enabled }); io.start.mockReturnValue(new Promise(r => resolve = r));
 const view = render(createElement(ReleaseBatchMonitor, { requestId: "release", version: 3 })); fireEvent.click(screen.getByText("Monitor batches")); fireEvent.click(await screen.findByText("Start watching"));
 io.config = {}; view.rerender(createElement(ReleaseBatchMonitor, { requestId: "release", version: 3 }));
 await act(async () => resolve({ ok: true, data: wait })); expect(io.read).toHaveBeenCalledTimes(1); expect(screen.queryByText("Batch monitor saved. Refresh for current status.")).toBeNull();
});
