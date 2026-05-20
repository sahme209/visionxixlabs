/**
 * Vitest unit tests for the pure QA visual-regression bookkeeper.
 */

import { describe, it, expect } from "vitest";
import { buildRegressionReport, type SnapshotDiff } from "../visualRegressionBookkeeper";

const D = (id: string, label: string, diffRatio: number, isNew = false, approvedFingerprint: string | null = null, currentFingerprint = "fp-current"): SnapshotDiff =>
  ({ id, label, diffRatio, isNew, approvedFingerprint, currentFingerprint });

describe("visualRegressionBookkeeper", () => {
  it("empty input → ok verdict, zero totals", () => {
    const r = buildRegressionReport([]);
    expect(r.verdict).toBe("ok");
    expect(r.totals).toEqual({ new: 0, unchanged: 0, changed: 0, approved: 0 });
  });

  it("under threshold → unchanged", () => {
    const r = buildRegressionReport([D("a", "Home", 0.0005)]);
    expect(r.rows[0].status).toBe("unchanged");
    expect(r.verdict).toBe("ok");
  });

  it("above threshold → changed + fail verdict", () => {
    const r = buildRegressionReport([D("a", "Home", 0.05)]);
    expect(r.rows[0].status).toBe("changed");
    expect(r.verdict).toBe("fail");
  });

  it("isNew → new + warn verdict by default", () => {
    const r = buildRegressionReport([D("a", "NewPage", 0, true)]);
    expect(r.rows[0].status).toBe("new");
    expect(r.verdict).toBe("warn");
  });

  it("treatNewAsBlocking=true escalates new → fail", () => {
    const r = buildRegressionReport([D("a", "NewPage", 0, true)], { treatNewAsBlocking: true });
    expect(r.verdict).toBe("fail");
  });

  it("approved fingerprint match → approved + ok", () => {
    const r = buildRegressionReport([D("a", "Home", 0.05, false, "fp-current", "fp-current")]);
    expect(r.rows[0].status).toBe("approved");
    expect(r.verdict).toBe("ok");
  });

  it("approved fingerprint mismatch → changed", () => {
    const r = buildRegressionReport([D("a", "Home", 0.05, false, "fp-old", "fp-new")]);
    expect(r.rows[0].status).toBe("changed");
  });

  it("rows sorted changed → new → approved → unchanged", () => {
    const r = buildRegressionReport([
      D("c", "Clean", 0),
      D("a", "Brand new", 0, true),
      D("b", "Broken", 0.5),
    ]);
    expect(r.rows.map((x) => x.id)).toEqual(["b", "a", "c"]);
  });

  it("custom changedThreshold honored", () => {
    const r = buildRegressionReport([D("a", "Home", 0.005)], { changedThreshold: 0.01 });
    expect(r.rows[0].status).toBe("unchanged");
  });

  it("approvedCount tallies approved status", () => {
    const r = buildRegressionReport([
      D("a", "x", 0.05, false, "fp-current", "fp-current"),
      D("b", "y", 0.05, false, "fp-current", "fp-current"),
    ]);
    expect(r.approvedCount).toBe(2);
  });
});
