import { describe, it, expect } from "vitest";
import { planRefinementAction } from "../planRefinementAction";

describe("planRefinementAction — happy path", () => {
  it("parse + apply ok → ship", () => {
    const r = planRefinementAction({ parseOk: true, applyOk: true, attemptCount: 0 });
    expect(r.kind).toBe("ship");
  });

  it("ship after a successful retry", () => {
    const r = planRefinementAction({ parseOk: true, applyOk: true, attemptCount: 1 });
    expect(r.kind).toBe("ship");
  });
});

describe("planRefinementAction — retry paths", () => {
  it("parse failed + attempts remaining → retry_parse", () => {
    const r = planRefinementAction({ parseOk: false, applyOk: false, attemptCount: 0 });
    expect(r.kind).toBe("retry_parse");
  });

  it("parse ok + apply failed → retry_apply", () => {
    const r = planRefinementAction({ parseOk: true, applyOk: false, attemptCount: 0 });
    expect(r.kind).toBe("retry_apply");
  });

  it("parse_failed wins over apply_failed when both are bad", () => {
    // We deliberately retry parse first because an unparseable diff can't be tested for apply.
    const r = planRefinementAction({ parseOk: false, applyOk: false, attemptCount: 0 });
    expect(r.kind).toBe("retry_parse");
  });
});

describe("planRefinementAction — budget exhaustion", () => {
  it("give_up after default maxAttempts (1)", () => {
    const r = planRefinementAction({ parseOk: false, applyOk: false, attemptCount: 1 });
    expect(r.kind).toBe("give_up");
  });

  it("custom maxAttempts respected", () => {
    const r = planRefinementAction({
      parseOk: false, applyOk: false, attemptCount: 2, maxAttempts: 3,
    });
    expect(r.kind).toBe("retry_parse");
  });

  it("give_up still produces a reason for the audit log", () => {
    const r = planRefinementAction({ parseOk: false, applyOk: false, attemptCount: 5 });
    expect(r.reason.length).toBeGreaterThan(20);
  });
});

describe("planRefinementAction — boundary cases", () => {
  it("attemptCount=0 always retries when broken", () => {
    expect(planRefinementAction({ parseOk: false, applyOk: false, attemptCount: 0 }).kind).toBe("retry_parse");
  });

  it("maxAttempts=0 means no retries at all → give_up immediately", () => {
    const r = planRefinementAction({ parseOk: false, applyOk: false, attemptCount: 0, maxAttempts: 0 });
    expect(r.kind).toBe("give_up");
  });

  it("apply_ok despite parse_failed is impossible but defensive", () => {
    // Logically impossible (can't apply what didn't parse), but the planner
    // shouldn't crash — it should treat as "ship" because both signals are positive.
    // Actually parse-failed always means we can't ship, so apply_ok is moot.
    // The planner trusts parse_ok as the gate.
    const r = planRefinementAction({ parseOk: false, applyOk: true, attemptCount: 0 });
    expect(r.kind).toBe("retry_parse");
  });
});
