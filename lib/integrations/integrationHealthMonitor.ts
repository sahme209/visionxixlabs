/**
 * Pure tenant-integration health monitor.
 *
 * Folds the last N send attempts per integration (Slack / Teams /
 * Outlook / Gmail) into a per-integration health verdict the
 * operator-facing dashboard renders. Pure / deterministic.
 */

export type IntegrationName = "slack" | "teams" | "outlook" | "gmail" | "pagerduty" | "webhook_generic";

export interface IntegrationAttempt {
  integration: IntegrationName;
  /** ISO when the send completed. */
  endedAtIso: string;
  ok: boolean;
  latencyMs: number;
  errorKind?: string;
}

export interface IntegrationHealthRow {
  integration: IntegrationName;
  total: number;
  failures: number;
  /** 0..1 share that succeeded. */
  successRate: number;
  avgLatencyMs: number;
  /** Latest ISO ts seen for this integration. */
  lastAttemptAt: string | null;
  /** Latest errorKind observed (when most recent attempt failed). */
  lastErrorKind?: string;
  verdict: "operational" | "degraded" | "down" | "idle";
}

export interface IntegrationHealthReport {
  rows: IntegrationHealthRow[];
  overall: "operational" | "degraded" | "down";
}

function verdictOf(successRate: number, total: number): IntegrationHealthRow["verdict"] {
  if (total === 0) return "idle";
  if (successRate >= 0.95) return "operational";
  if (successRate >= 0.6) return "degraded";
  return "down";
}

function overallOf(rows: readonly IntegrationHealthRow[]): IntegrationHealthReport["overall"] {
  if (rows.some((r) => r.verdict === "down")) return "down";
  if (rows.some((r) => r.verdict === "degraded")) return "degraded";
  return "operational";
}

export function buildIntegrationHealth(attempts: readonly IntegrationAttempt[]): IntegrationHealthReport {
  type Acc = { total: number; failures: number; latencySum: number; lastAttempt: string | null; lastErrorKind: string | undefined };
  const buckets = new Map<IntegrationName, Acc>();

  for (const a of attempts) {
    const b = buckets.get(a.integration) ?? { total: 0, failures: 0, latencySum: 0, lastAttempt: null, lastErrorKind: undefined };
    b.total += 1;
    b.latencySum += a.latencyMs;
    if (!a.ok) b.failures += 1;
    if (b.lastAttempt === null || a.endedAtIso > b.lastAttempt) {
      b.lastAttempt = a.endedAtIso;
      b.lastErrorKind = a.ok ? undefined : a.errorKind;
    }
    buckets.set(a.integration, b);
  }

  const rows: IntegrationHealthRow[] = [...buckets.entries()].map(([integration, v]) => {
    const successRate = v.total === 0 ? 0 : (v.total - v.failures) / v.total;
    return {
      integration,
      total: v.total,
      failures: v.failures,
      successRate,
      avgLatencyMs: v.total === 0 ? 0 : Math.round(v.latencySum / v.total),
      lastAttemptAt: v.lastAttempt,
      lastErrorKind: v.lastErrorKind,
      verdict: verdictOf(successRate, v.total),
    };
  });

  rows.sort((a, b) => {
    const rank: Record<IntegrationHealthRow["verdict"], number> = { down: 0, degraded: 1, idle: 2, operational: 3 };
    if (rank[a.verdict] !== rank[b.verdict]) return rank[a.verdict] - rank[b.verdict];
    return a.integration < b.integration ? -1 : 1;
  });

  return { rows, overall: overallOf(rows) };
}
