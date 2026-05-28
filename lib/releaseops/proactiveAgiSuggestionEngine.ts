/**
 * Phase 525 — Proactive AGI Suggestion engine.
 *
 * Takes a window of rationale memory entries + persisted meta-summaries
 * and asks Claude to produce a small set of concrete "operator next-
 * action" suggestions. Each suggestion is a deep-link to a source
 * object (release, incident, repo) plus a rationale and confidence.
 *
 * Pure function — no I/O, no DB. The injected fetcher matches the
 * shape the rest of releaseops uses. Always returns a SuggestionSet;
 * never throws.
 *
 * Outcome shape:
 *   ai_generated   — Claude proposed suggestions
 *   fallback_rules — deterministic rule-based suggestions derived
 *                    from window stats (fallback rate, errored
 *                    entries, repeat-block patterns)
 *   error          — fetcher threw, falls back to rules
 */

import { parseRationaleResponse, type RationaleAiFetcher } from "./aiRationaleEnricherEngine";
import type { MemoryEntryForSummary } from "./aiMemorySummaryEngine";
import { computeWindowStats } from "./aiMemorySummaryEngine";

export const PROACTIVE_SUGGESTION_ENGINE_VERSION = "proactive-suggestion-v1.0.0";

export const SUGGESTION_KINDS = [
  "review_release",
  "tighten_protection",
  "reconcile_manual_fix",
  "investigate_incident",
  "reduce_fallback_rate",
  "review_pattern",
  "no_action_needed",
] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export const SUGGESTION_OUTCOMES = ["ai_generated", "fallback_rules", "error"] as const;
export type SuggestionOutcome = (typeof SUGGESTION_OUTCOMES)[number];

export function isSuggestionKind(s: string): s is SuggestionKind {
  return (SUGGESTION_KINDS as readonly string[]).includes(s);
}

/* ──────────────────────────────────────────────────────────────────
   I/O shapes.
   ────────────────────────────────────────────────────────────── */

export interface SuggestionContextEntry extends MemoryEntryForSummary {
  /** Stable citation id (e.g. "e1") so model can echo without inventing. */
  citationId: string;
  /** Optional already-extracted targetKind from the rationale row. */
  rowTargetKind: string;
  rowTargetId: string;
}

export interface SuggestionContextSummary {
  citationId: string;
  targetKind: string | null;
  narrative: string;
  generatedAtIso: string;
}

export interface ProposedSuggestion {
  kind: SuggestionKind;
  title: string;
  rationale: string;
  /** Deep-link target — null when generic ("reduce_fallback_rate"). */
  targetKind: string | null;
  targetId: string | null;
  confidence: number;
  citations: string[];
}

export interface SuggestionSet {
  outcome: SuggestionOutcome;
  suggestions: ProposedSuggestion[];
  modelHint: string | null;
  errorMessage: string | null;
  engineVersion: string;
  windowSize: number;
}

/* ──────────────────────────────────────────────────────────────────
   Prompt.
   ────────────────────────────────────────────────────────────── */

export function buildSuggestionPrompt(
  entries: SuggestionContextEntry[],
  summaries: SuggestionContextSummary[],
): string {
  const lines: string[] = [
    "You are an AI release-operations expert generating concrete operator next-actions from recent AGI reasoning history.",
    "",
    "Reply with a JSON object of shape { narrative, riskFactors, nextActions } — but ignore the field names; treat them as containers:",
    "  - narrative: ignored / placeholder. Send any short string here.",
    "  - riskFactors: an array of 0-5 JSON-encoded suggestion strings, EACH ENCODED AS:",
    `      "<kind>|<targetKind or '-'>|<targetId or '-'>|<confidence 0-100>|<title>"`,
    "    where <kind> is one of:",
    `      review_release · tighten_protection · reconcile_manual_fix · investigate_incident · reduce_fallback_rate · review_pattern · no_action_needed`,
    "  - nextActions: an array of 0-5 PARALLEL rationale strings (same index = same suggestion), each one citing entry/summary citationIds in [brackets].",
    "",
    "Rules:",
    "  - Cite ONLY ids you can see below.",
    "  - Use no_action_needed only if memory genuinely shows nothing to flag.",
    "  - Keep titles under 80 chars, rationales under 200 chars.",
    "",
    "Recent rationale entries (newest first):",
    ...entries.map((e) => `  [${e.citationId}] ${e.rowTargetKind} · ${e.rowTargetId} · ${e.outcome} · ${e.generatedAtIso} — ${truncate(e.narrative, 220)}`),
    "",
    "Recent meta-summaries (newest first):",
    ...summaries.map((s) => `  [${s.citationId}] ${s.targetKind ?? "all"} · ${s.generatedAtIso} — ${truncate(s.narrative, 220)}`),
    "",
    "Respond with ONLY the JSON object. No prose before or after.",
  ];
  return lines.join("\n");
}

/* ──────────────────────────────────────────────────────────────────
   Parsing.
   ────────────────────────────────────────────────────────────── */

/**
 * Pulls suggestions out of the AI response. Format-tolerant:
 * - Parses { narrative, riskFactors, nextActions } JSON
 * - Splits each riskFactor by "|" into (kind, targetKind, targetId, confidence, title)
 * - Pairs with the parallel nextActions entry by index for rationale + citations
 * - Filters out invalid kinds + fabricated citations
 */
export function parseSuggestionResponse(
  raw: string,
  validCitationIds: Set<string>,
): ProposedSuggestion[] | null {
  const parsed = parseRationaleResponse(raw);
  if (!parsed) return null;

  const out: ProposedSuggestion[] = [];
  for (let i = 0; i < parsed.riskFactors.length; i++) {
    const encoded = parsed.riskFactors[i];
    const rationale = parsed.nextActions[i] ?? "";
    if (!encoded || !rationale) continue;

    const parts = encoded.split("|").map((s) => s.trim());
    if (parts.length < 5) continue;
    const [kindRaw, tKindRaw, tIdRaw, confRaw, ...titleParts] = parts;

    if (!isSuggestionKind(kindRaw)) continue;
    const targetKind = tKindRaw && tKindRaw !== "-" ? tKindRaw : null;
    const targetId = tIdRaw && tIdRaw !== "-" ? tIdRaw : null;
    const confidence = Math.max(0, Math.min(100, Math.round(Number(confRaw) || 0)));
    const title = titleParts.join("|").trim();
    if (!title) continue;

    const citations = extractCitations(rationale, validCitationIds);

    out.push({
      kind: kindRaw,
      title: title.slice(0, 200),
      rationale: rationale.slice(0, 400),
      targetKind,
      targetId,
      confidence,
      citations,
    });
    if (out.length >= 5) break;
  }
  return out;
}

function extractCitations(text: string, valid: Set<string>): string[] {
  const matches = text.match(/\[([a-z0-9_-]+)\]/gi);
  if (!matches) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    const id = m.slice(1, -1).trim();
    if (!valid.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= 10) break;
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────
   Fallback (deterministic rule-based suggestions).
   ────────────────────────────────────────────────────────────── */

export function buildFallbackSuggestions(
  entries: SuggestionContextEntry[],
  summaries: SuggestionContextSummary[],
  reason: string,
): SuggestionSet {
  const stats = computeWindowStats(entries);
  const out: ProposedSuggestion[] = [];

  // 1. Errored entries — point at the AI provider.
  if (stats.errorCount > 0) {
    out.push({
      kind: "reduce_fallback_rate",
      title: `${stats.errorCount} errored enrichment${stats.errorCount === 1 ? "" : "s"} — investigate AI provider`,
      rationale: `${stats.errorCount} of ${stats.total} recent enrichments errored — likely AI provider misconfiguration or outage.`,
      targetKind: null,
      targetId: null,
      confidence: 75,
      citations: [],
    });
  }

  // 2. Low AI availability over a sufficient window.
  if (stats.total >= 5 && stats.aiCount * 100 / Math.max(1, stats.total) < 50) {
    const pct = Math.round(stats.aiCount * 100 / stats.total);
    out.push({
      kind: "reduce_fallback_rate",
      title: `AI availability ${pct}% — fallback rate is high`,
      rationale: `Only ${stats.aiCount} of ${stats.total} entries were AI-generated; the rest fell back to deterministic rules. Provider may be rate-limited.`,
      targetKind: null,
      targetId: null,
      confidence: 65,
      citations: [],
    });
  }

  // 3. Repeat-block pattern: same release/triage subjectId appearing multiple times.
  const subjectCounts = new Map<string, { entry: SuggestionContextEntry; n: number }>();
  for (const e of entries) {
    const key = `${e.rowTargetKind}:${e.rowTargetId}`;
    const prev = subjectCounts.get(key);
    if (prev) prev.n += 1;
    else subjectCounts.set(key, { entry: e, n: 1 });
  }
  for (const { entry: e, n } of subjectCounts.values()) {
    if (n >= 3) {
      out.push({
        kind: "review_pattern",
        title: `Repeat reasoning on ${e.rowTargetKind} ${e.rowTargetId} (${n} entries)`,
        rationale: `The AGI re-reasoned about ${e.rowTargetKind} ${e.rowTargetId} ${n} times — worth a human review.`,
        targetKind: e.rowTargetKind,
        targetId: e.rowTargetId,
        confidence: 60,
        citations: [e.citationId],
      });
      if (out.length >= 5) break;
    }
  }

  // 4. Surface coverage: if one engine dominates the window, suggest reviewing.
  const sortedSurfaces = Object.entries(stats.perTargetKind).sort((a, b) => b[1] - a[1]);
  if (sortedSurfaces.length > 0) {
    const [topKind, topCount] = sortedSurfaces[0];
    if (stats.total >= 5 && topCount / stats.total >= 0.7) {
      out.push({
        kind: "review_pattern",
        title: `${topKind} dominates recent reasoning (${topCount}/${stats.total})`,
        rationale: `${Math.round(topCount * 100 / stats.total)}% of recent AGI reasoning was on ${topKind}. Check whether other surfaces are healthy.`,
        targetKind: topKind,
        targetId: null,
        confidence: 55,
        citations: [],
      });
    }
  }

  // 5. Empty window — explicit no-action.
  if (out.length === 0 && stats.total === 0) {
    out.push({
      kind: "no_action_needed",
      title: "No AGI memory in the window",
      rationale: "Nothing to suggest — run any AGI engine (council / triage / remediation) to start populating memory.",
      targetKind: null,
      targetId: null,
      confidence: 100,
      citations: [],
    });
  } else if (out.length === 0) {
    out.push({
      kind: "no_action_needed",
      title: "No issues detected in the recent window",
      rationale: `Window covers ${stats.total} entries; no errored entries, no low availability, no repeat patterns. Nothing to flag.`,
      targetKind: null,
      targetId: null,
      confidence: 80,
      citations: [],
    });
  }

  return {
    outcome: "fallback_rules",
    suggestions: out.slice(0, 5),
    modelHint: null,
    errorMessage: reason,
    engineVersion: PROACTIVE_SUGGESTION_ENGINE_VERSION,
    windowSize: stats.total,
  };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

/* ──────────────────────────────────────────────────────────────────
   Engine entrypoint.
   ────────────────────────────────────────────────────────────── */

export async function generateProactiveSuggestions(
  entries: SuggestionContextEntry[],
  summaries: SuggestionContextSummary[],
  fetcher: RationaleAiFetcher | null,
): Promise<SuggestionSet> {
  const stats = computeWindowStats(entries);

  if (!fetcher) {
    return buildFallbackSuggestions(entries, summaries, "no_ai_fetcher_configured");
  }
  if (entries.length === 0 && summaries.length === 0) {
    return buildFallbackSuggestions(entries, summaries, "empty_memory");
  }

  let raw: string;
  let modelHint: string | null = null;
  try {
    const res = await fetcher(buildSuggestionPrompt(entries, summaries));
    raw = res.text ?? "";
    modelHint = res.modelHint ?? null;
  } catch (err) {
    return {
      ...buildFallbackSuggestions(entries, summaries, err instanceof Error ? err.message : "ai_fetcher_threw"),
      outcome: "error",
    };
  }
  if (!raw.trim()) {
    return buildFallbackSuggestions(entries, summaries, "empty_ai_response");
  }

  const validIds = new Set<string>([
    ...entries.map((e) => e.citationId),
    ...summaries.map((s) => s.citationId),
  ]);
  const parsed = parseSuggestionResponse(raw, validIds);
  if (!parsed || parsed.length === 0) {
    return buildFallbackSuggestions(entries, summaries, "unparseable_ai_response");
  }

  return {
    outcome: "ai_generated",
    suggestions: parsed,
    modelHint,
    errorMessage: null,
    engineVersion: PROACTIVE_SUGGESTION_ENGINE_VERSION,
    windowSize: stats.total,
  };
}
