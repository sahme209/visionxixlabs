/**
 * memory_consolidator_engineer — real domain work · Phase 598.
 *
 * Reads recent AiRationaleEnrichment rows (the workforce's own
 * persistent memory) and synthesizes what to keep, what to recalibrate,
 * and what to retire. Closes the loop on engineer learning so
 * improvements compound across sweeps instead of starting from zero.
 *
 * No-input archetype.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const MEMORY_CONSOLIDATOR_TARGET_KIND = "engineer_memory_consolidation";

export interface KindStats {
  targetKind: string;
  rowCount: number;
  aiGeneratedCount: number;
  fallbackCount: number;
  errorCount: number;
  lastUpdatedAt: Date | null;
  /** Top risk-factor tokens observed across rows in this kind. */
  topRiskTokens: ReadonlyArray<string>;
}

export interface ConsolidationEntry {
  kind: "theme" | "calibration" | "retention_decision";
  targetKind: string;
  /** AI-enriched note (≤ 280 chars). Rules fallback when AI absent. */
  note: string;
}

export interface MemoryConsolidationReport {
  generatedAt: Date;
  windowDays: number;
  totalRows: number;
  kindStats: ReadonlyArray<KindStats>;
  entries: ReadonlyArray<ConsolidationEntry>;
  executiveSummary: string;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface CandidateGroup {
  targetKind: string;
  rowCount: number;
  aiGeneratedCount: number;
  fallbackCount: number;
  errorCount: number;
  lastUpdatedAt: Date | null;
  topRiskTokens: string[];
  fallbackTheme: string;
  fallbackCalibration: string;
  fallbackRetention: string;
}

interface ParsedAi {
  executiveSummary: string;
  byKind: Record<string, { theme: string; calibration: string; retention: string }>;
}

const MAX_KINDS = 14;
const TOKEN_MAX = 8;
const STOP_TOKENS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "into", "over",
  "due", "via", "per", "an", "a", "of", "to", "in", "on", "at", "is",
  "are", "was", "were", "be", "been", "being", "has", "had", "have",
  "not", "no", "yes", "or", "but", "if", "when", "while",
]);

function extractTokens(riskFactors: ReadonlyArray<string>): string[] {
  const counts = new Map<string, number>();
  for (const f of riskFactors) {
    const tokens = f.toLowerCase().split(/[^a-z0-9_]+/).filter((t) => t.length >= 4 && !STOP_TOKENS.has(t));
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOKEN_MAX)
    .map(([t]) => t);
}

function fallbackThemes(c: {
  rowCount: number;
  aiGeneratedCount: number;
  fallbackCount: number;
  errorCount: number;
  topRiskTokens: ReadonlyArray<string>;
}): { theme: string; calibration: string; retention: string } {
  const aiShare = c.rowCount > 0 ? Math.round((c.aiGeneratedCount / c.rowCount) * 100) : 0;
  const topTokens = c.topRiskTokens.slice(0, 3).join(", ") || "no recurring tokens";
  const theme = `${c.rowCount} entries logged · top risk themes: ${topTokens}.`;
  let calibration: string;
  if (c.errorCount > c.aiGeneratedCount) {
    calibration = `Error outcomes (${c.errorCount}) exceed ai_generated (${c.aiGeneratedCount}) — investigate provider routing or input shape before next sweep.`;
  } else if (c.fallbackCount > c.aiGeneratedCount) {
    calibration = `Fallback rules dominate (${c.fallbackCount} vs ${c.aiGeneratedCount} ai_generated) — fetcher circuit may be open; verify provider health.`;
  } else {
    calibration = `AI generation is healthy (${aiShare}% ai_generated of ${c.rowCount}); keep current prompt + routing.`;
  }
  let retention: string;
  if (c.rowCount === 0) retention = `No activity in window — kind is idle, candidate for cooldown.`;
  else if (c.errorCount === c.rowCount) retention = `Every recorded outcome is an error — retire or pause until upstream fix lands.`;
  else retention = `Healthy emit rate — keep the kind active.`;
  return { theme, calibration, retention };
}

function buildSystemPrompt(): string {
  return [
    `You are the Memory Consolidator on the Axiom platform.`,
    `Your job: look at the workforce's own persistent memory (AiRationaleEnrichment rows) and synthesize what to keep, what to recalibrate, and what to retire.`,
    ``,
    `FIELDS per targetKind:`,
    `  · theme         — 1-2 sentence ≤ 280 char restatement of what the workforce has learned in this kind`,
    `  · calibration   — 1 sentence ≤ 280 char naming what to do differently next sweep`,
    `  · retention     — 1 sentence ≤ 240 char retention recommendation: keep, cool-down, or retire`,
    ``,
    `RULES:`,
    `  · Only emit targetKind keys present in the input.`,
    `  · Never invent counts — quote only the numbers from the input.`,
    `  · Executive summary: 2-3 sentences naming the dominant theme, the most material calibration, and the riskiest retention decision.`,
    `  · Plain prose, no markdown.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "<2-3 sentences>",`,
    `  "byKind": { "<targetKind>": { "theme": "...", "calibration": "...", "retention": "..." } }`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(totalRows: number, candidates: ReadonlyArray<CandidateGroup>): string {
  if (candidates.length === 0) {
    return [
      `Workforce memory recorded ${totalRows} AiRationaleEnrichment rows in the window.`,
      `Nothing crosses the surfacing threshold. Affirm a calm state and return empty byKind.`,
    ].join("\n");
  }
  const lines: string[] = [];
  lines.push(`Workforce memory snapshot (last 14 days):`);
  lines.push(`  total rows: ${totalRows}`);
  for (const c of candidates) {
    lines.push(``);
    lines.push(`  [${c.targetKind}] rows=${c.rowCount} ai=${c.aiGeneratedCount} fallback=${c.fallbackCount} error=${c.errorCount}`);
    if (c.lastUpdatedAt) lines.push(`    lastUpdated: ${c.lastUpdatedAt.toISOString()}`);
    lines.push(`    top risk tokens: ${c.topRiskTokens.slice(0, 6).join(", ") || "(none)"}`);
    lines.push(`    rules theme: ${c.fallbackTheme}`);
    lines.push(`    rules calibration: ${c.fallbackCalibration}`);
    lines.push(`    rules retention: ${c.fallbackRetention}`);
  }
  return lines.join("\n");
}

function parseAi(text: string): ParsedAi | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const j = JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
    const exec = typeof j.executiveSummary === "string" ? j.executiveSummary.trim().slice(0, 1500) : null;
    if (!exec) return null;
    const raw = j.byKind;
    if (!raw || typeof raw !== "object") return { executiveSummary: exec, byKind: {} };
    const map: ParsedAi["byKind"] = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const obj = v as Record<string, unknown>;
      const theme = typeof obj.theme === "string" ? obj.theme.trim().slice(0, 400) : "";
      const calibration = typeof obj.calibration === "string" ? obj.calibration.trim().slice(0, 400) : "";
      const retention = typeof obj.retention === "string" ? obj.retention.trim().slice(0, 320) : "";
      if (theme && calibration && retention) {
        map[k] = { theme, calibration, retention };
      }
    }
    return { executiveSummary: exec, byKind: map };
  } catch {
    return null;
  }
}

export async function runMemoryConsolidatorEngineer(organizationId: string): Promise<MemoryConsolidationReport> {
  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  let rows: Array<{
    targetKind: string;
    outcome: string;
    updatedAt: Date;
    riskFactorsJson: unknown;
  }> = [];
  try {
    const grouped = await prisma.aiRationaleEnrichment.findMany({
      where: {
        organizationId,
        updatedAt: { gte: since14d },
        // Don't consume our own consolidation rows.
        targetKind: { not: MEMORY_CONSOLIDATOR_TARGET_KIND },
      },
      select: { targetKind: true, outcome: true, updatedAt: true, riskFactorsJson: true },
      orderBy: { updatedAt: "desc" },
      take: 2000,
    });
    rows = grouped;
  } catch {
    rows = [];
  }
  const totalRows = rows.length;

  type Accumulator = {
    rowCount: number;
    aiGeneratedCount: number;
    fallbackCount: number;
    errorCount: number;
    lastUpdatedAt: Date | null;
    riskFactors: string[];
  };
  const byKind = new Map<string, Accumulator>();
  for (const row of rows) {
    const acc = byKind.get(row.targetKind) ?? {
      rowCount: 0,
      aiGeneratedCount: 0,
      fallbackCount: 0,
      errorCount: 0,
      lastUpdatedAt: null,
      riskFactors: [],
    };
    acc.rowCount += 1;
    if (row.outcome === "ai_generated") acc.aiGeneratedCount += 1;
    else if (row.outcome === "fallback_rules") acc.fallbackCount += 1;
    else if (row.outcome === "error") acc.errorCount += 1;
    if (!acc.lastUpdatedAt || row.updatedAt > acc.lastUpdatedAt) acc.lastUpdatedAt = row.updatedAt;
    if (Array.isArray(row.riskFactorsJson)) {
      for (const f of row.riskFactorsJson as unknown[]) {
        if (typeof f === "string") acc.riskFactors.push(f);
      }
    }
    byKind.set(row.targetKind, acc);
  }

  const candidates: CandidateGroup[] = Array.from(byKind.entries())
    .map(([targetKind, acc]) => {
      const topRiskTokens = extractTokens(acc.riskFactors);
      const fb = fallbackThemes({
        rowCount: acc.rowCount,
        aiGeneratedCount: acc.aiGeneratedCount,
        fallbackCount: acc.fallbackCount,
        errorCount: acc.errorCount,
        topRiskTokens,
      });
      return {
        targetKind,
        rowCount: acc.rowCount,
        aiGeneratedCount: acc.aiGeneratedCount,
        fallbackCount: acc.fallbackCount,
        errorCount: acc.errorCount,
        lastUpdatedAt: acc.lastUpdatedAt,
        topRiskTokens,
        fallbackTheme: fb.theme,
        fallbackCalibration: fb.calibration,
        fallbackRetention: fb.retention,
      };
    })
    .sort((a, b) => b.rowCount - a.rowCount)
    .slice(0, MAX_KINDS);

  let executiveSummary = candidates.length === 0
    ? `No AiRationaleEnrichment activity in the last 14 days — workforce memory is idle.`
    : `${totalRows} workforce memory rows across ${candidates.length} kind${candidates.length === 1 ? "" : "s"} in the last 14 days — review consolidation entries below.`;
  let byKindAi: ParsedAi["byKind"] = {};
  let outcome: MemoryConsolidationReport["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;

  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:memory_consolidator_engineer",
      organizationId,
      timeoutMs: 45_000,
      maxTokens: 2500,
    });
    const prompt = `${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt(totalRows, candidates)}`;
    const result = await fetcher(prompt);
    const parsed = parseAi(result.text);
    if (parsed) {
      executiveSummary = parsed.executiveSummary;
      byKindAi = parsed.byKind;
      outcome = "ai_generated";
      modelHint = result.modelHint;
    } else {
      errorMessage = "ai_response_unparseable";
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    errorMessage = msg;
    outcome = msg.startsWith("circuit_open_") ? "fallback_rules" : "error";
  }

  const kindStats: KindStats[] = candidates.map((c) => ({
    targetKind: c.targetKind,
    rowCount: c.rowCount,
    aiGeneratedCount: c.aiGeneratedCount,
    fallbackCount: c.fallbackCount,
    errorCount: c.errorCount,
    lastUpdatedAt: c.lastUpdatedAt,
    topRiskTokens: c.topRiskTokens,
  }));

  const entries: ConsolidationEntry[] = [];
  for (const c of candidates) {
    const ai = byKindAi[c.targetKind];
    entries.push({ kind: "theme", targetKind: c.targetKind, note: ai?.theme ?? c.fallbackTheme });
    entries.push({ kind: "calibration", targetKind: c.targetKind, note: ai?.calibration ?? c.fallbackCalibration });
    entries.push({ kind: "retention_decision", targetKind: c.targetKind, note: ai?.retention ?? c.fallbackRetention });
  }

  return {
    generatedAt: new Date(),
    windowDays: 14,
    totalRows,
    kindStats,
    entries,
    executiveSummary,
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistMemoryConsolidationReport(organizationId: string, report: MemoryConsolidationReport): Promise<void> {
  const riskFactors = report.kindStats.map((k) =>
    `${k.targetKind} · ${k.rowCount} rows (${k.aiGeneratedCount} ai / ${k.fallbackCount} fb / ${k.errorCount} err)`,
  );
  const payload: string[] = [];
  for (const e of report.entries) {
    payload.push(`${e.kind}|${e.targetKind}|${e.note}`);
  }
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: MEMORY_CONSOLIDATOR_TARGET_KIND,
          targetId: "memory_consolidator_engineer",
        },
      },
      create: {
        organizationId,
        targetKind: MEMORY_CONSOLIDATOR_TARGET_KIND,
        targetId: "memory_consolidator_engineer",
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome,
        errorMessage: report.errorMessage,
        modelHint: report.modelHint,
        engineVersion: "memory-consolidator-engineer-v1",
      },
      update: {
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome,
        errorMessage: report.errorMessage,
        modelHint: report.modelHint,
      },
    });
  } catch (err) {
    console.warn("[memoryConsolidatorEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
