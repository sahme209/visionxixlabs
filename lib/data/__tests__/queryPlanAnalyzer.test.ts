/**
 * Vitest unit tests for the pure query plan analyzer.
 */

import { describe, it, expect } from "vitest";
import { analyzeQueryPlan, type PlanNode } from "../queryPlanAnalyzer";

const NODE = (kind: PlanNode["kind"], estRows: number, costMs = 1, relation?: string, children?: PlanNode[], actualRows?: number): PlanNode =>
  ({ kind, estRows, costMs, relation, children, actualRows });

describe("queryPlanAnalyzer", () => {
  it("trivial plan with index scan → ok verdict", () => {
    const r = analyzeQueryPlan(NODE("index_scan", 100, 1, "users"));
    expect(r.verdict).toBe("ok");
    expect(r.findings.length).toBe(0);
  });

  it("seq scan on large table → seq_scan_on_large_table + warn", () => {
    const r = analyzeQueryPlan(NODE("seq_scan", 5_000_000, 50, "events"));
    expect(r.findings.some((f) => f.kind === "seq_scan_on_large_table")).toBe(true);
    expect(r.verdict).toBe("warn");
  });

  it("seq scan on medium table → missing_index_hint info finding only", () => {
    const r = analyzeQueryPlan(NODE("seq_scan", 50_000, 5, "carts"));
    expect(r.findings.some((f) => f.kind === "missing_index_hint")).toBe(true);
    expect(r.verdict).toBe("ok"); // info doesn't escalate
  });

  it("nested loop above cost threshold → expensive_nested_loop", () => {
    const r = analyzeQueryPlan(NODE("nested_loop", 1_000, 250, "(join)"));
    expect(r.findings.some((f) => f.kind === "expensive_nested_loop")).toBe(true);
    expect(r.verdict).toBe("warn");
  });

  it("row estimate mismatch flagged via actualRows", () => {
    const r = analyzeQueryPlan(NODE("index_scan", 100, 1, "users", undefined, 10_000));
    expect(r.findings.some((f) => f.kind === "row_estimate_off")).toBe(true);
  });

  it("totalCostMs sums recursively", () => {
    const r = analyzeQueryPlan(NODE("aggregate", 100, 10, undefined, [
      NODE("index_scan", 100, 5, "a"),
      NODE("index_scan", 100, 7, "b"),
    ]));
    expect(r.totalCostMs).toBe(10 + 5 + 7);
  });

  it("sort on large rowset → sort_spill_likely", () => {
    const r = analyzeQueryPlan(NODE("sort", 500_000, 100));
    expect(r.findings.some((f) => f.kind === "sort_spill_likely")).toBe(true);
  });

  it("options override threshold defaults", () => {
    const r = analyzeQueryPlan(NODE("seq_scan", 1_000, 1, "events"), {
      largeTableThreshold: 500,
    });
    expect(r.findings.some((f) => f.kind === "seq_scan_on_large_table")).toBe(true);
  });

  it("walks children recursively", () => {
    const r = analyzeQueryPlan(NODE("aggregate", 1, 1, undefined, [
      NODE("nested_loop", 1_000, 200, undefined, [
        NODE("seq_scan", 5_000_000, 100, "events"),
      ]),
    ]));
    const kinds = r.findings.map((f) => f.kind);
    expect(kinds).toContain("seq_scan_on_large_table");
    expect(kinds).toContain("expensive_nested_loop");
  });
});
