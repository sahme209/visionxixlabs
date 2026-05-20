/**
 * Pure customer success health-score builder.
 *
 * Folds tenant signals (usage activity, ticket volume, NPS responses,
 * billing health, time-to-first-value) into a 0..100 health score
 * with a verdict tier the CS team can sort + action on.
 *
 * Pure / deterministic.
 */

export interface TenantSignals {
  /** Days since the tenant signed up. */
  tenureDays: number;
  /** Active operators in the last 7 days. */
  weeklyActiveOperators: number;
  /** Total operators on the workspace. */
  totalOperators: number;
  /** Tickets opened in the last 30 days. */
  ticketsLast30d: number;
  /** Tickets *closed* with bad-CSAT in last 30 days. */
  badCsatTicketsLast30d: number;
  /** Latest NPS score (-100..100), null if never collected. */
  latestNps: number | null;
  /** True iff most-recent invoice paid on time. */
  invoicesPaidOnTime: boolean;
  /** True iff the tenant completed onboarding milestones. */
  onboardingComplete: boolean;
}

export interface HealthBreakdown {
  factor: string;
  delta: number;
  note: string;
}

export interface HealthScore {
  score: number;                  // 0..100, higher = healthier
  tier: "green" | "yellow" | "red";
  breakdown: HealthBreakdown[];
}

const clampScore = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

export function buildHealthScore(signals: TenantSignals): HealthScore {
  const breakdown: HealthBreakdown[] = [];
  let score = 50;

  // --- Activity (max +30 / min −30) ---
  const usageRatio = signals.totalOperators === 0 ? 0 : signals.weeklyActiveOperators / signals.totalOperators;
  if (usageRatio >= 0.6) {
    score += 30; breakdown.push({ factor: "high_active_ratio", delta: 30, note: `${(usageRatio * 100).toFixed(0)}% active` });
  } else if (usageRatio >= 0.25) {
    score += 10; breakdown.push({ factor: "moderate_active_ratio", delta: 10, note: `${(usageRatio * 100).toFixed(0)}% active` });
  } else if (signals.weeklyActiveOperators === 0) {
    score -= 30; breakdown.push({ factor: "zero_activity", delta: -30, note: "no active operators last 7d" });
  } else {
    score -= 10; breakdown.push({ factor: "low_active_ratio", delta: -10, note: `${(usageRatio * 100).toFixed(0)}% active` });
  }

  // --- Ticket signal (max −25) ---
  if (signals.ticketsLast30d > 20) {
    score -= 15; breakdown.push({ factor: "heavy_ticket_volume", delta: -15, note: `${signals.ticketsLast30d} tickets / 30d` });
  } else if (signals.ticketsLast30d > 8) {
    score -= 5; breakdown.push({ factor: "moderate_ticket_volume", delta: -5, note: `${signals.ticketsLast30d} tickets / 30d` });
  }
  if (signals.badCsatTicketsLast30d > 0) {
    const delta = -Math.min(10, signals.badCsatTicketsLast30d * 3);
    score += delta;
    breakdown.push({ factor: "bad_csat", delta, note: `${signals.badCsatTicketsLast30d} bad-CSAT ticket(s)` });
  }

  // --- NPS (max ±15) ---
  if (signals.latestNps !== null) {
    if (signals.latestNps >= 50)      { score += 15; breakdown.push({ factor: "promoter_nps", delta: 15, note: `NPS=${signals.latestNps}` }); }
    else if (signals.latestNps >= 0)  { score += 5;  breakdown.push({ factor: "passive_nps", delta: 5, note: `NPS=${signals.latestNps}` }); }
    else                              { score -= 15; breakdown.push({ factor: "detractor_nps", delta: -15, note: `NPS=${signals.latestNps}` }); }
  }

  // --- Billing (±10) ---
  if (signals.invoicesPaidOnTime) {
    score += 5; breakdown.push({ factor: "invoices_on_time", delta: 5, note: "" });
  } else {
    score -= 10; breakdown.push({ factor: "invoice_late", delta: -10, note: "" });
  }

  // --- Onboarding (±5) ---
  if (signals.onboardingComplete) {
    score += 5; breakdown.push({ factor: "onboarding_done", delta: 5, note: "" });
  } else if (signals.tenureDays > 14) {
    score -= 10; breakdown.push({ factor: "onboarding_stuck", delta: -10, note: `${signals.tenureDays}d tenure without completion` });
  }

  const finalScore = clampScore(score);
  const tier: HealthScore["tier"] = finalScore >= 70 ? "green" : finalScore >= 40 ? "yellow" : "red";

  return { score: finalScore, tier, breakdown };
}
