/**
 * Phase 522 — AGI Memory summarizer (engine).
 *
 * Takes a window of recent rationale enrichments and asks Claude to
 * produce a meta-narrative summary: what themes are recurring, which
 * surfaces are most active, how often the AI was available vs falling
 * back. The AGI summarizing the AGI's own thinking.
 *
 * Pure function — no I/O, no DB, no logger. Injected fetcher matches
 * the shape used by the rationale enrichment engines so it shares the
 * AIProviderManager wiring.
 */

import { parseRationaleResponse, type RationaleAiFetcher } from "./aiRationaleEnricherEngine";

export const MEMORY_SUMMARY_ENGINE_VERSION = "ai-memory-summary-v1.0.0";

export const MEMORY_SUMMARY_OUTCOMES = ["ai_generated", "fallback_rules", "error"] as const;
export type MemorySummaryOutcome = (typeof MEMORY_SUMMARY_OUTCOMES)[number];

export interface MemoryEntryForSummary {
  targetKind: string;
  targetId: string;
  narrative: string;
  outcome: string;
  modelHint: string | null;
  generatedAtIso: string;
}

export interface MemorySummary {
  outcome: MemorySummaryOutcome;
  narrative: string;
  themes: string[];
  notableEntries: string[];
  aiAvailabilityPct: number;
  windowSize: number;
  modelHint: string | null;
  errorMessage: string | null;
  engineVersion: string;
}

/* ──────────────────────────────────────────────────────────────────
   Stats — used both for prompt context and the fallback summary.
   ────────────────────────────────────────────────────────────── */

interface WindowStats {
  total: number;
  perTargetKind: Record<string, number>;
  aiCount: number;
  fallbackCount: number;
  errorCount: number;
  uniqueModels: string[];
  earliestIso: string | null;
  latestIso: string | null;
}

export function computeWindowStats(entries: MemoryEntryForSummary[]): WindowStats {
  const perTargetKind: Record<string, number> = {};
  const models = new Set<string>();
  let aiCount = 0;
  let fallbackCount = 0;
  let errorCount = 0;
  let earliest: string | null = null;
  let latest: string | null = null;
  for (const e of entries) {
    perTargetKind[e.targetKind] = (perTargetKind[e.targetKind] ?? 0) + 1;
    if (e.modelHint) models.add(e.modelHint);
    if (e.outcome === "ai_generated") aiCount++;
    else if (e.outcome === "fallback_rules") fallbackCount++;
    else if (e.outcome === "error") errorCount++;
    if (!earliest || e.generatedAtIso < earliest) earliest = e.generatedAtIso;
    if (!latest || e.generatedAtIso > latest) latest = e.generatedAtIso;
  }
  return {
    total: entries.length,
    perTargetKind,
    aiCount,
    fallbackCount,
    errorCount,
    uniqueModels: Array.from(models).sort(),
    earliestIso: earliest,
    latestIso: latest,
  };
}

function aiAvailabilityPct(stats: WindowStats): number {
  if (stats.total === 0) return 0;
  return Math.round((stats.aiCount / stats.total) * 100);
}

/* ──────────────────────────────────────────────────────────────────
   Prompt.
   ────────────────────────────────────────────────────────────── */

export function buildMemorySummaryPrompt(entries: MemoryEntryForSummary[]): string {
  const stats = computeWindowStats(entries);
  const lines: string[] = [
    "You are reviewing recent reasoning produced by an AI release-operations platform and summarizing it for a senior operator.",
    "Reply with a JSON object of shape { narrative, riskFactors, nextActions } where:",
    `  - narrative is a SINGLE plain-English paragraph (3-5 sentences) summarizing what the AGI has been reasoning about.`,
    `  - riskFactors is an array of 1-5 short strings, each one recurring theme worth flagging (e.g. "council blocked 3 deploys", "fallback rate is high — provider may be flaky").`,
    `  - nextActions is an array of 1-5 short imperative strings: what should the operator review or change?`,
    `  - Each string in the arrays MUST be under 140 characters.`,
    "",
    `Window: ${stats.total} entries from ${stats.earliestIso ?? "(none)"} to ${stats.latestIso ?? "(none)"}`,
    `Per surface: ${JSON.stringify(stats.perTargetKind)}`,
    `Outcomes: ai_generated=${stats.aiCount}, fallback_rules=${stats.fallbackCount}, error=${stats.errorCount}`,
    `Models seen: ${stats.uniqueModels.join(", ") || "(none)"}`,
    "",
    "Recent reasoning (newest first):",
    ...entries.map((e, i) => `  ${i + 1}. [${e.targetKind} · ${e.outcome}] ${truncate(e.narrative, 200)}`),
    "",
    "Respond with ONLY the JSON object. No prose before or after.",
  ];
  return lines.join("\n");
}

/* ──────────────────────────────────────────────────────────────────
   Fallback.
   ────────────────────────────────────────────────────────────── */

export function buildMemoryFallbackSummary(entries: MemoryEntryForSummary[], reason: string): MemorySummary {
  const stats = computeWindowStats(entries);
  const ai = aiAvailabilityPct(stats);

  const surfaces = Object.entries(stats.perTargetKind)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");

  const parts: string[] = [];
  if (stats.total === 0) {
    parts.push("No rationale entries in the window — nothing to summarize.");
  } else {
    parts.push(`Window covers ${stats.total} rationale entries across ${Object.keys(stats.perTargetKind).length} surface${Object.keys(stats.perTargetKind).length === 1 ? "" : "s"} (${surfaces}).`);
    parts.push(`AI provider was available for ${ai}% of entries; the rest fell back to deterministic rules${stats.errorCount > 0 ? ` and ${stats.errorCount} errored` : ""}.`);
    if (stats.uniqueModels.length > 0) {
      parts.push(`Models in rotation: ${stats.uniqueModels.join(", ")}.`);
    }
  }
  const narrative = parts.join(" ");

  const themes: string[] = [];
  if (stats.total > 0) {
    for (const [kind, count] of Object.entries(stats.perTargetKind).sort((a, b) => b[1] - a[1])) {
      themes.push(`${count} ${kind} decision${count === 1 ? "" : "s"} in the window.`);
    }
  }
  if (ai < 50 && stats.total >= 4) {
    themes.push(`Low AI availability (${ai}%) — provider may be misconfigured or rate-limited.`);
  } else if (ai === 100 && stats.total >= 4) {
    themes.push("100% AI availability — provider has been healthy across the window.");
  }
  if (stats.errorCount > 0) {
    themes.push(`${stats.errorCount} entr${stats.errorCount === 1 ? "y" : "ies"} errored out — investigate provider logs.`);
  }
  if (themes.length === 0) {
    themes.push("Insufficient data for theme detection — generate more decisions to populate the window.");
  }

  const notableEntries: string[] = [];
  if (stats.errorCount > 0) {
    notableEntries.push("Review the errored entries first — they indicate AI provider failures.");
  }
  if (stats.fallbackCount > stats.aiCount && stats.total >= 4) {
    notableEntries.push("Fallback outpaced AI — check the AI provider configuration.");
  }
  if (stats.total === 0) {
    notableEntries.push("Run any AGI engine (council / triage / remediation) to start populating memory.");
  } else {
    notableEntries.push("Re-run with the live AI fetcher to enrich the summary.");
  }

  return {
    outcome: "fallback_rules",
    narrative,
    themes: themes.slice(0, 5),
    notableEntries: notableEntries.slice(0, 5),
    aiAvailabilityPct: ai,
    windowSize: stats.total,
    modelHint: null,
    errorMessage: reason,
    engineVersion: MEMORY_SUMMARY_ENGINE_VERSION,
  };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

/* ──────────────────────────────────────────────────────────────────
   Engine entrypoint.
   ────────────────────────────────────────────────────────────── */

export async function summarizeAgiMemory(
  entries: MemoryEntryForSummary[],
  fetcher: RationaleAiFetcher | null,
): Promise<MemorySummary> {
  const stats = computeWindowStats(entries);
  const ai = aiAvailabilityPct(stats);

  if (!fetcher) {
    return buildMemoryFallbackSummary(entries, "no_ai_fetcher_configured");
  }
  if (entries.length === 0) {
    return buildMemoryFallbackSummary(entries, "empty_window");
  }

  let raw: string;
  let modelHint: string | null = null;
  try {
    const res = await fetcher(buildMemorySummaryPrompt(entries));
    raw = res.text ?? "";
    modelHint = res.modelHint ?? null;
  } catch (err) {
    return {
      ...buildMemoryFallbackSummary(entries, err instanceof Error ? err.message : "ai_fetcher_threw"),
      outcome: "error",
    };
  }

  if (!raw.trim()) {
    return buildMemoryFallbackSummary(entries, "empty_ai_response");
  }

  // Reuse the rationale parser — the JSON shape is identical (narrative
  // + riskFactors + nextActions); we map them to themes + notableEntries.
  const parsed = parseRationaleResponse(raw);
  if (!parsed) {
    return buildMemoryFallbackSummary(entries, "unparseable_ai_response");
  }

  return {
    outcome: "ai_generated",
    narrative: parsed.narrative,
    themes: parsed.riskFactors,
    notableEntries: parsed.nextActions,
    aiAvailabilityPct: ai,
    windowSize: stats.total,
    modelHint,
    errorMessage: null,
    engineVersion: MEMORY_SUMMARY_ENGINE_VERSION,
  };
}
