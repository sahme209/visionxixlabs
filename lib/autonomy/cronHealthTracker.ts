/**
 * Cron self-heal — last-N-tick health tracker.
 *
 * Each cron route records its outcome (`ok` | `errored`) through
 * recordTickOutcome. shouldSkipDueToConsecutiveFailures returns
 * true when the last N (default 3) outcomes are all `errored` —
 * the scheduler skips that tick + fires a Slack alert (deduped by
 * cron name + UTC day).
 *
 * Why in-memory: cron self-heal is a fast-path decision. The
 * permanent audit lives in the OutboundNotificationRecord + the
 * scheduler's own audit. This map only needs to survive long enough
 * to catch a runaway loop.
 *
 * Hard rules:
 *   - Pure: no DB call, no fetch.
 *   - Per-cron bounded buffer (cap 16 entries).
 *   - Tenant-aware key — different tenants don't poison each other's
 *     tick history.
 */

const HISTORY = new Map<string, Array<{ ok: boolean; at: number }>>();
const MAX_PER_KEY = 16;
const FAILURE_THRESHOLD = 3;

export type TickOutcome = "ok" | "errored";

function keyOf(cronName: string, tenantId?: string): string {
  return tenantId ? `${cronName}:${tenantId}` : cronName;
}

export function recordTickOutcome(opts: {
  cronName: string;
  tenantId?: string;
  outcome: TickOutcome;
}): void {
  const key = keyOf(opts.cronName, opts.tenantId);
  const list = HISTORY.get(key) ?? [];
  list.push({ ok: opts.outcome === "ok", at: Date.now() });
  if (list.length > MAX_PER_KEY) list.shift();
  HISTORY.set(key, list);
}

export interface SkipDecision {
  skip: boolean;
  consecutiveFailures: number;
  lastOutcomeAt?: string;
  reason?: string;
}

export function shouldSkipDueToConsecutiveFailures(opts: {
  cronName: string;
  tenantId?: string;
  threshold?: number;
}): SkipDecision {
  const key = keyOf(opts.cronName, opts.tenantId);
  const list = HISTORY.get(key) ?? [];
  const threshold = Math.max(1, opts.threshold ?? FAILURE_THRESHOLD);
  if (list.length < threshold) {
    return { skip: false, consecutiveFailures: list.filter((x) => !x.ok).length };
  }
  // Count consecutive failures from the tail.
  let count = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].ok) break;
    count++;
  }
  if (count >= threshold) {
    return {
      skip: true,
      consecutiveFailures: count,
      lastOutcomeAt: new Date(list[list.length - 1].at).toISOString(),
      reason: `Last ${count} ticks failed. Skipping this tick to prevent runaway alerts.`,
    };
  }
  return { skip: false, consecutiveFailures: count };
}

export interface CronHealthSnapshot {
  cronName: string;
  tenantId?: string;
  total: number;
  failureCount: number;
  successRate: number;
  consecutiveFailures: number;
  lastAt?: string;
}

export function readCronHealth(opts: { cronName: string; tenantId?: string }): CronHealthSnapshot {
  const key = keyOf(opts.cronName, opts.tenantId);
  const list = HISTORY.get(key) ?? [];
  const failureCount = list.filter((x) => !x.ok).length;
  let consecutiveFailures = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].ok) break;
    consecutiveFailures++;
  }
  return {
    cronName: opts.cronName,
    tenantId: opts.tenantId,
    total: list.length,
    failureCount,
    successRate: list.length > 0 ? 1 - failureCount / list.length : 1,
    consecutiveFailures,
    lastAt: list.length > 0 ? new Date(list[list.length - 1].at).toISOString() : undefined,
  };
}

export function clearCronHealth(): number {
  const n = HISTORY.size;
  HISTORY.clear();
  return n;
}
