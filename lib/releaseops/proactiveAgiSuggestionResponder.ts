/**
 * Phase 525 — Proactive AGI Suggestion responder.
 *
 * Persists generated suggestion sets and exposes list / decide
 * surfaces for the dashboard. Follows the same DI Prisma repo pattern
 * as the rest of releaseops.
 *
 * Three responder surfaces:
 *   • buildSuggestionGenerateResponse — run the engine, supersede
 *     prior pending suggestions, persist a fresh set.
 *   • buildSuggestionListResponse — paginated read of the most-recent
 *     suggestions for the dashboard.
 *   • buildSuggestionDecideResponse — operator transitions
 *     pending → acted | dismissed (closed-union state machine).
 *
 * Best-effort: persistence failures bubble up as 503/500 envelopes.
 */

import { isMissingTable } from "./releaseListResponder";
import {
  generateProactiveSuggestions,
  isSuggestionKind,
  PROACTIVE_SUGGESTION_ENGINE_VERSION,
  type ProposedSuggestion,
  type SuggestionContextEntry,
  type SuggestionContextSummary,
  type SuggestionKind,
  type SuggestionOutcome,
} from "./proactiveAgiSuggestionEngine";
import type { RationaleAiFetcher } from "./aiRationaleEnricherEngine";

/* ──────────────────────────────────────────────────────────────────
   Closed-unions.
   ────────────────────────────────────────────────────────────── */

export const SUGGESTION_DECISIONS = ["pending", "acted", "dismissed"] as const;
export type SuggestionDecision = (typeof SUGGESTION_DECISIONS)[number];

export const SUGGESTION_TRANSITIONS = ["act", "dismiss"] as const;
export type SuggestionTransition = (typeof SUGGESTION_TRANSITIONS)[number];

export function isSuggestionDecision(s: string): s is SuggestionDecision {
  return (SUGGESTION_DECISIONS as readonly string[]).includes(s);
}

export interface DecisionPlan { ok: true; next: SuggestionDecision }
export interface DecisionReject { ok: false; reason: "illegal_transition"; from: SuggestionDecision; action: SuggestionTransition }

export function planSuggestionDecision(
  current: SuggestionDecision,
  action: SuggestionTransition,
): DecisionPlan | DecisionReject {
  if (current !== "pending") return { ok: false, reason: "illegal_transition", from: current, action };
  if (action === "act") return { ok: true, next: "acted" };
  if (action === "dismiss") return { ok: true, next: "dismissed" };
  return { ok: false, reason: "illegal_transition", from: current, action };
}

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface SuggestionRow {
  id: string;
  organizationId: string;
  kind: string;
  title: string;
  rationale: string;
  targetKind: string | null;
  targetId: string | null;
  confidence: number;
  citationsJson: unknown;
  operatorDecision: string;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  outcome: string;
  errorMessage: string | null;
  modelHint: string | null;
  engineVersion: string;
  windowSize: number;
  generatedAt: Date;
  updatedAt: Date;
}

export interface ProactiveSuggestionRepo {
  proactiveAgiSuggestion: {
    findUnique(args: { where: { id: string } }): Promise<SuggestionRow | null>;
    findMany(args: {
      where: { organizationId: string; operatorDecision?: string; kind?: string };
      orderBy: { generatedAt: "desc" };
      take?: number;
    }): Promise<SuggestionRow[]>;
    updateMany(args: {
      where: { organizationId: string; operatorDecision: "pending" };
      data: { operatorDecision: "dismissed" };
    }): Promise<{ count: number }>;
    createMany(args: {
      data: Array<{
        organizationId: string;
        kind: string;
        title: string;
        rationale: string;
        targetKind: string | null;
        targetId: string | null;
        confidence: number;
        citationsJson: unknown;
        operatorDecision: "pending";
        outcome: string;
        errorMessage: string | null;
        modelHint: string | null;
        engineVersion: string;
        windowSize: number;
      }>;
    }): Promise<{ count: number }>;
    update(args: {
      where: { id: string };
      data: {
        operatorDecision: SuggestionDecision;
        decidedByUserId: string;
        decidedAt: Date;
        decisionNote?: string | null;
      };
    }): Promise<SuggestionRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Views.
   ────────────────────────────────────────────────────────────── */

export interface SuggestionView {
  id: string;
  kind: SuggestionKind | "unknown";
  title: string;
  rationale: string;
  targetKind: string | null;
  targetId: string | null;
  confidence: number;
  citations: string[];
  operatorDecision: SuggestionDecision | "unknown";
  decidedByUserId: string | null;
  decidedAtIso: string | null;
  decisionNote: string | null;
  outcome: SuggestionOutcome | "unknown";
  errorMessage: string | null;
  modelHint: string | null;
  engineVersion: string;
  windowSize: number;
  generatedAtIso: string;
}

export interface ListData {
  generatedAt: string;
  suggestions: SuggestionView[];
  summary: {
    total: number;
    pending: number;
    acted: number;
    dismissed: number;
    aiGenerated: number;
    fallbackRules: number;
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

function rowToView(row: SuggestionRow): SuggestionView {
  return {
    id: row.id,
    kind: isSuggestionKind(row.kind) ? row.kind : "unknown",
    title: row.title,
    rationale: row.rationale,
    targetKind: row.targetKind,
    targetId: row.targetId,
    confidence: row.confidence,
    citations: toJsonArray(row.citationsJson),
    operatorDecision: isSuggestionDecision(row.operatorDecision) ? row.operatorDecision : "unknown",
    decidedByUserId: row.decidedByUserId,
    decidedAtIso: row.decidedAt ? row.decidedAt.toISOString() : null,
    decisionNote: row.decisionNote,
    outcome: (row.outcome === "ai_generated" || row.outcome === "fallback_rules" || row.outcome === "error") ? row.outcome : "unknown",
    errorMessage: row.errorMessage,
    modelHint: row.modelHint,
    engineVersion: row.engineVersion,
    windowSize: row.windowSize,
    generatedAtIso: row.generatedAt.toISOString(),
  };
}

/* ──────────────────────────────────────────────────────────────────
   Generate.
   ────────────────────────────────────────────────────────────── */

export interface GenerateInput {
  organizationId: string;
  entries: SuggestionContextEntry[];
  summaries: SuggestionContextSummary[];
  fetcher: RationaleAiFetcher | null;
}

export interface GenerateData {
  generatedAt: string;
  suggestions: SuggestionView[];
  supersededCount: number;
  outcome: SuggestionOutcome;
  modelHint: string | null;
}

export async function buildSuggestionGenerateResponse(
  repo: ProactiveSuggestionRepo,
  input: GenerateInput,
): Promise<ApiResponse<GenerateData>> {
  const set = await generateProactiveSuggestions(input.entries, input.summaries, input.fetcher);
  if (set.suggestions.length === 0) {
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: new Date().toISOString(),
          suggestions: [],
          supersededCount: 0,
          outcome: set.outcome,
          modelHint: set.modelHint,
        },
      },
    };
  }

  try {
    // Supersede any prior pending suggestions so the dashboard only
    // shows the most recent recommendation set.
    const superseded = await repo.proactiveAgiSuggestion.updateMany({
      where: { organizationId: input.organizationId, operatorDecision: "pending" },
      data: { operatorDecision: "dismissed" },
    });

    await repo.proactiveAgiSuggestion.createMany({
      data: set.suggestions.map((s: ProposedSuggestion) => ({
        organizationId: input.organizationId,
        kind: s.kind,
        title: s.title,
        rationale: s.rationale,
        targetKind: s.targetKind,
        targetId: s.targetId,
        confidence: s.confidence,
        citationsJson: s.citations,
        operatorDecision: "pending" as const,
        outcome: set.outcome,
        errorMessage: set.errorMessage,
        modelHint: set.modelHint,
        engineVersion: set.engineVersion,
        windowSize: set.windowSize,
      })),
    });

    const persisted = await repo.proactiveAgiSuggestion.findMany({
      where: { organizationId: input.organizationId, operatorDecision: "pending" },
      orderBy: { generatedAt: "desc" },
      take: 20,
    });

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: new Date().toISOString(),
          suggestions: persisted.map(rowToView),
          supersededCount: superseded.count,
          outcome: set.outcome,
          modelHint: set.modelHint,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Run prisma migrate deploy for 20260528160000_add_proactive_agi_suggestion." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "persist_failed", hint: err instanceof Error ? err.message : "unknown" },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   List.
   ────────────────────────────────────────────────────────────── */

export interface ListInput {
  organizationId: string;
  operatorDecision?: string;
  kind?: string;
  take?: number;
}

export async function buildSuggestionListResponse(
  repo: ProactiveSuggestionRepo,
  input: ListInput,
): Promise<ApiResponse<ListData>> {
  const take = Math.max(1, Math.min(200, input.take ?? 50));
  try {
    const rows = await repo.proactiveAgiSuggestion.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.operatorDecision ? { operatorDecision: input.operatorDecision } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
      },
      orderBy: { generatedAt: "desc" },
      take,
    });
    const suggestions = rows.map(rowToView);
    let pending = 0, acted = 0, dismissed = 0, aiGenerated = 0, fallbackRules = 0;
    for (const r of rows) {
      if (r.operatorDecision === "pending") pending++;
      else if (r.operatorDecision === "acted") acted++;
      else if (r.operatorDecision === "dismissed") dismissed++;
      if (r.outcome === "ai_generated") aiGenerated++;
      else if (r.outcome === "fallback_rules") fallbackRules++;
    }
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: new Date().toISOString(),
          suggestions,
          summary: { total: suggestions.length, pending, acted, dismissed, aiGenerated, fallbackRules },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Run prisma migrate deploy for 20260528160000_add_proactive_agi_suggestion." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "read_failed", hint: err instanceof Error ? err.message : "unknown" },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Decide (state machine).
   ────────────────────────────────────────────────────────────── */

export interface DecideInput {
  organizationId: string;
  suggestionId: string;
  action: string;
  decidedByUserId: string;
  note?: string;
  now?: Date;
}

export interface DecideData {
  suggestion: SuggestionView;
  previousDecision: SuggestionDecision;
  decision: SuggestionDecision;
}

export async function buildSuggestionDecideResponse(
  repo: ProactiveSuggestionRepo,
  input: DecideInput,
): Promise<ApiResponse<DecideData>> {
  if (input.action !== "act" && input.action !== "dismiss") {
    return {
      status: 400,
      body: { ok: false, error: "invalid_action", hint: "action must be 'act' or 'dismiss'." },
    };
  }

  let row: SuggestionRow | null;
  try {
    row = await repo.proactiveAgiSuggestion.findUnique({ where: { id: input.suggestionId } });
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Run prisma migrate deploy for 20260528160000_add_proactive_agi_suggestion." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "read_failed", hint: err instanceof Error ? err.message : "unknown" },
    };
  }

  if (!row || row.organizationId !== input.organizationId) {
    return { status: 404, body: { ok: false, error: "suggestion_not_found" } };
  }

  const current = isSuggestionDecision(row.operatorDecision) ? row.operatorDecision : "pending";
  const plan = planSuggestionDecision(current, input.action);
  if (!plan.ok) {
    return {
      status: 409,
      body: {
        ok: false,
        error: "illegal_transition",
        hint: `Cannot ${input.action} a ${current} suggestion.`,
      },
    };
  }

  try {
    const updated = await repo.proactiveAgiSuggestion.update({
      where: { id: input.suggestionId },
      data: {
        operatorDecision: plan.next,
        decidedByUserId: input.decidedByUserId,
        decidedAt: input.now ?? new Date(),
        ...(input.note ? { decisionNote: input.note } : {}),
      },
    });
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          suggestion: rowToView(updated),
          previousDecision: current,
          decision: plan.next,
        },
      },
    };
  } catch (err) {
    return {
      status: 500,
      body: { ok: false, error: "update_failed", hint: err instanceof Error ? err.message : "unknown" },
    };
  }
}

export { PROACTIVE_SUGGESTION_ENGINE_VERSION };
