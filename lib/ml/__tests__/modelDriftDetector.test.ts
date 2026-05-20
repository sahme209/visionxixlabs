/**
 * Vitest unit tests for the pure ML model drift detector (PSI).
 */

import { describe, it, expect } from "vitest";
import { computeFeaturePsi, detectModelDrift } from "../modelDriftDetector";

describe("modelDriftDetector", () => {
  it("identical distributions → PSI ≈ 0 → stable", () => {
    const r = computeFeaturePsi({
      feature: "f1",
      baseline: [{ label: "A", count: 50 }, { label: "B", count: 50 }],
      current:  [{ label: "A", count: 50 }, { label: "B", count: 50 }],
    });
    expect(r.psi).toBeLessThan(0.001);
    expect(r.status).toBe("stable");
  });

  it("modest shift → drifting (0.1 ≤ psi < 0.25)", () => {
    const r = computeFeaturePsi({
      feature: "f1",
      baseline: [{ label: "A", count: 50 }, { label: "B", count: 50 }],
      current:  [{ label: "A", count: 30 }, { label: "B", count: 70 }],
    });
    expect(r.status).toBe("drifting");
  });

  it("significant shift → significant_drift", () => {
    const r = computeFeaturePsi({
      feature: "f1",
      baseline: [{ label: "A", count: 90 }, { label: "B", count: 10 }],
      current:  [{ label: "A", count: 10 }, { label: "B", count: 90 }],
    });
    expect(r.status).toBe("significant_drift");
    expect(r.psi).toBeGreaterThan(0.25);
  });

  it("topShifts highlights the largest contributors", () => {
    const r = computeFeaturePsi({
      feature: "f1",
      baseline: [{ label: "A", count: 90 }, { label: "B", count: 10 }],
      current:  [{ label: "A", count: 10 }, { label: "B", count: 90 }],
    });
    expect(r.topShifts.length).toBeGreaterThan(0);
    expect(r.topShifts[0]).toHaveProperty("contribution");
  });

  it("empty baseline OR empty current → PSI 0 + stable", () => {
    const r = computeFeaturePsi({ feature: "f1", baseline: [], current: [{ label: "A", count: 10 }] });
    expect(r.psi).toBe(0);
    expect(r.status).toBe("stable");
  });

  it("aligns buckets across distributions when labels are disjoint", () => {
    const r = computeFeaturePsi({
      feature: "f1",
      baseline: [{ label: "A", count: 100 }],
      current:  [{ label: "B", count: 100 }],
    });
    expect(r.psi).toBeGreaterThan(0.25); // total shift
    expect(r.status).toBe("significant_drift");
  });

  it("detectModelDrift sorts features by psi desc + overall worst", () => {
    const r = detectModelDrift([
      { feature: "stable", baseline: [{ label: "A", count: 50 }, { label: "B", count: 50 }],
                            current:  [{ label: "A", count: 49 }, { label: "B", count: 51 }] },
      { feature: "drifting", baseline: [{ label: "A", count: 90 }, { label: "B", count: 10 }],
                              current:  [{ label: "A", count: 10 }, { label: "B", count: 90 }] },
    ]);
    expect(r.rows[0].feature).toBe("drifting");
    expect(r.overall).toBe("significant_drift");
  });

  it("smoothing prevents divide-by-zero when a bucket is missing", () => {
    const r = computeFeaturePsi({
      feature: "f",
      baseline: [{ label: "A", count: 100 }],
      current:  [{ label: "A", count: 50 }, { label: "B", count: 50 }],
    });
    expect(Number.isFinite(r.psi)).toBe(true);
  });
});
