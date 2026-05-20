/**
 * Pure cost-anomaly attributor.
 *
 * Given daily per-(service, tag) spend, identify lines where today's
 * spend is materially above the rolling-window average for that line.
 * Returns ranked attribution rows the operator can chase down.
 *
 * Pure / deterministic. No DB.
 */

export interface DailyLine {
  dateKey: string;       // YYYY-MM-DD
  service: string;
  tag: string;           // e.g. "cost_center:marketing" or "(none)"
  spendUSD: number;
}

export interface AttributionRow {
  service: string;
  tag: string;
  todaySpend: number;
  baselineAverage: number;
  deltaUsd: number;
  deltaPct: number;
  severity: "ok" | "watch" | "high";
}

export interface AttributionReport {
  todayKey: string;
  baselineDays: number;
  rows: AttributionRow[];
  topOffenders: AttributionRow[];
}

const meanOf = (xs: readonly number[]): number => {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
};

export function attributeCostAnomalies(input: {
  todayKey: string;
  daily: readonly DailyLine[];
  /** Days of baseline (excluding today). Default 7. */
  baselineDays?: number;
  /** Minimum % above baseline before flagging. Default 25. */
  flagThresholdPct?: number;
  /** Minimum $ delta before flagging. Default 50. */
  flagThresholdUsd?: number;
}): AttributionReport {
  const baselineDays = Math.max(1, input.baselineDays ?? 7);
  const flagPct = Math.max(0, input.flagThresholdPct ?? 25);
  const flagUsd = Math.max(0, input.flagThresholdUsd ?? 50);
  const todayKey = input.todayKey;

  // Build a key -> { today, history[] } map.
  type Bucket = { today: number; history: number[] };
  const buckets = new Map<string, Bucket>();

  for (const line of input.daily) {
    const k = `${line.service}::${line.tag}`;
    const b = buckets.get(k) ?? { today: 0, history: [] };
    if (line.dateKey === todayKey) {
      b.today += line.spendUSD;
    } else {
      b.history.push(line.spendUSD);
    }
    buckets.set(k, b);
  }

  const rows: AttributionRow[] = [];
  for (const [k, b] of buckets) {
    const [service, tag] = k.split("::");
    const baseline = meanOf(b.history);
    const delta = b.today - baseline;
    const deltaPct = baseline === 0 ? (b.today === 0 ? 0 : 100) : (delta / baseline) * 100;
    const flagged = delta >= flagUsd && (baseline === 0 || deltaPct >= flagPct);
    const severity: AttributionRow["severity"] =
      flagged && deltaPct >= flagPct * 2 ? "high"
      : flagged ? "watch"
      : "ok";
    rows.push({
      service,
      tag,
      todaySpend: b.today,
      baselineAverage: baseline,
      deltaUsd: delta,
      deltaPct,
      severity,
    });
  }

  rows.sort((a, b) => b.deltaUsd - a.deltaUsd);
  const topOffenders = rows.filter((r) => r.severity !== "ok").slice(0, 10);

  return { todayKey, baselineDays, rows, topOffenders };
}
