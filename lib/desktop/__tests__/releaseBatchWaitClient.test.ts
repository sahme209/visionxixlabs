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

it("binds readiness to the requested version and validates the returned status", async () => {
  const fetcher = respond({ ready: true, requestVersion: 3 });
  expect(await client().releaseBatchReadiness("release/one", 3)).toEqual({ ok: true, data: { ready: true, requestVersion: 3 } });
  expect(fetcher).toHaveBeenCalledWith("https://axiom.invalid/api/desktop/deployments/release%2Fone/batch-readiness?expectedVersion=3&includeTiming=1", expect.objectContaining({ method: "GET", credentials: "omit" }));
  respond({ ready: false, reason: "waiting" });
  expect(await client().releaseBatchReadiness("release", 3)).toEqual({ ok: true, data: { ready: false, reason: "waiting" } });
  for (const body of [{ ready: true, requestVersion: 4 }, { ready: "true", requestVersion: 3 }, { ready: false, reason: "unknown" }, null]) {
    respond(body);
    expect(await client().releaseBatchReadiness("release", 3)).toMatchObject({ ok: false });
  }
});

it("accepts valid exact-run timing and refuses malformed or reversed observations", async () => {
  const timing = { startedAt: "2026-10-24T02:30:00+02:00", endedAt: "2026-10-24T01:00:00Z" };
  const response = (runTiming: unknown) => ({ ready: true, requestVersion: 3, observations: {
    requestId: "release", version: 3, runs: [{ dagId: "daily", dagRunId: "selected", state: "success", timing: runTiming }],
  } });
  respond(response(timing));
  expect(await client().releaseBatchReadiness("release", 3)).toEqual({ ok: true, data: response(timing) });
  for (const invalid of [{ ...timing, endedAt: "yesterday" }, { ...timing, endedAt: "2026-10-24T00:00:00Z" }]) {
    respond(response(invalid));
    expect(await client().releaseBatchReadiness("release", 3)).toMatchObject({ ok: false });
  }
});

it("binds task pages to the exact requested release, DAG run and page", async () => {
  const page = { requestId:"release",version:3,dagId:"daily",dagRunId:"selected",offset:0,totalEntries:0,tasks:[] };
  const fetcher=respond(page);
  expect(await client().releaseBatchTasks("release",3,"daily","selected",0)).toEqual({ok:true,data:page});
  expect(fetcher).toHaveBeenCalledWith("https://axiom.invalid/api/desktop/deployments/release/batch-tasks?expectedVersion=3&dagId=daily&dagRunId=selected&offset=0",expect.objectContaining({method:"GET",credentials:"omit"}));
  respond({...page,dagRunId:"unrelated"});
  expect(await client().releaseBatchTasks("release",3,"daily","selected",0)).toMatchObject({ok:false});
});

it("requires exact unobserved declarations and an explicit opt-in", async () => {
  const run = {dagId:"daily",dagRunId:"selected"};
  const declarations = {requestId:"release",version:3,runs:[run]};
  const data = {ready:false,reason:"unavailable",declarations};
  const request = respond(data);
  expect(await client().releaseBatchReadiness("release",3,true)).toEqual({ok:true,data});
  expect(request.mock.calls[0][0]).toContain("&includeSavedRuns=1");
  respond(data);
  expect(await client().releaseBatchReadiness("release",3)).toMatchObject({ok:false});
  for (const body of [
    {...data,declarations:{...declarations,version:4}},
    {...data,declarations:{...declarations,requestId:"different"}},
    {...data,declarations:{...declarations,runs:[run,run]}},
    {...data,declarations:{...declarations,runs:[{...run,state:"success"}]}},
    {...data,ready:true,requestVersion:3},
  ]) {
    respond(body);
    expect(await client().releaseBatchReadiness("release",3,true)).toMatchObject({ok:false});
  }
});

it("reads saved batch identities on their storage-only path and rejects mismatched or enriched evidence", async () => {
  const data = {requestId: "release", version: 3, runs: [{dagId: "daily", dagRunId: "selected"}]};
  const fetcher = respond(data);
  expect(await client().releaseBatchDeclarations("release", 3)).toEqual({ok: true, data});
  expect(fetcher).toHaveBeenCalledWith("https://axiom.invalid/api/desktop/deployments/release/batch-declarations?expectedVersion=3",
    expect.objectContaining({method: "GET", credentials: "omit", cache: "no-store"}));
  for (const invalid of [
    {...data, requestId: "other"}, {...data, version: 4}, {...data, runs: [data.runs[0], data.runs[0]]},
    {...data, runs: [{...data.runs[0], state: "success"}]},
  ]) {
    respond(invalid);
    expect(await client().releaseBatchDeclarations("release", 3)).toMatchObject({ok: false});
  }
});
