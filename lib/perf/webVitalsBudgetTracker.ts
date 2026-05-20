/**
 * Pure Web Vitals performance budget tracker.
 *
 * Validates per-route Web Vitals measurements (LCP, CLS, INP, TBT,
 * TTFB) against budgets + Google's "good / needs improvement / poor"
 * thresholds. Returns per-route rows + an overall verdict.
 *
 * Pure / deterministic.
 */

export type VitalName = "lcp" | "cls" | "inp" | "tbt" | "ttfb";

export interface VitalsMeasurement {
  route: string;
  /** ms. */
  lcp: number;
  cls: number;             // unitless
  /** ms. */
  inp: number;
  /** ms. */
  tbt: number;
  /** ms. */
  ttfb: number;
}

export interface VitalBudget {
  /** "Good" threshold (≤). */
  good: number;
  /** "Poor" threshold (>). Anything between good and poor is "needs improvement". */
  poor: number;
}

export interface PerfBudgetOptions {
  budgets?: Partial<Record<VitalName, VitalBudget>>;
}

/** Google Web Vitals thresholds (May 2024 — INP replaced FID). */
export const DEFAULT_BUDGETS: Record<VitalName, VitalBudget> = {
  lcp:  { good: 2500, poor: 4000 },
  cls:  { good: 0.1,  poor: 0.25 },
  inp:  { good: 200,  poor: 500  },
  tbt:  { good: 200,  poor: 600  },
  ttfb: { good: 800,  poor: 1800 },
};

export type VitalStatus = "good" | "needs_improvement" | "poor";

export interface VitalCell {
  name: VitalName;
  value: number;
  status: VitalStatus;
}

export interface RouteVitalsRow {
  route: string;
  cells: VitalCell[];
  /** Worst-status across all cells. */
  status: VitalStatus;
}

export interface PerfBudgetReport {
  rows: RouteVitalsRow[];
  overall: VitalStatus;
  /** Count of routes per status. */
  totals: Record<VitalStatus, number>;
}

function statusFor(value: number, budget: VitalBudget): VitalStatus {
  if (value <= budget.good) return "good";
  if (value > budget.poor) return "poor";
  return "needs_improvement";
}

const STATUS_RANK: Record<VitalStatus, number> = { good: 0, needs_improvement: 1, poor: 2 };

function worstStatus(cells: readonly VitalCell[]): VitalStatus {
  return cells.reduce<VitalStatus>((acc, c) => STATUS_RANK[c.status] > STATUS_RANK[acc] ? c.status : acc, "good");
}

export function trackWebVitals(input: {
  measurements: readonly VitalsMeasurement[];
  options?: PerfBudgetOptions;
}): PerfBudgetReport {
  const budgets: Record<VitalName, VitalBudget> = { ...DEFAULT_BUDGETS, ...(input.options?.budgets ?? {}) };
  const rows: RouteVitalsRow[] = input.measurements.map((m) => {
    const cells: VitalCell[] = (Object.keys(budgets) as VitalName[]).map((name) => ({
      name,
      value: m[name],
      status: statusFor(m[name], budgets[name]),
    }));
    return { route: m.route, cells, status: worstStatus(cells) };
  });
  rows.sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status] || (a.route < b.route ? -1 : 1));

  const totals: Record<VitalStatus, number> = { good: 0, needs_improvement: 0, poor: 0 };
  for (const r of rows) totals[r.status] += 1;

  const overall: VitalStatus = rows.length === 0 ? "good" : worstStatus(rows.map((r) => ({ name: "lcp", value: 0, status: r.status })));

  return { rows, overall, totals };
}
