/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
const io = vi.hoisted(() => ({ read: vi.fn(), start: vi.fn(), cancel: vi.fn(), config: {}, revision: 0 }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { releaseBatchWait: io.read, startReleaseBatchWait: io.start, cancelReleaseBatchWait: io.cancel, get config() { return io.config; }, subscribeContext: () => () => {}, getContextRevision: () => io.revision } }));
import { ReleaseBatchMonitor } from "../../../desktop/src/components/ReleaseBatchMonitor";
const wait = { id: "release_batch_" + "a".repeat(64), version: 2, status: "running", phase: "observe_batches", deadlineAt: Date.now() + 60000, nextObservationAt: null };
const enabled = { requestVersion: 3, monitoringEnabled: true, canStart: true, canCancel: false, wait: null };
afterEach(() => { cleanup(); vi.resetAllMocks(); io.config = {}; io.revision = 0; });
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

it.each(["start", "cancel"] as const)("does an exact read after an unconfirmed %s response without replaying the action", async mode => {
 const canCancel = { ...enabled, canStart: false, canCancel: true, wait };
 const stopped = { ...enabled, canStart: false, wait: { ...wait, status: "cancelled", phase: "cancelled" } };
 const write = mode === "start" ? io.start : io.cancel;
 io.read.mockResolvedValueOnce({ok: true, data: mode === "start" ? enabled : canCancel})
   .mockResolvedValueOnce({ok: true, data: mode === "start" ? canCancel : stopped});
 write.mockRejectedValueOnce(new Error("Response lost"));
 render(createElement(ReleaseBatchMonitor, {requestId: "release", version: 3}));
 fireEvent.click(screen.getByText("Monitor batches"));
 fireEvent.click(await screen.findByText(mode === "start" ? "Start watching" : "Stop watching"));
 await screen.findByText("The action was unconfirmed. The saved status has been refreshed.");
 expect(io.read.mock.calls).toEqual([["release", 3], ["release", 3]]);
 expect(write).toHaveBeenCalledTimes(1);
});

it("suppresses monitor writes and follow-on reads after a context revision changes before rendering", async () => {
 let resolve!: (value: unknown) => void;
 io.read.mockResolvedValue({ok: true, data: enabled});
 io.start.mockReturnValueOnce(new Promise(r => { resolve = r; }));
 render(createElement(ReleaseBatchMonitor, {requestId: "release", version: 3}));
 fireEvent.click(screen.getByText("Monitor batches"));
 fireEvent.click(await screen.findByText("Start watching"));
 io.revision += 1;
 await act(async () => resolve({ok: true, data: wait}));
 expect(io.read).toHaveBeenCalledExactlyOnceWith("release", 3);
 fireEvent.click(screen.getByRole("button", {name: /monitor/i}));
 expect(io.read).toHaveBeenCalledTimes(1);
 expect(io.start).toHaveBeenCalledTimes(1);
});

it.each([false,true])("retires the exact closed monitor and retains focus (read-only: %s)", async readOnly => {
 const closed = {requestVersion:3,closedRelease:{requestId:"release",version:3},monitoringEnabled:false,canStart:false,canCancel:false,wait:null};
 io.read.mockResolvedValueOnce({ok:true,data:{...enabled,canStart:false,canCancel:true,wait}})
   .mockResolvedValueOnce({ok:true,data:closed});
 render(createElement(ReleaseBatchMonitor,{requestId:"release",version:3,readOnly}));
 fireEvent.click(screen.getByRole("button",{name:readOnly ? "View monitor status" : "Monitor batches"}));
 const refresh = await screen.findByRole("button",{name:"Refresh monitor"});
 refresh.focus();
 fireEvent.click(refresh);
 await screen.findByText("This saved release is closed. Refresh the release list to review its recorded closure.");
 expect(document.activeElement).toBe(refresh);
 expect(refresh.getAttribute("aria-disabled")).toBe("true");
 expect(screen.queryByText(/Recorded monitor status/)).toBeNull();
 expect(screen.queryByRole("button",{name:"Stop watching"})).toBeNull();
 fireEvent.click(refresh);
 expect(io.read).toHaveBeenCalledTimes(2);
 expect(io.start).not.toHaveBeenCalled();
 expect(io.cancel).not.toHaveBeenCalled();
});

it("skips a follow-up monitor read when closure arrives while starting", async () => {
 let settle!: (value: unknown) => void;
 io.read.mockResolvedValueOnce({ok:true,data:enabled});
 io.start.mockReturnValueOnce(new Promise(resolve => {settle = resolve;}));
 const props = {requestId:"release",version:3};
 const view = render(createElement(ReleaseBatchMonitor,props));
 fireEvent.click(screen.getByRole("button",{name:"Monitor batches"}));
 fireEvent.click(await screen.findByRole("button",{name:"Start watching"}));
 view.rerender(createElement(ReleaseBatchMonitor,{...props,releaseClosed:true}));
 await act(async () => settle({ok:false,error:"Response lost"}));
 expect(screen.getByText("The monitoring action was unconfirmed.")).toBeTruthy();
 expect(screen.getByRole("button",{name:"Refresh monitor"}).getAttribute("aria-disabled")).toBe("true");
 expect(io.read).toHaveBeenCalledExactlyOnceWith("release",3);
 expect(io.start).toHaveBeenCalledTimes(1);
});
it("reports closure without claiming the result of a lost monitor start", async () => {
 const closed = {requestVersion:3,closedRelease:{requestId:"release",version:3},monitoringEnabled:false,canStart:false,canCancel:false,wait:null};
 io.read.mockResolvedValueOnce({ok:true,data:enabled}).mockResolvedValueOnce({ok:true,data:closed});
 io.start.mockRejectedValueOnce(new Error("Connection lost"));
 render(createElement(ReleaseBatchMonitor,{requestId:"release",version:3}));
 fireEvent.click(screen.getByRole("button",{name:"Monitor batches"}));
 fireEvent.click(await screen.findByRole("button",{name:"Start watching"}));
 await screen.findByText("The monitoring action was unconfirmed.");
 expect(screen.getByText(/This saved release is closed/)).toBeTruthy();
 expect(screen.queryByRole("button",{name:"Start watching"})).toBeNull();
 expect(io.start).toHaveBeenCalledTimes(1);
 expect(io.read.mock.calls).toEqual([["release",3],["release",3]]);
});
it("keeps read-only focus while loading and shows only the returned monitor timing", async () => {
 let resolve!: (value: unknown) => void;
 io.read.mockReturnValueOnce(new Promise(done => { resolve = done; }));
 render(createElement(ReleaseBatchMonitor, { requestId: "release", version: 3, readOnly: true }));
 const monitor = screen.getByRole("button", {name: "View monitor status"});
 monitor.focus();
 fireEvent.click(monitor);
 fireEvent.click(monitor);
 expect(document.activeElement).toBe(monitor);
 expect(monitor.getAttribute("aria-disabled")).toBe("true");
 expect(io.read).toHaveBeenCalledExactlyOnceWith("release", 3);
 const deadline = "2026-11-20T11:00:00.000Z";
 const next = "2026-11-20T10:30:00.000Z";
 await act(async () => resolve({ok:true, data:{...enabled, canStart:false, canCancel:true,
   wait:{...wait, deadlineAt:Date.parse(deadline), nextObservationAt:next}}}));
 const dates = screen.getByRole("region", {name: "Batch monitor"}).querySelectorAll("time");
 expect(Array.from(dates, time => time.dateTime)).toEqual([deadline, next]);
 expect(document.activeElement).toBe(monitor);
 expect(screen.queryByRole("button", {name: /watching/})).toBeNull();
 io.read.mockReturnValueOnce(new Promise(done => {resolve = done;}));
 fireEvent.click(monitor);
 expect(screen.queryByText("Recorded deadline")).toBeNull();
 expect(screen.queryByText(/Recorded monitor status/)).toBeNull();
 expect(document.activeElement).toBe(monitor);
 await act(async () => resolve({ok:false}));
 expect(screen.getByRole("alert").textContent).toContain("Monitor status is unavailable");
 expect(screen.getByRole("region", {name: "Batch monitor"}).querySelector("time")).toBeNull();
});
