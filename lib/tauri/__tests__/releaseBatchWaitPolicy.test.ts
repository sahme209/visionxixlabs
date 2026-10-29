import { describe, expect, it } from "vitest";
import { decideReleaseBatchWait } from "../releaseBatchWaitPolicy";
const base = { startedAt: 1_000, deadlineAt: 61_000, now: 2_000, observation: "waiting" as const };
describe("release batch observation policy", () => {
  it("schedules a bounded read without granting execution", () => {
    expect(decideReleaseBatchWait(base)).toEqual({ phase: "waiting", nextObservationAt: 17_000 });
  });
  it("caps the next read at the original deadline", () => {
    expect(decideReleaseBatchWait({ ...base, now: 60_000 })).toEqual({ phase: "waiting", nextObservationAt: 61_000 });
  });
  it("expires at the deadline even if the last read reports ready", () => {
    expect(decideReleaseBatchWait({ ...base, now: 61_000, observation: "ready" })).toEqual({ phase: "expired" });
  });
  it("ready means preflight required, never approved or dispatched", () => {
    expect(decideReleaseBatchWait({ ...base, observation: "ready" })).toEqual({ phase: "preflight_required" });
  });
  it("fails closed on release changes and unavailable reads", () => {
    for (const observation of ["changed", "unavailable"] as const) {
      expect(decideReleaseBatchWait({ ...base, observation })).toEqual({ phase: "blocked" });
    }
  });
  it("rejects invalid clocks, reversed deadlines and waits longer than 7 days", () => {
    for (const patch of [{ now: NaN }, { startedAt: Infinity }, { now: 999 }, { deadlineAt: 999 }, { deadlineAt: 604_801_001 }]) {
      expect(() => decideReleaseBatchWait({ ...base, ...patch })).toThrow();
    }
  });
});
