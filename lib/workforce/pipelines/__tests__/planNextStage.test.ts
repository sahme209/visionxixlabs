import { describe, it, expect } from "vitest";
import { planNextStage, deriveRunStatus, type StageView } from "../planNextStage";

const stage = (ordering: number, status: StageView["status"], requiresApproval = false): StageView => ({
  ordering, status, requiresApproval,
});

describe("planNextStage", () => {
  it("empty stage list → empty", () => {
    expect(planNextStage([])).toEqual({ kind: "empty" });
  });

  it("all queued, no approval → run first stage", () => {
    const r = planNextStage([stage(1, "queued"), stage(2, "queued"), stage(3, "queued")]);
    expect(r).toEqual({ kind: "run", ordering: 1 });
  });

  it("first stage running → in_flight at that stage", () => {
    const r = planNextStage([stage(1, "running"), stage(2, "queued")]);
    expect(r).toEqual({ kind: "in_flight", ordering: 1 });
  });

  it("first stage succeeded → run second", () => {
    const r = planNextStage([stage(1, "succeeded"), stage(2, "queued"), stage(3, "queued")]);
    expect(r).toEqual({ kind: "run", ordering: 2 });
  });

  it("all stages succeeded → complete", () => {
    const r = planNextStage([stage(1, "succeeded"), stage(2, "succeeded")]);
    expect(r).toEqual({ kind: "complete", runStatus: "succeeded" });
  });

  it("any failed stage short-circuits to failed", () => {
    const r = planNextStage([stage(1, "succeeded"), stage(2, "failed"), stage(3, "queued")]);
    expect(r).toEqual({ kind: "failed", runStatus: "failed", failedOrdering: 2 });
  });

  it("failed at the start stops the run", () => {
    const r = planNextStage([stage(1, "failed"), stage(2, "queued")]);
    expect(r).toEqual({ kind: "failed", runStatus: "failed", failedOrdering: 1 });
  });

  it("skipped stages advance the cursor", () => {
    const r = planNextStage([stage(1, "succeeded"), stage(2, "skipped"), stage(3, "queued")]);
    expect(r).toEqual({ kind: "run", ordering: 3 });
  });

  it("queued stage with requiresApproval → await_approval", () => {
    const r = planNextStage([stage(1, "succeeded"), stage(2, "queued", true)]);
    expect(r).toEqual({ kind: "await_approval", ordering: 2 });
  });

  it("stage already awaiting_approval pauses run", () => {
    const r = planNextStage([stage(1, "succeeded"), stage(2, "awaiting_approval", true), stage(3, "queued")]);
    expect(r).toEqual({ kind: "await_approval", ordering: 2 });
  });

  it("after approval (stage now succeeded), the next stage runs", () => {
    const r = planNextStage([stage(1, "succeeded"), stage(2, "succeeded", true), stage(3, "queued")]);
    expect(r).toEqual({ kind: "run", ordering: 3 });
  });

  it("orderings out-of-order are sorted before reduction", () => {
    const r = planNextStage([stage(3, "queued"), stage(1, "succeeded"), stage(2, "succeeded")]);
    expect(r).toEqual({ kind: "run", ordering: 3 });
  });

  it("guard precedence: failed wins over running", () => {
    const r = planNextStage([stage(1, "running"), stage(2, "failed")]);
    expect(r.kind).toBe("failed");
  });

  it("guard precedence: running wins over awaiting_approval", () => {
    const r = planNextStage([stage(1, "running"), stage(2, "awaiting_approval", true)]);
    expect(r).toEqual({ kind: "in_flight", ordering: 1 });
  });

  it("guard precedence: awaiting_approval wins over a later queued stage", () => {
    const r = planNextStage([stage(1, "awaiting_approval", true), stage(2, "queued")]);
    expect(r).toEqual({ kind: "await_approval", ordering: 1 });
  });
});

describe("deriveRunStatus", () => {
  it("all succeeded → succeeded", () => {
    expect(deriveRunStatus([stage(1, "succeeded"), stage(2, "succeeded")])).toBe("succeeded");
  });

  it("any failed → failed", () => {
    expect(deriveRunStatus([stage(1, "succeeded"), stage(2, "failed")])).toBe("failed");
  });

  it("any running → running", () => {
    expect(deriveRunStatus([stage(1, "running"), stage(2, "queued")])).toBe("running");
  });

  it("awaiting_approval → running (paused but not terminal)", () => {
    expect(deriveRunStatus([stage(1, "succeeded"), stage(2, "awaiting_approval", true)])).toBe("running");
  });

  it("no stages → queued", () => {
    expect(deriveRunStatus([])).toBe("queued");
  });

  it("all queued → running (will start at next tick)", () => {
    expect(deriveRunStatus([stage(1, "queued"), stage(2, "queued")])).toBe("running");
  });
});
