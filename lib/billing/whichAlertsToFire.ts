/**
 * Pure billing-alert trigger — Phase 385.
 *
 * Given a current usage ratio (0..N — uncapped, can exceed 1 on
 * metered_billing plans) and the thresholds that have already fired
 * this period, return the new thresholds to fire.
 *
 * Invariants:
 *   - Thresholds fire in ascending order — you never get a 100%
 *     alert without also having (already or now) a 70% alert.
 *   - Each threshold fires at most once per (workspace, dimension,
 *     period). Re-runs of the cron do not duplicate.
 *   - 70/90/100 are the only thresholds. They map directly to the
 *     EntitlementThreshold tones in lib/billing/checkEntitlement.ts.
 *
 * Lives separate from Prisma so the matrix is unit-testable.
 */

export type AlertThreshold = 70 | 90 | 100;

export const ALERT_THRESHOLDS: ReadonlyArray<AlertThreshold> = [70, 90, 100];

export interface WhichAlertsInput {
  /** Projected utilization ratio: 0..N. */
  currentRatio: number;
  /** Thresholds already fired this period (typically read from BillingAlert). */
  alreadyFired: ReadonlyArray<AlertThreshold>;
}

export function whichAlertsToFire(input: WhichAlertsInput): ReadonlyArray<AlertThreshold> {
  const fired = new Set<AlertThreshold>(input.alreadyFired);
  const out: AlertThreshold[] = [];
  // currentRatio is a float; convert to percentage for comparison with
  // integer thresholds. Use >= so the boundary (exactly 70% / 90% / 100%)
  // fires the alert.
  const percent = Math.max(0, input.currentRatio * 100);
  for (const t of ALERT_THRESHOLDS) {
    if (percent >= t && !fired.has(t)) {
      out.push(t);
    }
  }
  return out;
}
