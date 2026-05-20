/**
 * Pure outbound-digest builder.
 *
 * Folds the last N hours of OutboundNotificationRecord rows into a
 * single operator-facing digest: count per kind, count per severity,
 * outcome split, top dedupe groups, and the heaviest correlationIds.
 *
 * Pure — no DB. The route handler does the read.
 */

export type OutboundOutcome = "ok" | "failed" | "skipped";

export interface RawOutboundRow {
  kind: string;
  severity: string;
  outcome: string;
  dedupeKey: string;
  correlationId: string | null;
  createdAt: string;
}

export interface KindCount { kind: string; count: number; failed: number }
export interface SeverityCount { severity: string; count: number }
export interface DigestReport {
  totalEvents: number;
  windowStart: string | null;
  windowEnd: string | null;
  outcomes: { ok: number; failed: number; skipped: number };
  byKind: KindCount[];
  bySeverity: SeverityCount[];
  topDedupeGroups: Array<{ dedupeKey: string; count: number }>;
  topCorrelationIds: Array<{ correlationId: string; count: number }>;
}

const OUTCOMES = new Set<OutboundOutcome>(["ok", "failed", "skipped"]);

const inc = <K>(m: Map<K, number>, key: K): void => {
  m.set(key, (m.get(key) ?? 0) + 1);
};

export function buildOutboundDigest(rows: readonly RawOutboundRow[]): DigestReport {
  let earliest: string | null = null;
  let latest: string | null = null;

  const outcomes = { ok: 0, failed: 0, skipped: 0 };
  const perKind = new Map<string, { count: number; failed: number }>();
  const perSeverity = new Map<string, number>();
  const perDedupe = new Map<string, number>();
  const perCorr = new Map<string, number>();

  for (const r of rows) {
    if (earliest === null || r.createdAt < earliest) earliest = r.createdAt;
    if (latest === null || r.createdAt > latest) latest = r.createdAt;

    if (OUTCOMES.has(r.outcome as OutboundOutcome)) outcomes[r.outcome as OutboundOutcome] += 1;

    const k = perKind.get(r.kind) ?? { count: 0, failed: 0 };
    k.count += 1;
    if (r.outcome === "failed") k.failed += 1;
    perKind.set(r.kind, k);

    inc(perSeverity, r.severity);
    inc(perDedupe, r.dedupeKey);
    if (r.correlationId) inc(perCorr, r.correlationId);
  }

  const byKind = [...perKind.entries()].map(([kind, v]) => ({ kind, count: v.count, failed: v.failed }))
    .sort((a, b) => b.count - a.count);
  const bySeverity = [...perSeverity.entries()].map(([severity, count]) => ({ severity, count }))
    .sort((a, b) => b.count - a.count);
  const topDedupeGroups = [...perDedupe.entries()].map(([dedupeKey, count]) => ({ dedupeKey, count }))
    .sort((a, b) => b.count - a.count).slice(0, 10);
  const topCorrelationIds = [...perCorr.entries()].map(([correlationId, count]) => ({ correlationId, count }))
    .sort((a, b) => b.count - a.count).slice(0, 10);

  return {
    totalEvents: rows.length,
    windowStart: earliest,
    windowEnd: latest,
    outcomes,
    byKind,
    bySeverity,
    topDedupeGroups,
    topCorrelationIds,
  };
}
