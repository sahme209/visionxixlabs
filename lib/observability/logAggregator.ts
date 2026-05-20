/**
 * Pure observability log aggregator.
 *
 * Folds a flat stream of structured log records into per-service
 * rollups: error rate, top error fingerprints (grouped by message
 * prefix), p50/p95 latency, and a verdict per service. Pure /
 * deterministic. Caller is responsible for shipping logs into the
 * normalized shape.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogRecord {
  ts: string;             // ISO
  service: string;
  level: LogLevel;
  /** Free-form message; we derive a coarse fingerprint from the prefix. */
  message: string;
  /** Optional request-duration in ms. */
  durationMs?: number;
}

export interface ErrorFingerprintRow {
  fingerprint: string;
  count: number;
  example: string;
}

export interface ServiceLogRow {
  service: string;
  total: number;
  byLevel: Record<LogLevel, number>;
  /** total errors+fatals / total. */
  errorRate: number;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  topErrorFingerprints: ErrorFingerprintRow[];
  verdict: "ok" | "degraded" | "burning";
}

export interface LogAggregateReport {
  windowStart: string | null;
  windowEnd: string | null;
  services: ServiceLogRow[];
}

const FINGERPRINT_PREFIX_CHARS = 60;

function quantile(sorted: readonly number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * q)));
  return sorted[idx];
}

function fingerprintOf(msg: string): string {
  // Collapse identifier-shaped tokens (digits, UUIDs) so messages that
  // differ only by tenant/request/instance id share a fingerprint.
  const collapsed = msg
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, "<uuid>")
    .replace(/\b\d+\b/g, "<n>");
  return collapsed.slice(0, FINGERPRINT_PREFIX_CHARS).trim().toLowerCase();
}

function verdictFor(errorRate: number): ServiceLogRow["verdict"] {
  if (errorRate >= 0.1) return "burning";
  if (errorRate >= 0.02) return "degraded";
  return "ok";
}

const zeroByLevel = (): Record<LogLevel, number> => ({
  debug: 0, info: 0, warn: 0, error: 0, fatal: 0,
});

export function aggregateLogs(records: readonly LogRecord[]): LogAggregateReport {
  type Bucket = {
    total: number;
    byLevel: Record<LogLevel, number>;
    latencies: number[];
    errorPrints: Map<string, { count: number; example: string }>;
  };

  let windowStart: string | null = null;
  let windowEnd: string | null = null;
  const perService = new Map<string, Bucket>();

  for (const r of records) {
    if (windowStart === null || r.ts < windowStart) windowStart = r.ts;
    if (windowEnd === null || r.ts > windowEnd) windowEnd = r.ts;
    const b = perService.get(r.service) ?? {
      total: 0, byLevel: zeroByLevel(), latencies: [], errorPrints: new Map(),
    };
    b.total += 1;
    b.byLevel[r.level] += 1;
    if (typeof r.durationMs === "number" && Number.isFinite(r.durationMs)) {
      b.latencies.push(r.durationMs);
    }
    if (r.level === "error" || r.level === "fatal") {
      const fp = fingerprintOf(r.message);
      const ep = b.errorPrints.get(fp) ?? { count: 0, example: r.message };
      ep.count += 1;
      b.errorPrints.set(fp, ep);
    }
    perService.set(r.service, b);
  }

  const services: ServiceLogRow[] = [];
  for (const [service, b] of perService) {
    const errorCount = b.byLevel.error + b.byLevel.fatal;
    const errorRate = b.total === 0 ? 0 : errorCount / b.total;
    const sortedLatencies = [...b.latencies].sort((a, b) => a - b);
    const top = [...b.errorPrints.entries()]
      .map(([fp, v]) => ({ fingerprint: fp, count: v.count, example: v.example }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    services.push({
      service,
      total: b.total,
      byLevel: b.byLevel,
      errorRate,
      p50LatencyMs: quantile(sortedLatencies, 0.5),
      p95LatencyMs: quantile(sortedLatencies, 0.95),
      topErrorFingerprints: top,
      verdict: verdictFor(errorRate),
    });
  }

  services.sort((a, b) => {
    const rank: Record<ServiceLogRow["verdict"], number> = { burning: 0, degraded: 1, ok: 2 };
    if (rank[a.verdict] !== rank[b.verdict]) return rank[a.verdict] - rank[b.verdict];
    return b.errorRate - a.errorRate;
  });

  return { windowStart, windowEnd, services };
}
