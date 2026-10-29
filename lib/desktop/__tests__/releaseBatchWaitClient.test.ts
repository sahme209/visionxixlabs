import { afterEach, expect, it, vi } from "vitest";
import { DesktopClient } from "../../../desktop/src/lib/desktopClient";
const id = "release_batch_" + "a".repeat(64);
const wait = { id, version: 2, status: "running", phase: "observe_batches", deadlineAt: 1792845000000, nextObservationAt: null };
const state = { requestVersion: 3, monitoringEnabled: true, canStart: false, canCancel: true, wait };
const client = () => new DesktopClient({ apiBase: "https://axiom.invalid", sessionToken: "axm.desk.fixture.signature" });
function respond(data: unknown, status = 200) { const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data }), { status })); vi.stubGlobal("fetch", fetcher); return fetcher; }
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("preserves the monitoring and permission envelope over an encoded paired GET", async () => {
 const fetcher = respond(state); expect(await client().releaseBatchWait("release/one", 3)).toEqual({ ok: true, data: state });
 expect(fetcher).toHaveBeenCalledWith("https://axiom.invalid/api/desktop/deployments/release%2Fone/batch-wait?expectedVersion=3", expect.objectContaining({ method: "GET", credentials: "omit" }));
});
it("sends only version and chosen deadline when starting", async () => {
 const fetcher = respond(wait); await client().startReleaseBatchWait("release", 3, 1792845000000);
 expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ expectedVersion: 3, deadlineAt: 1792845000000 });
});
it("sends a version-bound DELETE body without browser cookies", async () => {
 const fetcher = respond({ ...wait, version: 3, status: "cancelled", phase: "cancelled" }); await client().cancelReleaseBatchWait("release", id, 2);
 expect(fetcher).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: "DELETE", credentials: "omit", body: JSON.stringify({ waitId: id, expectedWaitVersion: 2 }) }));
});
it("refuses stale or malformed control state and failed HTTP success-shaped responses", async () => {
 respond({ ...state, requestVersion: 2 }); expect(await client().releaseBatchWait("release", 3)).toMatchObject({ ok: false });
 respond(state, 503); expect(await client().releaseBatchWait("release", 3)).toMatchObject({ ok: false });
 respond({ ...state, wait: null, canCancel: true }); expect(await client().releaseBatchWait("release", 3)).toMatchObject({ ok: false });
});
it("does not send unsupported credentials", async () => {
 const fetcher = respond(state); expect(await new DesktopClient({ sessionToken: "vxlk_fixture" }).releaseBatchWait("release", 3)).toMatchObject({ ok: false }); expect(fetcher).not.toHaveBeenCalled();
});

it("bounds the complete read even when a response body never completes", async () => {
 vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => {}) }));
 const pending = client().releaseBatchWait("release", 3); await vi.advanceTimersByTimeAsync(25000); expect(await pending).toMatchObject({ ok: false });
});
