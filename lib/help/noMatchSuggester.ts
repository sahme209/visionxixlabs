/**
 * Doc-suggestion analyzer.
 *
 * Reads HelpQueryRecord rows where verdict='no_match', clusters by
 * normalized query, and proposes:
 *   • A title (heuristic from the most-common phrasing)
 *   • A category (best-guess based on token overlap with existing
 *     HelpEntry keywords + their categories)
 *   • Suggested keywords (the surviving query tokens)
 *
 * Operators copy the suggestion into `lib/help/helpKnowledgeBase.ts`
 * so the no_match query becomes a found_primary the next time
 * someone asks. Closes the docs feedback loop.
 *
 * Hard rules:
 *   - Pure ranking + grouping. No DB write, no Slack send.
 *   - Pre-existing HELP_ENTRIES titles are excluded so we don't
 *     suggest creating an entry that already exists.
 *   - DB failure on the read side returns an empty suggestion list.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { HELP_ENTRIES, type HelpCategory } from "./helpKnowledgeBase";

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "how",
  "i", "in", "into", "is", "it", "its", "of", "on", "or", "that", "the", "this", "to",
  "what", "where", "who", "why", "will", "with", "you", "your", "do", "does", "can",
  "should", "would", "could", "tell", "me", "us", "my", "we", "our",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export interface DocSuggestion {
  /** Normalized query stem — what to copy as the entry id seed. */
  normalizedQuery: string;
  /** Sample raw query (most-common phrasing). */
  sampleQuery: string;
  /** How many times this query landed as no_match. */
  count: number;
  /** Best-guess category (or 'operator' as a safe default). */
  suggestedCategory: HelpCategory;
  /** Surviving tokens — paste straight into HelpEntry.keywords. */
  suggestedKeywords: string[];
  /** Confidence 0..1 — heuristic mix of count, token overlap, category strength. */
  confidence: number;
}

export interface NoMatchSuggestReport {
  totalNoMatchQueries: number;
  suggestions: DocSuggestion[];
  /** When the report could not read from Prisma. */
  errors: string[];
}

interface CategoryTokenIndex {
  category: HelpCategory;
  tokens: Set<string>;
}

const CATEGORY_INDEX: CategoryTokenIndex[] = (() => {
  const m = new Map<HelpCategory, Set<string>>();
  for (const e of HELP_ENTRIES) {
    if (!m.has(e.category)) m.set(e.category, new Set());
    const set = m.get(e.category)!;
    for (const tok of tokenize(e.title)) set.add(tok);
    for (const tok of e.keywords.flatMap((k) => tokenize(k))) set.add(tok);
  }
  return Array.from(m.entries()).map(([category, tokens]) => ({ category, tokens }));
})();

const KNOWN_TITLES = new Set(HELP_ENTRIES.map((e) => e.title.toLowerCase()));

export async function buildNoMatchSuggestions(opts?: { limit?: number }): Promise<NoMatchSuggestReport> {
  const limit = Math.max(5, Math.min(opts?.limit ?? 20, 100));
  const errors: string[] = [];
  let rows: Array<{ query: string }> = [];
  try {
    rows = await prisma.helpQueryRecord.findMany({
      where: { verdict: "no_match" },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: { query: true },
    });
  } catch (err) {
    errors.push(err instanceof Error ? err.message.slice(0, 200) : "unknown_error");
    return { totalNoMatchQueries: 0, suggestions: [], errors };
  }

  // Cluster by normalized query.
  const groups = new Map<string, { count: number; samples: string[]; tokens: string[] }>();
  for (const r of rows) {
    const norm = tokenize(r.query).sort().join(" ");
    if (norm.length === 0) continue;
    if (KNOWN_TITLES.has(r.query.trim().toLowerCase())) continue;
    let g = groups.get(norm);
    if (!g) {
      g = { count: 0, samples: [], tokens: tokenize(r.query) };
      groups.set(norm, g);
    }
    g.count++;
    if (g.samples.length < 3) g.samples.push(r.query);
  }

  const suggestions: DocSuggestion[] = Array.from(groups.entries())
    .map(([normalizedQuery, group]) => {
      const { category, overlap } = pickCategory(group.tokens);
      const confidence = computeConfidence(group.count, overlap, group.tokens.length);
      return {
        normalizedQuery,
        sampleQuery: group.samples[0] ?? normalizedQuery,
        count: group.count,
        suggestedCategory: category,
        suggestedKeywords: group.tokens,
        confidence,
      };
    })
    .sort((a, b) => b.count - a.count || b.confidence - a.confidence)
    .slice(0, limit);

  return { totalNoMatchQueries: rows.length, suggestions, errors };
}

function pickCategory(tokens: string[]): { category: HelpCategory; overlap: number } {
  let best: HelpCategory = "operator";
  let bestOverlap = 0;
  for (const entry of CATEGORY_INDEX) {
    let count = 0;
    for (const t of tokens) if (entry.tokens.has(t)) count++;
    if (count > bestOverlap) {
      bestOverlap = count;
      best = entry.category;
    }
  }
  return { category: best, overlap: bestOverlap };
}

function computeConfidence(count: number, overlap: number, tokens: number): number {
  // count is the primary signal, capped at 10.
  const countSignal = Math.min(1, count / 10);
  // overlap-ratio over token count, capped at 1.
  const overlapSignal = tokens > 0 ? Math.min(1, overlap / tokens) : 0;
  return Math.min(1, 0.6 * countSignal + 0.4 * overlapSignal);
}
