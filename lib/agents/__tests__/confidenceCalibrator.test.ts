import { describe, it, expect } from "vitest";
import {
  calibrateKernel,
  calibrateAll,
  type OutcomeRecord,
  type OutcomeKind,
} from "../confidenceCalibrator";

function rec(kind: OutcomeKind, confirmed = true, daysAgo = 1): OutcomeRecord {
  return {
    decidedAt: new Date(Date.now() - daysAgo * 24 * 3600 * 1000),
    kind,
    confirmed,
  };
}

describe("calibrateKernel", () => {
  it("no outcomes → baseline trust + trust_same", () => {
    const r = calibrateKernel({ kernelId: "k", outcomes: [], baseline: 0.6 });
    expect(r.samples).toBe(0);
    expect(r.rawAccuracy).toBe(0.6);
    expect(r.calibratedAccuracy).toBe(0.6);
    expect(r.recommendation).toBe("trust_same");
  });

  it("high samples + high accuracy → trust_more", () => {
    const outcomes = Array.from({ length: 30 }, () => rec("approved"));
    const r = calibrateKernel({ kernelId: "k", outcomes });
    expect(r.recommendation).toBe("trust_more");
    expect(r.calibratedAccuracy).toBeGreaterThan(0.7);
  });

  it("rollback rate >= 10% on >= 10 samples → pause", () => {
    const outcomes: OutcomeRecord[] = [
      ...Array.from({ length: 7 }, () => rec("approved")),
      ...Array.from({ length: 3 }, () => rec("approved_rollback")),
    ];
    const r = calibrateKernel({ kernelId: "k", outcomes });
    expect(r.recommendation).toBe("pause");
  });

  it("majority failures on >= 10 samples → trust_less", () => {
    const outcomes: OutcomeRecord[] = [
      ...Array.from({ length: 3 }, () => rec("approved")),
      ...Array.from({ length: 7 }, () => rec("rejected")),
    ];
    const r = calibrateKernel({ kernelId: "k", outcomes });
    expect(r.recommendation).toBe("trust_less");
  });

  it("few samples → trust_same (not enough data)", () => {
    const outcomes = [rec("approved"), rec("approved")];
    const r = calibrateKernel({ kernelId: "k", outcomes });
    expect(r.recommendation).toBe("trust_same");
    expect(r.rationale).toMatch(/Only/);
  });

  it("expired outcomes are ignored", () => {
    const outcomes: OutcomeRecord[] = [
      ...Array.from({ length: 25 }, () => rec("approved")),
      ...Array.from({ length: 50 }, () => rec("expired")),
    ];
    const r = calibrateKernel({ kernelId: "k", outcomes });
    expect(r.samples).toBe(25);
  });

  it("calibrated ≤ raw for small samples (Wilson lower bound is conservative)", () => {
    const outcomes = Array.from({ length: 6 }, () => rec("approved"));
    const r = calibrateKernel({ kernelId: "k", outcomes });
    expect(r.calibratedAccuracy).toBeLessThanOrEqual(r.rawAccuracy);
  });

  it("auto_applied counts as success", () => {
    const outcomes = Array.from({ length: 30 }, () => rec("auto_applied"));
    const r = calibrateKernel({ kernelId: "k", outcomes });
    expect(r.recommendation).toBe("trust_more");
  });

  it("low calibrated accuracy on >= 10 samples → trust_less", () => {
    const outcomes: OutcomeRecord[] = [
      ...Array.from({ length: 2 }, () => rec("approved")),
      ...Array.from({ length: 8 }, () => rec("rejected")),
    ];
    const r = calibrateKernel({ kernelId: "k", outcomes });
    expect(r.recommendation).toBe("trust_less");
  });

  it("steady state on enough samples → trust_same", () => {
    // 12/15 approved → Wilson lower bound ≈ 0.55. Above the
    // trust_less floor (0.35), below the trust_more floor (0.70),
    // sample count below MIN_SAMPLES_FOR_TRUST_MORE (20) → trust_same.
    const outcomes: OutcomeRecord[] = [
      ...Array.from({ length: 12 }, () => rec("approved")),
      ...Array.from({ length: 3 },  () => rec("rejected")),
    ];
    const r = calibrateKernel({ kernelId: "k", outcomes });
    expect(r.recommendation).toBe("trust_same");
  });

  it("calibrateAll returns sorted by kernelId", () => {
    const all = calibrateAll([
      { kernelId: "zebra", outcomes: [] },
      { kernelId: "alpha", outcomes: [] },
      { kernelId: "beta",  outcomes: [] },
    ]);
    expect(all.map((r) => r.kernelId)).toEqual(["alpha", "beta", "zebra"]);
  });

  it("rollback rate is computed against approvals only", () => {
    // 5 approved + 5 approved_rollback + 5 rejected → rollback rate = 5/(5+5) = 0.5
    const outcomes: OutcomeRecord[] = [
      ...Array.from({ length: 5 }, () => rec("approved")),
      ...Array.from({ length: 5 }, () => rec("approved_rollback")),
      ...Array.from({ length: 5 }, () => rec("rejected")),
    ];
    const r = calibrateKernel({ kernelId: "k", outcomes });
    expect(r.rollbackRate).toBeCloseTo(0.5, 2);
    expect(r.recommendation).toBe("pause");
  });
});
