/**
 * Path to a $2B company (pure). Uses only recorded revenue: recurring plans at list price plus money
 * collected in the last 30 days, both annualised. A $2B valuation is taken as 20x annual revenue,
 * so the goal is $100M annual run-rate; the multiple is shown, not hidden.
 */
export const VALUATION_GOAL_CENTS = 200_000_000_000; // $2B
export const REVENUE_MULTIPLE = 20;
export const ARR_GOAL_CENTS = VALUATION_GOAL_CENTS / REVENUE_MULTIPLE; // $100M
export const MILESTONES_CENTS = [100_000_000, 1_000_000_000, 10_000_000_000, ARR_GOAL_CENTS]; // $1M, $10M, $100M ARR

export interface GrowthInput { mrrListCents: number; last30Cents: number; previous30Cents: number; paidWorkspaces: number; activeWorkspaces: number; aiCostCents: number; aiBilledCents: number }
export interface GrowthPlan {
  arrCents: number;
  /** Month-on-month growth of collected revenue, as a fraction; null when the month before had none. */
  monthlyGrowth: number | null;
  /** Monthly growth needed to reach the goal in 5 years; null with no revenue yet. */
  neededMonthlyGrowth5y: number | null;
  milestones: Array<{ arrCents: number; reached: boolean; monthsAtCurrentGrowth: number | null }>;
  progressPct: number;
  arpaMonthlyCents: number | null;
  aiCostPerActiveWorkspaceCents: number | null;
  aiGrossMarginPct: number | null;
}

export function growthPlan(i: GrowthInput): GrowthPlan {
  const monthlyRun = Math.max(0, i.mrrListCents) + Math.max(0, i.last30Cents);
  const arrCents = monthlyRun * 12;
  const monthlyGrowth = i.previous30Cents > 0 ? (i.last30Cents - i.previous30Cents) / i.previous30Cents : null;
  const monthsTo = (target: number): number | null => {
    if (arrCents >= target) return 0;
    if (arrCents <= 0 || monthlyGrowth === null || monthlyGrowth <= 0) return null;
    return Math.ceil(Math.log(target / arrCents) / Math.log(1 + monthlyGrowth));
  };
  return {
    arrCents,
    monthlyGrowth,
    neededMonthlyGrowth5y: arrCents > 0 && arrCents < ARR_GOAL_CENTS ? Math.pow(ARR_GOAL_CENTS / arrCents, 1 / 60) - 1 : arrCents >= ARR_GOAL_CENTS ? 0 : null,
    milestones: MILESTONES_CENTS.map((m) => ({ arrCents: m, reached: arrCents >= m, monthsAtCurrentGrowth: monthsTo(m) })),
    progressPct: Math.min(100, (arrCents / ARR_GOAL_CENTS) * 100),
    arpaMonthlyCents: i.paidWorkspaces > 0 ? Math.round(monthlyRun / i.paidWorkspaces) : null,
    aiCostPerActiveWorkspaceCents: i.activeWorkspaces > 0 ? Math.round(i.aiCostCents / i.activeWorkspaces) : null,
    aiGrossMarginPct: i.aiBilledCents > 0 ? Math.round(((i.aiBilledCents - i.aiCostCents) / i.aiBilledCents) * 100) : null,
  };
}

/** "3 years 4 months", "11 months", "now". */
export function formatMonths(m: number | null): string {
  if (m === null) return "not at the current pace";
  if (m === 0) return "reached";
  const y = Math.floor(m / 12), r = m % 12;
  return [y ? `${y} year${y === 1 ? "" : "s"}` : "", r ? `${r} month${r === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ");
}
