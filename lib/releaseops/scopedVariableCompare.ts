/** Client-safe comparison of two resolved variable sets (no Node APIs). */
export interface ResolvedEntry { key: string; value: string }
export interface ResolvedComparison { onlyInFrom: string[]; onlyInTo: string[]; changed: Array<{ key: string; from: string; to: string }>; same: number }

/** What changes in configuration when a release moves from one environment to another. */
export function compareResolved(from: readonly ResolvedEntry[], to: readonly ResolvedEntry[]): ResolvedComparison {
  const a = new Map(from.map((v) => [v.key, v.value])), b = new Map(to.map((v) => [v.key, v.value]));
  const out: ResolvedComparison = { onlyInFrom: [], onlyInTo: [], changed: [], same: 0 };
  for (const [key, value] of a) {
    if (!b.has(key)) out.onlyInFrom.push(key);
    else if (b.get(key) !== value) out.changed.push({ key, from: value, to: b.get(key)! });
    else out.same += 1;
  }
  for (const key of b.keys()) if (!a.has(key)) out.onlyInTo.push(key);
  const order = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
  out.onlyInFrom.sort(order); out.onlyInTo.sort(order); out.changed.sort((x, y) => order(x.key, y.key));
  return out;
}

