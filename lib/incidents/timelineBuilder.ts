/**
 * Pure incident timeline builder.
 *
 * Merges events from multiple sources (cloudtrail, bus messages,
 * proposals, runbook stages) into a single chronologically-sorted
 * timeline with sane truncation + grouping for the UI.
 *
 * Pure / deterministic. No DB.
 */

export type TimelineSource = "cloudtrail" | "agent_bus" | "method_proposal" | "runbook" | "manual" | "outbound";

export interface RawTimelineEvent {
  ts: string;                 // ISO timestamp
  source: TimelineSource;
  summary: string;
  /** Free-form key for grouping (e.g. correlationId or candidateId). */
  groupKey?: string | null;
  /** Optional severity hint surfaced in the UI. */
  severity?: "info" | "low" | "medium" | "high" | "critical";
}

export interface TimelineRow {
  ts: string;
  source: TimelineSource;
  summary: string;
  groupKey: string | null;
  severity: "info" | "low" | "medium" | "high" | "critical";
}

export interface TimelineReport {
  windowStart: string | null;
  windowEnd: string | null;
  rows: TimelineRow[];
  /** Groups present in the window, sorted by event count desc. */
  groups: Array<{ groupKey: string; count: number; firstSeen: string; lastSeen: string }>;
}

const MAX_ROWS = 500;

const fallbackSeverity = (sev?: RawTimelineEvent["severity"]): TimelineRow["severity"] => sev ?? "info";

export function buildTimeline(events: readonly RawTimelineEvent[], opts?: { limit?: number }): TimelineReport {
  const limit = Math.max(1, Math.min(opts?.limit ?? MAX_ROWS, MAX_ROWS));

  const sorted = [...events].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  const sliced = sorted.slice(-limit);

  const rows: TimelineRow[] = sliced.map((e) => ({
    ts: e.ts,
    source: e.source,
    summary: (e.summary ?? "").slice(0, 240),
    groupKey: e.groupKey ?? null,
    severity: fallbackSeverity(e.severity),
  }));

  const windowStart = rows.length === 0 ? null : rows[0].ts;
  const windowEnd = rows.length === 0 ? null : rows[rows.length - 1].ts;

  const groupMap = new Map<string, { count: number; firstSeen: string; lastSeen: string }>();
  for (const r of rows) {
    if (!r.groupKey) continue;
    const g = groupMap.get(r.groupKey) ?? { count: 0, firstSeen: r.ts, lastSeen: r.ts };
    g.count += 1;
    if (r.ts < g.firstSeen) g.firstSeen = r.ts;
    if (r.ts > g.lastSeen) g.lastSeen = r.ts;
    groupMap.set(r.groupKey, g);
  }
  const groups = [...groupMap.entries()].map(([groupKey, v]) => ({ groupKey, ...v }))
    .sort((a, b) => b.count - a.count);

  return { windowStart, windowEnd, rows, groups };
}
