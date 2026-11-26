/**
 * Environment tags and tenant fan-out planning (pure). Tags are `key:value` labels such as
 * `tenant:acme`, `region:eu` or `ring:1`. A release can target a selector; V19 resolves the
 * matching environments and orders them into rings. Planning never dispatches anything: each
 * planned environment still gets its own deployment with its own gates and record.
 */
export const MAX_TAGS_PER_ENVIRONMENT = 20;
const TAG = /^[a-z][a-z0-9-]{0,31}:[a-z0-9][a-z0-9._-]{0,63}$/;

export function normalizeTags(raw: readonly string[]): { ok: true; tags: string[] } | { ok: false; invalid: string[] } {
  const tags = [...new Set(raw.map((t) => t.trim().toLowerCase()).filter(Boolean))].sort();
  const invalid = tags.filter((t) => !TAG.test(t));
  if (invalid.length) return { ok: false, invalid };
  if (tags.length > MAX_TAGS_PER_ENVIRONMENT) return { ok: false, invalid: tags.slice(MAX_TAGS_PER_ENVIRONMENT) };
  return { ok: true, tags };
}

/** Selector: space-separated `key:value` terms, all of which must match (AND). `key:*` matches any value. */
export function parseSelector(selector: string): { ok: true; terms: Array<{ key: string; value: string | "*" }> } | { ok: false } {
  const parts = selector.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length === 0 || parts.length > 5) return { ok: false };
  const terms: Array<{ key: string; value: string | "*" }> = [];
  for (const p of parts) {
    const m = /^([a-z][a-z0-9-]{0,31}):(\*|[a-z0-9][a-z0-9._-]{0,63})$/.exec(p);
    if (!m) return { ok: false };
    terms.push({ key: m[1], value: m[2] });
  }
  return { ok: true, terms };
}

export interface TaggedEnvironment { id: string; name: string; tier: string; tags: readonly string[] }
export interface FanOutPlan { rings: Array<{ ring: number | null; environments: TaggedEnvironment[] }>; matched: number }

export function planFanOut(environments: readonly TaggedEnvironment[], selector: string): { ok: true; plan: FanOutPlan } | { ok: false; error: "selector_invalid" } {
  const parsed = parseSelector(selector);
  if (!parsed.ok) return { ok: false, error: "selector_invalid" };
  const matches = environments.filter((e) => parsed.terms.every((t) => e.tags.some((tag) => { const [k, v] = tag.split(":"); return k === t.key && (t.value === "*" || v === t.value); })));
  const ringOf = (e: TaggedEnvironment) => { const r = e.tags.find((t) => t.startsWith("ring:")); const n = r ? Number(r.slice(5)) : NaN; return Number.isInteger(n) && n >= 0 ? n : null; };
  const groups = new Map<number | null, TaggedEnvironment[]>();
  for (const e of matches) { const r = ringOf(e); (groups.get(r) ?? groups.set(r, []).get(r)!).push(e); }
  const rings = [...groups.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a - b))
    .map(([ring, envs]) => ({ ring, environments: envs.sort((x, y) => x.name.localeCompare(y.name)) }));
  return { ok: true, plan: { rings, matched: matches.length } };
}
