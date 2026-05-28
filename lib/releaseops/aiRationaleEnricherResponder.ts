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

async function persistEnrichment(
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
   Re-exports for routes.
   ────────────────────────────────────────────────────────────── */

export { RATIONALE_ENRICHER_ENGINE_VERSION };
