/**
 * Pure data-engineer query-plan analyzer.
 *
 * Folds a simplified explain-plan tree (Postgres / BigQuery / Snowflake
 * style) into a typed report flagging:
 *   - sequential scans on large tables
 *   - missing index hints
 *   - high estimated row counts vs. actual
 *   - nested-loop joins above a row-count threshold
 *
 * Pure / deterministic. The caller is responsible for parsing the
 * vendor-specific explain output into our normalized node shape.
 */

export type PlanNodeKind =
  | "seq_scan"
  | "index_scan"
  | "index_only_scan"
  | "bitmap_heap_scan"
  | "nested_loop"
  | "hash_join"
  | "merge_join"
  | "sort"
  | "aggregate"
  | "limit"
  | "other";

export interface PlanNode {
  kind: PlanNodeKind;
  relation?: string;        // table name when applicable
  estRows: number;
  actualRows?: number;      // when EXPLAIN ANALYZE
  costMs: number;           // wall time in ms
  children?: readonly PlanNode[];
}

export interface PlanFinding {
  kind:
    | "seq_scan_on_large_table"
    | "missing_index_hint"
    | "row_estimate_off"
    | "expensive_nested_loop"
    | "sort_spill_likely";
  detail: string;
  severity: "info" | "warn" | "fail";
}

export interface PlanReport {
  totalCostMs: number;
  findings: PlanFinding[];
  /** Overall verdict for the cockpit. */
  verdict: "ok" | "warn" | "fail";
}

export interface AnalyzePlanOptions {
  /** Tables larger than this estimate row count get the seq-scan flag. */
  largeTableThreshold?: number;
  /** Cost (ms) above which a nested loop is considered expensive. */
  nestedLoopExpensiveMs?: number;
  /** Ratio above which est vs actual row mismatch is flagged. */
  rowMismatchRatio?: number;
}

function walkPlan(node: PlanNode, visit: (n: PlanNode) => void): void {
  visit(node);
  for (const c of node.children ?? []) walkPlan(c, visit);
}

function sumCost(node: PlanNode): number {
  let s = node.costMs;
  for (const c of node.children ?? []) s += sumCost(c);
  return s;
}

const rankSev = (rows: readonly PlanFinding[]): PlanReport["verdict"] => {
  if (rows.some((r) => r.severity === "fail")) return "fail";
  if (rows.some((r) => r.severity === "warn")) return "warn";
  return "ok";
};

export function analyzeQueryPlan(plan: PlanNode, opts?: AnalyzePlanOptions): PlanReport {
  const largeTableThreshold = Math.max(1, opts?.largeTableThreshold ?? 100_000);
  const nestedLoopExpensiveMs = Math.max(1, opts?.nestedLoopExpensiveMs ?? 100);
  const rowMismatchRatio = Math.max(1.5, opts?.rowMismatchRatio ?? 3);

  const findings: PlanFinding[] = [];

  walkPlan(plan, (n) => {
    if (n.kind === "seq_scan" && n.estRows >= largeTableThreshold) {
      findings.push({
        kind: "seq_scan_on_large_table",
        severity: "warn",
        detail: `Seq scan on ${n.relation ?? "(unknown)"} (estRows=${n.estRows.toLocaleString()})`,
      });
    }
    if (n.kind === "seq_scan" && n.relation && n.estRows < largeTableThreshold && n.estRows >= 10_000) {
      findings.push({
        kind: "missing_index_hint",
        severity: "info",
        detail: `Seq scan on ${n.relation} (estRows=${n.estRows.toLocaleString()}) — consider an index`,
      });
    }
    if (n.kind === "nested_loop" && n.costMs >= nestedLoopExpensiveMs) {
      findings.push({
        kind: "expensive_nested_loop",
        severity: "warn",
        detail: `Nested-loop join cost ${n.costMs}ms ≥ ${nestedLoopExpensiveMs}ms`,
      });
    }
    if (typeof n.actualRows === "number" && n.estRows > 0) {
      const ratio = n.actualRows / n.estRows;
      const inverse = n.estRows / Math.max(1, n.actualRows);
      const offBy = Math.max(ratio, inverse);
      if (offBy >= rowMismatchRatio) {
        findings.push({
          kind: "row_estimate_off",
          severity: "info",
          detail: `est=${n.estRows} actual=${n.actualRows} (off by ${offBy.toFixed(1)}×) on ${n.relation ?? n.kind}`,
        });
      }
    }
    if (n.kind === "sort" && n.estRows >= largeTableThreshold) {
      findings.push({
        kind: "sort_spill_likely",
        severity: "warn",
        detail: `Sort over ${n.estRows.toLocaleString()} rows — likely to spill to disk`,
      });
    }
  });

  return {
    totalCostMs: sumCost(plan),
    findings,
    verdict: rankSev(findings),
  };
}
