/**
 * Connector health kernel — Phase 407.
 *
 * Pure, deterministic function of telemetry → closed-union health
 * status. Same inputs always yield the same output; no clocks, no I/O,
 * no Prisma. Unit-tested against a fixture set so changes to the
 * thresholds are visible in PR review.
 *
 * Why a closed union:
 *   - The API surface, the dashboard badge color, the audit detail
 *     field, and the alert-threshold cron all narrow on the same five
 *     members. A typo in any of them is a compile error rather than a
 *     silent drift between surfaces.
 *
 * Status priority (first match wins on tie):
 *   1. auth_failed     — connector can't authenticate at all.
 *   2. rate_limited    — provider is throttling us hard right now.
 *   3. stale           — last successful sync older than the staleness
 *                        window for that connector's category.
 *   4. degraded        — recent error ratio over `degradedRatioThreshold`
 *                        in the recent window.
 *   5. healthy         — everything within bounds.
 */

export type ConnectorHealthStatus =
  | "healthy"
  | "degraded"
  | "stale"
  | "auth_failed"
  | "rate_limited";

/** Closed-union — same set used in lib/demo/technicalReference.ts CONNECTORS. */
export type ConnectorCategory = "cloud" | "vcs" | "db" | "monitoring" | "ide";

/** Telemetry the kernel takes as input. Only data we can compute deterministically. */
export interface ConnectorTelemetry {
  /** When the last successful read happened. null = never synced. */
  lastSuccessfulSyncAt: Date | null;
  /** Successful sync count in the recent window. */
  recentSuccessCount: number;
  /** Failed sync count in the recent window. */
  recentErrorCount: number;
  /** True if the most recent auth probe rejected our credentials. */
  authFailed: boolean;
  /** True if a 429 / quota / "Throttling" response landed within the rate-limit cooldown. */
  rateLimitedNow: boolean;
  /** Connector category — controls staleness window. */
  category: ConnectorCategory;
}

/** Tunable per-call thresholds. Defaults match production today. */
export interface HealthThresholds {
  /** Below this success-vs-total ratio, status is `degraded`. Default 0.85. */
  degradedRatioThreshold: number;
  /** Minimum sample size before the ratio test kicks in. Default 5. */
  minRecentSamples: number;
  /** Staleness window per category (ms). */
  stalenessWindowMs: Record<ConnectorCategory, number>;
}

export const DEFAULT_THRESHOLDS: HealthThresholds = {
  degradedRatioThreshold: 0.85,
  minRecentSamples: 5,
  stalenessWindowMs: {
    // Cloud providers: continuous; stale after 30 min.
    cloud:      30 * 60 * 1000,
    // VCS (GitHub etc): webhook + 10 min poll fallback.
    vcs:        10 * 60 * 1000,
    // Databases: read every 5 min.
    db:          5 * 60 * 1000,
    // Monitoring: pushed inbound, but we still expect a heartbeat every 15 min.
    monitoring: 15 * 60 * 1000,
    // IDE: not auto-synced; staleness doesn't apply (effectively infinite).
    ide:         Number.MAX_SAFE_INTEGER,
  },
};

export interface ConnectorHealthResult {
  status: ConnectorHealthStatus;
  /** Operator-readable explanation. Stable for the same inputs. */
  reason: string;
  /** Stage that fired (matches the priority list above). For audit + tests. */
  stage: "auth" | "rate_limit" | "staleness" | "ratio" | "ok";
  /** Successes / (successes + errors) in the recent window. null when no samples. */
  successRatio: number | null;
  /** ms since last successful sync. null when never synced. */
  ageMs: number | null;
}

export function computeConnectorHealth(
  telemetry: ConnectorTelemetry,
  now: Date,
  thresholds: HealthThresholds = DEFAULT_THRESHOLDS,
): ConnectorHealthResult {
  // 1. Auth failure beats everything — without creds the rest is moot.
  if (telemetry.authFailed) {
    return {
      status: "auth_failed",
      reason: "Credentials rejected on the most recent auth probe. Re-pair the connector or rotate the underlying role.",
      stage: "auth",
      successRatio: ratio(telemetry),
      ageMs: ageMs(telemetry, now),
    };
  }

  // 2. Active throttling — surface honestly so operators don't blame the platform.
  if (telemetry.rateLimitedNow) {
    return {
      status: "rate_limited",
      reason: "Provider is throttling our calls right now. The scanner is backing off and will retry on the next window.",
      stage: "rate_limit",
      successRatio: ratio(telemetry),
      ageMs: ageMs(telemetry, now),
    };
  }

  // 3. Staleness. "Never synced" counts as stale unless category is IDE
  //    (which is on-demand and has no expected heartbeat).
  const window = thresholds.stalenessWindowMs[telemetry.category];
  const age = ageMs(telemetry, now);
  if (telemetry.category !== "ide") {
    if (age === null) {
      return {
        status: "stale",
        reason: "No successful sync yet. The initial scan hasn't completed.",
        stage: "staleness",
        successRatio: ratio(telemetry),
        ageMs: null,
      };
    }
    if (age > window) {
      return {
        status: "stale",
        reason: `Last successful sync was ${formatAge(age)} ago (window for ${telemetry.category}: ${formatAge(window)}).`,
        stage: "staleness",
        successRatio: ratio(telemetry),
        ageMs: age,
      };
    }
  }

  // 4. Degraded — only when we have enough samples to trust the ratio.
  const total = telemetry.recentSuccessCount + telemetry.recentErrorCount;
  if (total >= thresholds.minRecentSamples) {
    const r = telemetry.recentSuccessCount / total;
    if (r < thresholds.degradedRatioThreshold) {
      return {
        status: "degraded",
        reason: `Recent success ratio ${(r * 100).toFixed(1)}% is below the ${(thresholds.degradedRatioThreshold * 100).toFixed(0)}% threshold (${telemetry.recentErrorCount}/${total} failures).`,
        stage: "ratio",
        successRatio: r,
        ageMs: age,
      };
    }
  }

  // 5. Healthy.
  return {
    status: "healthy",
    reason: "Connector is syncing successfully.",
    stage: "ok",
    successRatio: ratio(telemetry),
    ageMs: age,
  };
}

function ratio(t: ConnectorTelemetry): number | null {
  const total = t.recentSuccessCount + t.recentErrorCount;
  if (total === 0) return null;
  return t.recentSuccessCount / total;
}

function ageMs(t: ConnectorTelemetry, now: Date): number | null {
  if (t.lastSuccessfulSyncAt === null) return null;
  return Math.max(0, now.getTime() - t.lastSuccessfulSyncAt.getTime());
}

function formatAge(ms: number): string {
  if (ms < 60_000)      return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000)   return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000)  return `${Math.round(ms / 3_600_000)}h`;
  return `${Math.round(ms / 86_400_000)}d`;
}
