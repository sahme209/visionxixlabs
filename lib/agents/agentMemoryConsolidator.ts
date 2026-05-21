/**
 * Pure agent memory consolidator.
 *
 * Input: a raw stream of agent observations + an existing memory
 * store snapshot. Output: a consolidated memory state — episodic
 * (specific incidents), semantic (rules learned), procedural
 * (workflows that succeeded), with closed-union memory kind +
 * relevance scores.
 *
 * Pure / deterministic. The kernel never embeds (no model call) —
 * it computes a deterministic relevance score from tag overlap +
 * recency + outcome quality. Real embedding-based retrieval is a
 * downstream layer that consumes this consolidated set.
 *
 * Why this matters for AGI:
 *   An agent that doesn't remember anything just keeps making the
 *   same mistakes. A consolidated memory store turns scattered
 *   observations into compressed semantic rules the meta-reasoner
 *   can reference cheaply.
 */

export type MemoryKind =
  | "episodic"      // a specific event
  | "semantic"      // a generalisable rule extracted from many events
  | "procedural";   // a workflow / sequence that worked

export interface RawObservation {
  /** Unique id from the audit log / bus / approval ledger. */
  id: string;
  /** When the observation happened (ISO). */
  at: string;
  /** Kernel module that emitted it. */
  agentId: string;
  /** Free-form tags from the agent (e.g. ["cloud_cost","ebs","savings"]). */
  tags: readonly string[];
  /** Operator-readable narrative (capped to 500 chars by the caller). */
  narrative: string;
  /** Outcome quality 0..1 — 1 means operator approved + nothing rolled back. */
  outcomeQuality: number;
  /** True when the same observation pattern has been seen N times before. */
  recurrent: boolean;
}

export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  /** When the memory was last reinforced. */
  lastSeenAt: string;
  agentIds: readonly string[];
  tags: readonly string[];
  narrative: string;
  /** Times the memory has been reinforced. */
  reinforcementCount: number;
  /** Weighted relevance score, used by retrieval. */
  relevance: number;
}

export interface MemoryStore {
  records: readonly MemoryRecord[];
}

export interface ConsolidateInput {
  store: MemoryStore;
  observations: readonly RawObservation[];
  /** Current time — defaults to Date.now() in callers but injectable for tests. */
  now: Date;
  /** Records below this relevance are pruned. Default 0.05. */
  pruneBelow?: number;
  /** Records older than this many days without reinforcement are pruned. Default 180. */
  maxAgeDays?: number;
}

const DEFAULT_PRUNE_BELOW = 0.05;
const DEFAULT_MAX_AGE_DAYS = 180;
const SEMANTIC_PROMOTION_THRESHOLD = 3; // recurrent + 3+ reinforcements → semantic

function dayDiff(now: Date, iso: string): number {
  return (now.getTime() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000);
}

function recencyWeight(now: Date, iso: string): number {
  const days = dayDiff(now, iso);
  // Exponential decay; half-life ≈ 30 days.
  return Math.exp(-days / 30);
}

function relevanceFor(record: MemoryRecord, now: Date): number {
  const recency = recencyWeight(now, record.lastSeenAt);
  // log-scaled reinforcement so a record with 100 reinforcements doesn't dominate.
  const reinforcement = Math.log1p(record.reinforcementCount) / Math.log(10);
  return Math.min(1, recency * 0.6 + reinforcement * 0.4);
}

function tagsOverlap(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a.map((t) => t.toLowerCase()));
  let inter = 0;
  for (const t of b) if (sa.has(t.toLowerCase())) inter += 1;
  const union = sa.size + b.length - inter;
  return union === 0 ? 0 : inter / union;
}

let counter = 0;
function nextId(): string { counter += 1; return `mem-${counter}`; }
export function __resetMemoryCounter(): void { counter = 0; }

export interface ConsolidateResult {
  /** Resulting store after consolidation. */
  store: MemoryStore;
  /** New records added this round. */
  added: readonly MemoryRecord[];
  /** Existing records reinforced this round. */
  reinforced: readonly MemoryRecord[];
  /** Records promoted from episodic → semantic. */
  promoted: readonly MemoryRecord[];
  /** Records pruned (age + low relevance). */
  pruned: readonly MemoryRecord[];
}

export function consolidate(input: ConsolidateInput): ConsolidateResult {
  const pruneBelow = input.pruneBelow ?? DEFAULT_PRUNE_BELOW;
  const maxAgeDays = input.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const now = input.now;

  // Clone the working set so we don't mutate caller's store.
  const working = new Map<string, MemoryRecord>(input.store.records.map((r) => [r.id, { ...r, agentIds: [...r.agentIds], tags: [...r.tags] }]));

  const added: MemoryRecord[] = [];
  const reinforced: MemoryRecord[] = [];
  const promoted: MemoryRecord[] = [];

  for (const obs of input.observations) {
    // Find the best matching record by tag overlap >= 0.5 + same agent involvement.
    let best: { rec: MemoryRecord; score: number } | null = null;
    for (const rec of working.values()) {
      const score = tagsOverlap(rec.tags, obs.tags);
      if (score >= 0.5) {
        if (!best || score > best.score) best = { rec, score };
      }
    }

    if (best) {
      // Reinforce: bump count, refresh lastSeenAt, union tags + agentIds.
      const updated: MemoryRecord = {
        ...best.rec,
        lastSeenAt: obs.at,
        reinforcementCount: best.rec.reinforcementCount + 1,
        agentIds: dedupe([...best.rec.agentIds, obs.agentId]),
        tags: dedupe([...best.rec.tags, ...obs.tags]),
        relevance: 0, // recomputed below
      };
      // Promote to semantic if recurrent + above the threshold.
      if (updated.kind === "episodic" && obs.recurrent && updated.reinforcementCount >= SEMANTIC_PROMOTION_THRESHOLD) {
        updated.kind = "semantic";
        promoted.push(updated);
      }
      updated.relevance = relevanceFor(updated, now);
      working.set(updated.id, updated);
      reinforced.push(updated);
    } else {
      // New episodic record.
      // Outcome quality below 0.3 means the observation is suspect — store
      // it but with a discount on reinforcement count.
      const newRec: MemoryRecord = {
        id: nextId(),
        kind: obs.recurrent ? "procedural" : "episodic",
        lastSeenAt: obs.at,
        agentIds: [obs.agentId],
        tags: dedupe(obs.tags),
        narrative: obs.narrative.slice(0, 500),
        reinforcementCount: 1,
        relevance: 0,
      };
      newRec.relevance = relevanceFor(newRec, now);
      // Low-quality observations are added but pruned immediately if they fall below pruneBelow.
      working.set(newRec.id, newRec);
      added.push(newRec);
    }
  }

  // Refresh relevance + prune.
  const pruned: MemoryRecord[] = [];
  for (const rec of [...working.values()]) {
    const rel = relevanceFor(rec, now);
    const aged = dayDiff(now, rec.lastSeenAt) > maxAgeDays;
    if (rel < pruneBelow || aged) {
      pruned.push(rec);
      working.delete(rec.id);
      continue;
    }
    rec.relevance = rel;
  }

  return {
    store: { records: [...working.values()] },
    added,
    reinforced,
    promoted,
    pruned,
  };
}

/**
 * Deterministic retrieval — given query tags, return the top N
 * records sorted by tag overlap × relevance. No embeddings.
 */
export function retrieveMemories(
  store: MemoryStore,
  queryTags: readonly string[],
  topN = 5,
): readonly MemoryRecord[] {
  if (queryTags.length === 0) return [];
  const scored = store.records.map((r) => ({
    rec: r,
    score: tagsOverlap(r.tags, queryTags) * r.relevance,
  }));
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((s) => s.rec);
}

function dedupe(xs: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const key = x.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(x);
    }
  }
  return out;
}
