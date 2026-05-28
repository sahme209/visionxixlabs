/**
 * Phase 523 — Persisted AGI meta-summary responder.
 *
 * Three surfaces:
 *   • persistMemorySummary — internal helper used by the summarize
 *     route to append every new summary to the log.
 *   • buildMemorySummaryTimelineResponse — read path: list recent
 *     summaries chronologically, with optional targetKind filter.
 *
 * Best-effort write contract: persistMemorySummary returns null on
 * any DB failure so it can be safely awaited inline by the summarize
 * route without blocking the response.
 */

import { isMissingTable } from "./releaseListResponder";
import type { MemorySummary } from "./aiMemorySummaryEngine";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface SummaryLogRow {
  id: string;
  organizationId: string;
  targetKind: string | null;
  narrative: string;
  themesJson: unknown;
  notableEntriesJson: unknown;
  outcome: string;
  errorMessage: string | null;
  modelHint: string | null;
  windowSize: number;
  aiAvailabilityPct: number;
  engineVersion: string;
  generatedAt: Date;
}

export interface MemorySummaryRepo {
  aiMemorySummaryLog: {
    create(args: {
      data: {
        organizationId: string;
        targetKind: string | null;
        narrative: string;
        themesJson: unknown;
        notableEntriesJson: unknown;
        outcome: string;
        errorMessage: string | null;
        modelHint: string | null;
        windowSize: number;
        aiAvailabilityPct: number;
        engineVersion: string;
      };
    }): Promise<SummaryLogRow>;
    findMany(args: {
      where: { organizationId: string; targetKind?: string | null };
      orderBy: { generatedAt: "desc" };
      take?: number;
    }): Promise<SummaryLogRow[]>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Views.
   ────────────────────────────────────────────────────────────── */

export interface SummaryLogView {
  id: string;
  targetKind: string | null;
  narrative: string;
  themes: string[];
  notableEntries: string[];
  outcome: string;
  errorMessage: string | null;
  modelHint: string | null;
  windowSize: number;
  aiAvailabilityPct: number;
  engineVersion: string;
  generatedAtIso: string;
}

export interface TimelineData {
  generatedAt: string;
  entries: SummaryLogView[];
  summary: {
    total: number;
    aiGenerated: number;
    fallbackRules: number;
    errored: number;
  };
}

export type ApiResponse<T> =
  | { status: number; body: { ok: true; data: T } }
  | { status: number; body: { ok: false; error: string; hint?: string } };

/* ──────────────────────────────────────────────────────────────────
   Helpers.
   ────────────────────────────────────────────────────────────── */

function toJsonArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    const out: string[] = [];
    for (const item of input) if (typeof item === "string") out.push(item);
    return out;
  }
  return [];
}

function rowToView(row: SummaryLogRow): SummaryLogView {
  return {
    id: row.id,
    targetKind: row.targetKind,
    narrative: row.narrative,
    themes: toJsonArray(row.themesJson),
    notableEntries: toJsonArray(row.notableEntriesJson),
    outcome: row.outcome,
    errorMessage: row.errorMessage,
    modelHint: row.modelHint,
    windowSize: row.windowSize,
    aiAvailabilityPct: row.aiAvailabilityPct,
    engineVersion: row.engineVersion,
    generatedAtIso: row.generatedAt.toISOString(),
  };
}

/* ──────────────────────────────────────────────────────────────────
   Public surfaces.
   ────────────────────────────────────────────────────────────── */

/**
 * Best-effort persistence. Returns null on any failure (including
 * migration_pending) — caller must NOT block the summarize response
 * on this completing.
 */
export async function persistMemorySummary(
  repo: MemorySummaryRepo,
  organizationId: string,
  targetKind: string | null,
  summary: MemorySummary,
): Promise<SummaryLogView | null> {
  try {
    const row = await repo.aiMemorySummaryLog.create({
      data: {
        organizationId,
        targetKind,
        narrative: summary.narrative,
        themesJson: summary.themes,
        notableEntriesJson: summary.notableEntries,
        outcome: summary.outcome,
        errorMessage: summary.errorMessage,
        modelHint: summary.modelHint,
        windowSize: summary.windowSize,
        aiAvailabilityPct: summary.aiAvailabilityPct,
        engineVersion: summary.engineVersion,
      },
    });
    return rowToView(row);
  } catch {
    return null;
  }
}

export interface TimelineInput {
  organizationId: string;
  targetKind?: string | null;
  take?: number;
}

/**
 * Read path: list recent persisted summaries for the operator's
 * timeline view. Defaults to 50 most-recent entries.
 */
export async function buildMemorySummaryTimelineResponse(
  repo: MemorySummaryRepo,
  input: TimelineInput,
): Promise<ApiResponse<TimelineData>> {
  const take = Math.max(1, Math.min(200, input.take ?? 50));
  try {
    const rows = await repo.aiMemorySummaryLog.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.targetKind !== undefined ? { targetKind: input.targetKind } : {}),
      },
      orderBy: { generatedAt: "desc" },
      take,
    });
    const entries = rows.map(rowToView);
    let aiGenerated = 0;
    let fallbackRules = 0;
    let errored = 0;
    for (const r of rows) {
      if (r.outcome === "ai_generated") aiGenerated++;
      else if (r.outcome === "fallback_rules") fallbackRules++;
      else if (r.outcome === "error") errored++;
    }
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: new Date().toISOString(),
          entries,
          summary: { total: entries.length, aiGenerated, fallbackRules, errored },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Run prisma migrate deploy for 20260528150000_add_ai_memory_summary_log." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "read_failed", hint: err instanceof Error ? err.message : "unknown" },
    };
  }
}
