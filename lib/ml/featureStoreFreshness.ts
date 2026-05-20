/**
 * Pure ML feature-store freshness tracker.
 *
 * For each registered feature, compare last-refreshed timestamp to a
 * declared SLA (e.g. "must refresh every 6h"). Flag stale features +
 * the ones that recently spiked their refresh latency.
 *
 * Pure / deterministic.
 */

export interface FeatureRecord {
  name: string;
  /** Operator-readable owner (team or service). */
  owner: string;
  /** SLA in hours. */
  slaHours: number;
  /** Last successful refresh, ISO timestamp. */
  lastRefreshedAtIso: string;
  /** Last refresh duration in ms (optional). */
  lastRefreshDurationMs?: number;
  /** Historical mean refresh duration in ms (optional, for spike detection). */
  meanRefreshDurationMs?: number;
}

export interface FreshnessRow {
  name: string;
  owner: string;
  hoursSinceRefresh: number;
  slaHours: number;
  status: "fresh" | "warn_near_sla" | "stale";
  /** True iff last duration ≥ 2× mean. */
  slowRefresh: boolean;
  /** Ratio of last vs mean (Infinity when mean=0/missing and last>0). */
  durationRatio: number | null;
}

export interface FreshnessReport {
  rows: FreshnessRow[];
  totals: { fresh: number; warn_near_sla: number; stale: number };
  overall: "ok" | "warn" | "fail";
}

const HOUR_MS = 60 * 60 * 1000;
const WARN_FRACTION = 0.8;
const SLOW_RATIO = 2;

function statusOf(hoursSince: number, slaHours: number): FreshnessRow["status"] {
  if (hoursSince >= slaHours) return "stale";
  if (hoursSince >= slaHours * WARN_FRACTION) return "warn_near_sla";
  return "fresh";
}

function overallOf(totals: FreshnessReport["totals"]): FreshnessReport["overall"] {
  if (totals.stale > 0) return "fail";
  if (totals.warn_near_sla > 0) return "warn";
  return "ok";
}

export function trackFeatureFreshness(input: {
  features: readonly FeatureRecord[];
  nowIso?: string;
}): FreshnessReport {
  const now = input.nowIso ? new Date(input.nowIso) : new Date();
  const rows: FreshnessRow[] = [];
  const totals = { fresh: 0, warn_near_sla: 0, stale: 0 };

  for (const f of input.features) {
    const last = new Date(f.lastRefreshedAtIso);
    const hoursSinceRefresh = Math.max(0, (now.getTime() - last.getTime()) / HOUR_MS);
    const status = statusOf(hoursSinceRefresh, Math.max(0.1, f.slaHours));

    let durationRatio: number | null = null;
    if (typeof f.lastRefreshDurationMs === "number") {
      if (typeof f.meanRefreshDurationMs === "number" && f.meanRefreshDurationMs > 0) {
        durationRatio = f.lastRefreshDurationMs / f.meanRefreshDurationMs;
      } else if (f.lastRefreshDurationMs > 0) {
        durationRatio = Infinity;
      } else {
        durationRatio = 0;
      }
    }
    const slowRefresh = typeof durationRatio === "number" && durationRatio >= SLOW_RATIO;

    rows.push({
      name: f.name,
      owner: f.owner,
      hoursSinceRefresh: Math.round(hoursSinceRefresh * 10) / 10,
      slaHours: f.slaHours,
      status,
      slowRefresh,
      durationRatio,
    });
    totals[status] += 1;
  }

  rows.sort((a, b) => {
    const rank: Record<FreshnessRow["status"], number> = { stale: 0, warn_near_sla: 1, fresh: 2 };
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return b.hoursSinceRefresh - a.hoursSinceRefresh;
  });

  return { rows, totals, overall: overallOf(totals) };
}
