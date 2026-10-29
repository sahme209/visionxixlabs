import { expect, it, vi } from "vitest";
import { exactReleaseDependenciesReady } from "../dependencyReadiness";
const bound = [{ dagId: "daily", dagRunId: "scheduled__2026-10-24", logicalDate: "2026-10-24T00:00:00Z" }];
const success = { dagId: "daily", dagRunId: bound[0].dagRunId, state: "success", logicalDate: bound[0].logicalDate };
it("reads the exact bound run instead of consulting a newer latest success", async () => {
  const getDagRun = vi.fn().mockResolvedValue(success);
  expect(await exactReleaseDependenciesReady({ getDagRun } as never, bound)).toBe(true);
  expect(getDagRun).toHaveBeenCalledWith(bound[0].dagId, bound[0].dagRunId);
});
it.each([{ ...success, dagId: "foreign" }, { ...success, dagRunId: "newer_success" }, { ...success, logicalDate: "2026-10-25T00:00:00Z" }, { ...success, state: "running" }, { ...success, state: "failed" }])("fails closed for mismatched or unfinished batch", async run => {
  expect(await exactReleaseDependenciesReady({ getDagRun: vi.fn().mockResolvedValue(run) } as never, bound)).toBe(false);
});
it.each([[], [...bound, ...bound], [{ ...bound[0], dagRunId: "" }], [{ ...bound[0], logicalDate: "invalid" }]].map(bindings => ({ bindings })))("refuses an absent, duplicate or incomplete exact batch specification", async ({ bindings }) => {
  const getDagRun = vi.fn(); expect(await exactReleaseDependenciesReady({ getDagRun } as never, bindings)).toBe(false); expect(getDagRun).not.toHaveBeenCalled();
});
it("requires every bound run and treats unavailable observations as not ready", async () => {
  const client = { getDagRun: vi.fn().mockResolvedValueOnce(success).mockRejectedValueOnce(new Error("provider private diagnostic")) };
  expect(await exactReleaseDependenciesReady(client as never, [...bound, { ...bound[0], dagId: "second" }])).toBe(false);
});

it('does not collapse different microsecond logical dates or accept incomplete timestamps',async()=>{
 const bindings=[{...bound[0],logicalDate:'2026-10-24T00:00:00.000001Z'}];
 expect(await exactReleaseDependenciesReady({getDagRun:vi.fn().mockResolvedValue({...success,logicalDate:'2026-10-24T00:00:00.000002Z'})} as never,bindings)).toBe(false);
 const getDagRun=vi.fn().mockResolvedValue({...success,logicalDate:'2026-10-24'});
 expect(await exactReleaseDependenciesReady({getDagRun} as never,[{...bound[0],logicalDate:'2026-10-24'}])).toBe(false);expect(getDagRun).not.toHaveBeenCalled();
});
it('keeps the selected run immutable while an observation is pending',async()=>{
 const bindings=bound.map(item=>({...item}));let resolve!:(value:unknown)=>void;
 const pending=exactReleaseDependenciesReady({getDagRun:vi.fn().mockReturnValue(new Promise(r=>resolve=r))} as never,bindings);
 bindings[0].dagRunId='another';resolve({...success,dagRunId:'another'});expect(await pending).toBe(false);
});

it("stops exact batch reads after cancellation without starting the next batch", async () => {
  const controller = new AbortController();
  const getDagRun = vi.fn().mockImplementation(async () => { controller.abort(); return { dagId: "batch", dagRunId: "one", state: "success", logicalDate: "2026-10-24T10:00:00Z" }; });
  expect(await exactReleaseDependenciesReady({ getDagRun }, [{ dagId: "batch", dagRunId: "one", logicalDate: "2026-10-24T10:00:00Z" }, { dagId: "batch", dagRunId: "two", logicalDate: "2026-10-24T10:00:00Z" }], controller.signal)).toBe(false);
  expect(getDagRun).toHaveBeenCalledTimes(1);
});
