/**
 * Pure changefeed batcher.
 *
 * Cloud inventory feeds spew per-resource update events that the UI
 * shouldn't render one-at-a-time. This batcher groups consecutive
 * events within a configurable window (by service or by resource
 * type) into a single batch with a count + first/last timestamps.
 *
 * Pure / deterministic. No DB.
 */

export interface ChangefeedEvent {
  ts: string;                  // ISO
  service: string;
  resourceId: string;
  changeKind: "create" | "update" | "delete";
}

export interface ChangeBatch {
  service: string;
  changeKind: ChangefeedEvent["changeKind"];
  count: number;
  resourceIds: string[];
  firstTs: string;
  lastTs: string;
}

export interface BatcherOptions {
  /** Window length in milliseconds (default 5_000 = 5s). */
  windowMs?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function batchChangefeed(events: readonly ChangefeedEvent[], opts?: BatcherOptions): ChangeBatch[] {
  const windowMs = Math.max(500, Math.min(opts?.windowMs ?? 5_000, DAY_MS));
  if (events.length === 0) return [];

  // Sort by ts asc so windowing is meaningful.
  const sorted = [...events].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

  // Group by (service, changeKind, window-bucket).
  const buckets = new Map<string, ChangeBatch>();

  for (const e of sorted) {
    const tMs = new Date(e.ts).getTime();
    const bucketStart = Math.floor(tMs / windowMs) * windowMs;
    const key = `${e.service}::${e.changeKind}::${bucketStart}`;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        service: e.service,
        changeKind: e.changeKind,
        count: 1,
        resourceIds: [e.resourceId],
        firstTs: e.ts,
        lastTs: e.ts,
      });
      continue;
    }
    existing.count += 1;
    if (!existing.resourceIds.includes(e.resourceId)) existing.resourceIds.push(e.resourceId);
    if (e.ts < existing.firstTs) existing.firstTs = e.ts;
    if (e.ts > existing.lastTs) existing.lastTs = e.ts;
  }

  return [...buckets.values()]
    .map((b) => ({ ...b, resourceIds: [...b.resourceIds].sort() }))
    .sort((a, b) => (a.firstTs < b.firstTs ? -1 : 1));
}
