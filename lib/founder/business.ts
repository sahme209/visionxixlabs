/**
 * Founder business overview: pure shaping of records into series, funnels and rankings.
 * Server reads live in founderBusiness.ts; this file is client-safe and tested on its own.
 */
const DAY = 86_400_000;

/** One value per UTC day for the last `days` days, oldest first. */
export function dailySeries(rows: ReadonlyArray<{ at: Date; value: number }>, days: number, now: Date): Array<{ day: string; value: number }> {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const out = Array.from({ length: days }, (_, i) => ({ day: new Date(end - (days - 1 - i) * DAY).toISOString().slice(0, 10), value: 0 }));
  const index = new Map(out.map((d, i) => [d.day, i]));
  for (const r of rows) { const i = index.get(r.at.toISOString().slice(0, 10)); if (i !== undefined) out[i].value += r.value; }
  return out;
}

/** Counts per 7-day week for the last `weeks` weeks, oldest first; each label is the week's first day. */
export function weeklyCounts(dates: readonly Date[], weeks: number, now: Date): Array<{ week: string; count: number }> {
  const start = now.getTime() - weeks * 7 * DAY;
  const out = Array.from({ length: weeks }, (_, i) => ({ week: new Date(start + i * 7 * DAY).toISOString().slice(0, 10), count: 0 }));
  for (const d of dates) { const i = Math.floor((d.getTime() - start) / (7 * DAY)); if (i >= 0 && i < weeks) out[i].count += 1; }
  return out;
}

/** Gross margin as a whole percentage of what was billed; null when nothing was billed. */
export function marginPct(billedCents: number, costCents: number): number | null {
  return billedCents > 0 ? Math.round(((billedCents - costCents) / billedCents) * 100) : null;
}

/** Change from the previous period as a whole percentage; null when the previous period was zero. */
export function changePct(current: number, previous: number): number | null {
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
}

/**
 * Groups similar questions so repeated asks rank first: lowercased, punctuation removed, common
 * filler words dropped, first six remaining words as the key.
 */
const FILLER = new Set(["how", "do", "i", "can", "the", "a", "an", "to", "is", "what", "does", "in", "on", "for", "of", "my", "it", "with", "you", "v19", "please"]);
export function topicKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w && !FILLER.has(w)).slice(0, 6).join(" ");
}
export function rankTopics(texts: readonly string[], limit = 8): Array<{ topic: string; example: string; count: number }> {
  const groups = new Map<string, { example: string; count: number }>();
  for (const t of texts) { const k = topicKey(t); if (!k) continue; const g = groups.get(k); if (g) g.count += 1; else groups.set(k, { example: t.slice(0, 160), count: 1 }); }
  return [...groups.entries()].map(([topic, g]) => ({ topic, ...g })).sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic)).slice(0, limit);
}

/** Short, stable label for a workspace when no name is recorded. */
export const workspaceLabel = (organizationId: string) => `Workspace …${organizationId.slice(-6)}`;

export interface Funnel { steps: Array<{ label: string; count: number; pct: number | null }> }
/** Each step as a share of the first. */
export function funnel(steps: ReadonlyArray<{ label: string; count: number }>): Funnel {
  const first = steps[0]?.count ?? 0;
  return { steps: steps.map((s) => ({ ...s, pct: first > 0 ? Math.round((s.count / first) * 100) : null })) };
}

export interface RoadmapCandidate { kind: "doc_gap" | "fix_page" | "follow_up"; title: string; reason: string; weight: number }
/**
 * Roadmap candidates an agent proposes from what customers asked and said: repeated questions Ask V19
 * could not answer become documentation or product gaps, pages with several negative reports become
 * fixes, and at-risk paid workspaces become follow-ups. Highest weight first.
 */
export function roadmapCandidates(input: { topUnanswered: ReadonlyArray<{ example: string; count: number }>; negativeByPage: ReadonlyArray<{ page: string; count: number }>; atRisk: ReadonlyArray<{ label: string; reason: string }> }, limit = 8): RoadmapCandidate[] {
  const out: RoadmapCandidate[] = [];
  for (const q of input.topUnanswered) if (q.count >= 2) out.push({ kind: "doc_gap", title: `Answer: "${q.example.slice(0, 80)}"`, reason: `Asked ${q.count} times and Ask V19 could not answer.`, weight: q.count * 2 });
  for (const p of input.negativeByPage) if (p.count >= 2) out.push({ kind: "fix_page", title: `Fix ${p.page}`, reason: `${p.count} negative feedback reports in 30 days.`, weight: p.count * 3 });
  for (const a of input.atRisk) out.push({ kind: "follow_up", title: `Follow up with ${a.label}`, reason: a.reason, weight: 5 });
  return out.sort((a, b) => b.weight - a.weight).slice(0, limit);
}
