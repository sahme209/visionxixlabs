/**
 * Phase 518 — AI rationale enricher responder.
 *
 * Glues the pure engine to persistence + the council-decision read.
 * Three surfaces:
 *
 *   • buildEnrichmentGenerateResponse — operator triggers an enrichment
 *     for a council decisionId. Loads the decision + inputs, calls
 *     the engine, upserts the row.
 *   • buildEnrichmentReadResponse — read the cached enrichment for a
 *     target (decisionId).
 *   • enrichDecisionBestEffort — programmatic entry used by the
 *     council-generate route (auto-enrich on each new decision).
 *
 * Every response is shape-compatible with the dashboard envelope:
 *   { ok: true, data: ... } | { ok: false, error, hint }
 *
 * Best-effort: a missing AI fetcher → fallback narrative is persisted
 * with outcome="fallback_rules". A persistence failure on
 * enrichDecisionBestEffort never throws and never blocks the council.
 */

import { isMissingTable } from "./releaseListResponder";
import {
  enrichDecisionRationale,
  RATIONALE_ENRICHER_ENGINE_VERSION,
  type RationaleAiFetcher,
  type RationaleEnrichment,
} from "./aiRationaleEnricherEngine";
import type { CouncilDecision } from "./advisorCouncilEngine";
import type { AdvisorInputs } from "./releaseAdvisorEngine";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface EnrichmentRow {
  id: string;
  organizationId: string;
  targetKind: string;
  targetId: string;
  narrative: string;
  riskFactorsJson: unknown;
  nextActionsJson: unknown;
  outcome: string;
  errorMessage: string | null;
  modelHint: string | null;
  engineVersion: string;
  generatedAt: Date;
  updatedAt: Date;
}

export interface EnrichmentRepo {
  aiRationaleEnrichment: {
    findUnique(args: {
      where: { organizationId_targetKind_targetId: { organizationId: string; targetKind: string; targetId: string } };
    }): Promise<EnrichmentRow | null>;
    findMany(args: {
      where: { organizationId: string; targetKind?: string };
      orderBy: { generatedAt: "desc" };
      take?: number;
    }): Promise<EnrichmentRow[]>;
    upsert(args: {
      where: { organizationId_targetKind_targetId: { organizationId: string; targetKind: string; targetId: string } };
      create: {
        organizationId: string;
        targetKind: string;
        targetId: string;
        narrative: string;
        riskFactorsJson: unknown;
        nextActionsJson: unknown;
        outcome: string;
        errorMessage: string | null;
        modelHint: string | null;
        engineVersion: string;
      };
      update: {
        narrative: string;
        riskFactorsJson: unknown;
        nextActionsJson: unknown;
        outcome: string;
        errorMessage: string | null;
        modelHint: string | null;
        engineVersion: string;
      };
    }): Promise<EnrichmentRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   View shape (returned to dashboard).
   ────────────────────────────────────────────────────────────── */

export interface EnrichmentView {
  targetKind: string;
  targetId: string;
  narrative: string;
  riskFactors: string[];
  nextActions: string[];
  outcome: string;
  errorMessage: string | null;
  modelHint: string | null;
  engineVersion: string;
  generatedAtIso: string;
}

export type ApiResponse<T> =
  | { status: number; body: { ok: true; data: T } }
  | { status: number; body: { ok: false; error: string; hint?: string } };

/* ──────────────────────────────────────────────────────────────────
   Internal helpers.
   ────────────────────────────────────────────────────────────── */

function toJsonArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    const out: string[] = [];
    for (const item of input) if (typeof item === "string") out.push(item);
    return out;
  }
  return [];
}

function rowToView(row: EnrichmentRow): EnrichmentView {
  return {
    targetKind: row.targetKind,
    targetId: row.targetId,
    narrative: row.narrative,
    riskFactors: toJsonArray(row.riskFactorsJson),
    nextActions: toJsonArray(row.nextActionsJson),
    outcome: row.outcome,
    errorMessage: row.errorMessage,
    modelHint: row.modelHint,
    engineVersion: row.engineVersion,
    generatedAtIso: row.generatedAt.toISOString(),
  };
}

/**
 * Persist a pre-built enrichment for any target (council, triage,
 * remediation, ...). Best-effort: caller chooses whether to surface
 * errors. Public because Phase 519+ surfaces share this persistence
 * path.
 */
export async function persistEnrichment(
  repo: EnrichmentRepo,
  organizationId: string,
  targetId: string,
  enrichment: RationaleEnrichment,
  targetKind = "council",
): Promise<EnrichmentRow> {
  return repo.aiRationaleEnrichment.upsert({
    where: { organizationId_targetKind_targetId: { organizationId, targetKind, targetId } },
    create: {
      organizationId,
      targetKind,
      targetId,
      narrative: enrichment.narrative,
      riskFactorsJson: enrichment.riskFactors,
      nextActionsJson: enrichment.nextActions,
      outcome: enrichment.outcome,
      errorMessage: enrichment.errorMessage,
      modelHint: enrichment.modelHint,
      engineVersion: enrichment.engineVersion,
    },
    update: {
      narrative: enrichment.narrative,
      riskFactorsJson: enrichment.riskFactors,
      nextActionsJson: enrichment.nextActions,
      outcome: enrichment.outcome,
      errorMessage: enrichment.errorMessage,
      modelHint: enrichment.modelHint,
      engineVersion: enrichment.engineVersion,
    },
  });
}

/* ──────────────────────────────────────────────────────────────────
   Public surfaces.
   ────────────────────────────────────────────────────────────── */

export interface GenerateInput {
  organizationId: string;
  decisionId: string;
  decision: CouncilDecision;
  inputs: AdvisorInputs;
  fetcher: RationaleAiFetcher | null;
}

/**
 * Operator-triggered enrichment generate. Always persists (even the
 * fallback narrative) so the dashboard has something to render.
 */
export async function buildEnrichmentGenerateResponse(
  repo: EnrichmentRepo,
  input: GenerateInput,
): Promise<ApiResponse<{ enrichment: EnrichmentView }>> {
  const enrichment = await enrichDecisionRationale(input.decision, input.inputs, input.fetcher);
  try {
    const row = await persistEnrichment(repo, input.organizationId, input.decisionId, enrichment);
    return { status: 200, body: { ok: true, data: { enrichment: rowToView(row) } } };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Run prisma migrate deploy for 20260528140000_add_ai_rationale_enrichment." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "persist_failed", hint: err instanceof Error ? err.message : "unknown" },
    };
  }
}

/**
 * Cached enrichment read for a decision. Returns 200 with null when
 * nothing has been generated yet.
 */
export async function buildEnrichmentReadResponse(
  repo: EnrichmentRepo,
  organizationId: string,
  targetId: string,
  targetKind = "council",
): Promise<ApiResponse<{ enrichment: EnrichmentView | null }>> {
  try {
    const row = await repo.aiRationaleEnrichment.findUnique({
      where: { organizationId_targetKind_targetId: { organizationId, targetKind, targetId } },
    });
    return { status: 200, body: { ok: true, data: { enrichment: row ? rowToView(row) : null } } };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Run prisma migrate deploy for 20260528140000_add_ai_rationale_enrichment." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "read_failed", hint: err instanceof Error ? err.message : "unknown" },
    };
  }
}

/**
 * Best-effort programmatic entry. Called by the council-generate
 * route so every new decision lands with an enrichment already
 * persisted. NEVER throws — returns null on any persistence failure.
 */
export async function enrichDecisionBestEffort(
  repo: EnrichmentRepo,
  input: GenerateInput,
): Promise<EnrichmentView | null> {
  let enrichment: RationaleEnrichment;
  try {
    enrichment = await enrichDecisionRationale(input.decision, input.inputs, input.fetcher);
  } catch {
    // engine never throws, but defensive
    return null;
  }
  try {
    const row = await persistEnrichment(repo, input.organizationId, input.decisionId, enrichment);
    return rowToView(row);
  } catch {
    return null;
  }
}

/* ──────────────────────────────────────────────────────────────────
   Phase 521 — AGI Memory cross-engine list.
   ────────────────────────────────────────────────────────────── */

export interface MemoryListData {
  generatedAt: string;
  entries: EnrichmentView[];
  summary: {
    total: number;
    aiGenerated: number;
    fallbackRules: number;
    errored: number;
    byTargetKind: Record<string, number>;
    modelsUsed: string[];
  };
}

export interface MemoryListInput {
  organizationId: string;
  targetKind?: string;
  take?: number;
}

/**
 * Lists every persisted rationale enrichment across all AGI surfaces
 * (council/triage/remediation/...), sorted newest-first. Used by the
 * AGI Memory cockpit to surface what Claude has been reasoning about.
 *
 * Pagination via `take` (default 100, max 500). Optional filter by
 * `targetKind` to scope to a single surface.
 */
export async function buildAgiMemoryListResponse(
  repo: EnrichmentRepo,
  input: MemoryListInput,
): Promise<ApiResponse<MemoryListData>> {
  const take = Math.max(1, Math.min(500, input.take ?? 100));
  try {
    const rows = await repo.aiRationaleEnrichment.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.targetKind ? { targetKind: input.targetKind } : {}),
      },
      orderBy: { generatedAt: "desc" },
      take,
    });

    const entries = rows.map(rowToView);
    const byTargetKind: Record<string, number> = {};
    const modelsSet = new Set<string>();
    let aiGenerated = 0;
    let fallbackRules = 0;
    let errored = 0;

    for (const row of rows) {
      byTargetKind[row.targetKind] = (byTargetKind[row.targetKind] ?? 0) + 1;
      if (row.modelHint) modelsSet.add(row.modelHint);
      if (row.outcome === "ai_generated") aiGenerated++;
      else if (row.outcome === "fallback_rules") fallbackRules++;
      else if (row.outcome === "error") errored++;
    }

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: new Date().toISOString(),
          entries,
          summary: {
            total: entries.length,
            aiGenerated,
            fallbackRules,
            errored,
            byTargetKind,
            modelsUsed: Array.from(modelsSet).sort(),
          },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Run prisma migrate deploy for 20260528140000_add_ai_rationale_enrichment." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "read_failed", hint: err instanceof Error ? err.message : "unknown" },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Re-exports for routes.
   ────────────────────────────────────────────────────────────── */

export { RATIONALE_ENRICHER_ENGINE_VERSION };
