import { describe, it, expect } from "vitest";
import { planExecution } from "../planExecution";

describe("planExecution", () => {
  it("accepts approved + not_started + executor", () => {
    const r = planExecution({ snapshotStatus: "approved", executionStatus: "not_started", hasExecutor: true });
    expect(r.kind).toBe("accept");
  });

  it("rejects when snapshot is pending", () => {
    const r = planExecution({ snapshotStatus: "pending", executionStatus: "not_started", hasExecutor: true });
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("not_approved");
  });

  it("rejects when snapshot is rejected", () => {
    const r = planExecution({ snapshotStatus: "rejected", executionStatus: "not_started", hasExecutor: true });
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("not_approved");
  });

  it("rejects when snapshot is expired", () => {
    const r = planExecution({ snapshotStatus: "expired", executionStatus: "not_started", hasExecutor: true });
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("not_approved");
  });

  it("rejects when execution already happened", () => {
    const r = planExecution({ snapshotStatus: "approved", executionStatus: "executed", hasExecutor: true });
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("already_executed");
  });

  it("rejects when previous execution failed (manual reset required)", () => {
    const r = planExecution({ snapshotStatus: "approved", executionStatus: "failed", hasExecutor: true });
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("previously_failed");
  });

  it("rejects when execution is in flight", () => {
    const r = planExecution({ snapshotStatus: "approved", executionStatus: "running", hasExecutor: true });
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("execution_in_flight");
  });

  it("rejects when no executor is registered", () => {
    const r = planExecution({ snapshotStatus: "approved", executionStatus: "not_started", hasExecutor: false });
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("no_executor_registered");
  });

  it("rejects on unknown execution status (defensive)", () => {
    const r = planExecution({ snapshotStatus: "approved", executionStatus: "weird_state", hasExecutor: true });
    expect(r.kind).toBe("reject");
  });

  it("guard ordering: not_approved fires before already_executed", () => {
    const r = planExecution({ snapshotStatus: "pending", executionStatus: "executed", hasExecutor: true });
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("not_approved");
  });

  it("guard ordering: already_executed fires before no_executor_registered", () => {
    const r = planExecution({ snapshotStatus: "approved", executionStatus: "executed", hasExecutor: false });
    expect(r.kind).toBe("reject");
    if (r.kind === "reject") expect(r.reason).toBe("already_executed");
  });
});
