import { describe, it, expect } from "vitest";
import { detectAnomalies, type MetricSample } from "../anomalyDetector";

function series(values: readonly number[]): MetricSample[] {
  // Synthesize one sample per minute so the timestamps are monotonic.
  const base = new Date("2026-05-21T10:00:00.000Z").getTime();
  return values.map((v, i) => ({
    at: new Date(base + i * 60_000).toISOString(),
    value: v,
  }));
}

describe("detectAnomalies", () => {
  it("empty input → missing_data", () => {
    const r = detectAnomalies("m", []);
    expect(r.kind).toBe("missing_data");
  });

  it("small baseline → missing_data", () => {
    const r = detectAnomalies("m", series([1, 2]));
    expect(r.kind).toBe("missing_data");
  });

  it("flat series → none", () => {
    const r = detectAnomalies("m", series([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]));
    expect(r.kind).toBe("none");
    expect(r.outlierIndices).toEqual([]);
  });

  it("single huge spike at the end → spike", () => {
    const r = detectAnomalies("m", series([10, 10, 10, 10, 10, 10, 10, 10, 10, 100]));
    expect(r.kind).toBe("spike");
    expect(r.outlierIndices.length).toBe(1);
    expect(r.worstZ).toBeGreaterThan(3.5);
  });

  it("single huge dip at the end → dip", () => {
    const r = detectAnomalies("m", series([100, 100, 100, 100, 100, 100, 100, 100, 100, 0]));
    expect(r.kind).toBe("dip");
  });

  it("steady drift up → drift (individual points stay inside z band)", () => {
    // Baseline (70% = 7 samples) sits around 10 with MAD=1; check
    // window shifts up by 3 so the median moves but no single point
    // crosses z=3.5. Drift detector should fire on the median delta.
    const samples = series([10, 11, 9, 10, 11, 9, 10, 13, 13, 13]);
    const r = detectAnomalies("m", samples);
    expect(r.kind).toBe("drift");
    expect(r.severity).not.toBe("info");
  });

  it("severity escalates with z", () => {
    const samples = series([10, 10, 10, 10, 10, 10, 10, 10, 10, 1000]);
    const r = detectAnomalies("m", samples);
    expect(r.severity).toBe("critical");
  });

  it("constant baseline + any deviation still flags spike (no divide-by-zero)", () => {
    const samples = series([5, 5, 5, 5, 5, 5, 5, 5, 5, 6]);
    const r = detectAnomalies("m", samples);
    expect(r.kind).toBe("spike");
  });

  it("baseline order is normalised — earliest samples baseline newer ones", () => {
    // Reversed input should produce the same verdict because we sort.
    const shuffled = series([10, 10, 10, 10, 10, 10, 10, 10, 10, 100]).slice().reverse();
    const r = detectAnomalies("m", shuffled);
    expect(r.kind).toBe("spike");
  });

  it("custom zThreshold can suppress small outliers", () => {
    const samples = series([10, 11, 9, 10, 12, 9, 10, 15]);
    const lenient = detectAnomalies("m", samples, { zThreshold: 8 });
    expect(lenient.kind).toBe("none");
  });

  it("expectedRange brackets the baseline median", () => {
    const r = detectAnomalies("m", series([100, 102, 98, 101, 99, 100, 100, 101]));
    expect(r.expectedRange.lower).toBeLessThanOrEqual(r.baselineStats.median);
    expect(r.expectedRange.upper).toBeGreaterThanOrEqual(r.baselineStats.median);
  });

  it("rationale text mentions baseline + outliers / drift", () => {
    const r = detectAnomalies("m", series([10, 10, 10, 10, 10, 10, 10, 10, 10, 50]));
    expect(r.rationale).toMatch(/baseline/);
    expect(r.rationale).toMatch(/outlier/i);
  });
});
