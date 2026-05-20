/**
 * Vitest unit tests for the pure anomaly detector.
 */

import { describe, it, expect } from "vitest";
import { detectAnomalies } from "../anomalyDetector";

describe("anomalyDetector", () => {
  it("empty series → no points, no anomalies", () => {
    const r = detectAnomalies([]);
    expect(r.points.length).toBe(0);
    expect(r.anomalies.length).toBe(0);
    expect(r.mean).toBe(0);
    expect(r.std).toBe(0);
  });

  it("constant series has zero z-scores and no anomalies", () => {
    const r = detectAnomalies(new Array(30).fill(10));
    expect(r.anomalies.length).toBe(0);
    expect(r.points.every((p) => p.zScore === 0)).toBe(true);
    expect(r.std).toBe(0);
  });

  it("flags a single sharp spike in an otherwise steady series", () => {
    const base = new Array(30).fill(10);
    base[20] = 1000;
    const r = detectAnomalies(base, { bandSigma: 3 });
    expect(r.anomalies).toContain(20);
  });

  it("flags far fewer points in a steady series than a spiky one", () => {
    const steady = Array.from({ length: 30 }, (_, i) => 10 + Math.sin(i / 2));
    const spiky = [...steady];
    spiky[15] = 500;
    spiky[25] = 500;
    const a = detectAnomalies(steady, { bandSigma: 4 });
    const b = detectAnomalies(spiky, { bandSigma: 4 });
    expect(b.anomalies.length).toBeGreaterThan(a.anomalies.length);
    expect(b.anomalies).toContain(15);
    expect(b.anomalies).toContain(25);
  });

  it("respects custom bandSigma — tighter band finds more anomalies", () => {
    const series = [10, 10, 10, 10, 10, 13, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    const wide = detectAnomalies(series, { bandSigma: 5 });
    const tight = detectAnomalies(series, { bandSigma: 1.5 });
    expect(tight.anomalies.length).toBeGreaterThanOrEqual(wide.anomalies.length);
  });

  it("clamps window to >= 2", () => {
    const series = [1, 2, 3, 4, 5];
    const r = detectAnomalies(series, { window: 1 });
    expect(r.points.length).toBe(5);
  });

  it("clamps ewmaAlpha to (0, 1]", () => {
    const series = [10, 12, 14, 16, 18];
    const r1 = detectAnomalies(series, { ewmaAlpha: 0 });
    const r2 = detectAnomalies(series, { ewmaAlpha: 5 });
    // Both should still produce one EWMA per point without throwing
    expect(r1.points.length).toBe(5);
    expect(r2.points.length).toBe(5);
  });

  it("global mean/std reflect the whole series", () => {
    const series = [0, 10, 20];
    const r = detectAnomalies(series);
    expect(r.mean).toBeCloseTo(10, 5);
    expect(r.std).toBeCloseTo(Math.sqrt((100 + 0 + 100) / 3), 5);
  });
});
