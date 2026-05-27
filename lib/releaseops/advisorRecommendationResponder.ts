/**
 * Phase 506 — AdvisorRecommendation persistence responder.
 *
 * Bridges the pure engine to the database:
 *   • buildAdvisorGenerateResponse  — runs the engine for a release,
 *     supersedes prior pending rows for the same release, persists
 *     the new batch.
 *   • buildAdvisorListResponse      — inbox for the dashboard.
 *   • buildAdvisorDecisionResponse  — operator transitions a
 *     recommendation through accepted/rejected/implemented/dismissed.
 */

import { isMissingTable } from "./releaseListResponder";
import {
  generateRecommendations,
  ENGINE_VERSION,
  RECOMMENDATION_KINDS,
  RECOMMENDATION_SEVERITIES,
  type AdvisorInputs,
  type Recommendation,
  type RecommendationKind,
  type RecommendationSeverity,
} from "./releaseAdvisorEngine";

/* ──────────────────────────────────────────────────────────────────
   Closed-unions for operator decisions.
   ────────────────────────────────────────────────────────────── */

export const OPERATOR_DECISIONS = ["pending", "accepted", "rejected", "implemented", "dismissed"] as const;
export type OperatorDecision = (typeof OPERATOR_DECISIONS)[number];

export const OPERATOR_TRANSITIONS = ["accept", "reject", "implement", "dismiss"] as const;
export type OperatorTransition = (typeof OPERATOR_TRANSITIONS)[number];

function isOperatorDecision(s: string): s is OperatorDecision {
  return (OPERATOR_DECISIONS as readonly string[]).includes(s);
}
function isKind(s: string): s is RecommendationKind {
  return (RECOMMENDATION_KINDS as readonly string[]).includes(s);
}
function isSeverity(s: string): s is RecommendationSeverity {
  return (RECOMMENDATION_SEVERITIES as readonly string[]).includes(s);
}

/* ──────────────────────────────────────────────────────────────────
   Pure operator transition.
   ────────────────────────────────────────────────────────────── */

export interface DecisionPlan {
  ok: true;
  next: OperatorDecision;
}
export interface DecisionReject {
  ok: false;
  reason: "illegal_transition";
  from: OperatorDecision;
  action: OperatorTransition;
}

export function planOperatorDecision(
  current: OperatorDecision,
  action: OperatorTransition,
): DecisionPlan | DecisionReject {
  if (current !== "pending") {
    return { ok: false, reason: "illegal_transition", from: current, action };
  }
  if (action === "accept") return { ok: true, next: "accepted" };
  if (action === "reject") return { ok: true, next: "rejected" };
  if (action === "implement") return { ok: true, next: "implemented" };
  if (action === "dismiss") return { ok: true, next: "dismissed" };
  return { ok: false, reason: "illegal_transition", from: current, action };
}

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface RecommendationRow {
  id: string;
  organizationId: string;
  releaseId: string;
  kind: string;
  confidence: number;
  title: string;
  rationale: string;
  suggestedActionsJson: unknown;
  severity: string;
  operatorDecision: string;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  inputsJson: unknown;
  engineVersion: string;
  generatedAt: Date;
  updatedAt: Date;
}

export interface AdvisorRepo {
  advisorRecommendation: {
    findUnique(args: { where: { id: string } }): Promise<RecommendationRow | null>;
    findMany(args: {
      where: { organizationId: string; releaseId?: string; operatorDecision?: string };
      orderBy: { generatedAt: "desc" };
      take?: number;
    }): Promise<RecommendationRow[]>;
    updateMany(args: {
      where: { organizationId: string; releaseId: string; operatorDecision: "pending" };
      data: { operatorDecision: "dismissed" };
    }): Promise<{ count: number }>;
    createMany(args: {
      data: Array<{
        organizationId: string;
        releaseId: string;
        kind: RecommendationKind;
        confidence: number;
        title: string;
        rationale: string;
        suggestedActionsJson: unknown;
        severity: RecommendationSeverity;
        operatorDecision: "pending";
        inputsJson: unknown;
        engineVersion: string;
      }>;
    }): Promise<{ count: number }>;
    update(args: {
      where: { id: string };
      data: {
        operatorDecision: OperatorDecision;
        decidedByUserId: string;
        decidedAt: Date;
        decisionNote?: string | null;
      };
    }): Promise<RecommendationRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Projection.
   ────────────────────────────────────────────────────────────── */

export interface SuggestedActionView { label: string; href: string }

export interface RecommendationView {
  id: string;
  releaseId: string;
  kind: RecommendationKind | "unknown";
  confidence: number;
  title: string;
  rationale: string;
  suggestedActions: SuggestedActionView[];
  severity: RecommendationSeverity | "unknown";
  operatorDecision: OperatorDecision | "unknown";
  decidedByUserId: string | null;
  decidedAtIso: string | null;
  decisionNote: string | null;
  engineVersion: string;
  generatedAtIso: string;
}

function normalizeSuggestedActions(raw: unknown): SuggestedActionView[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is { label: unknown; href: unknown } => !!a && typeof a === "object")
    .map((a) => ({
      label: typeof a.label === "string" ? a.label : "",
      href: typeof a.href === "string" ? a.href : "",
    }))
    .filter((a) => a.label && a.href);
}

function projectRow(r: RecommendationRow): RecommendationView {
  return {
    id: r.id,
    releaseId: r.releaseId,
    kind: isKind(r.kind) ? r.kind : "unknown",
    confidence: r.confidence,
    title: r.title,
    rationale: r.rationale,
    suggestedActions: normalizeSuggestedActions(r.suggestedActionsJson),
    severity: isSeverity(r.severity) ? r.severity : "unknown",
    operatorDecision: isOperatorDecision(r.operatorDecision) ? r.operatorDecision : "unknown",
    decidedByUserId: r.decidedByUserId,
    decidedAtIso: r.decidedAt ? r.decidedAt.toISOString() : null,
    decisionNote: r.decisionNote,
    engineVersion: r.engineVersion,
    generatedAtIso: r.generatedAt.toISOString(),
  };
}

/* ──────────────────────────────────────────────────────────────────
   Generate (run engine + persist).
   ────────────────────────────────────────────────────────────── */

export interface GenerateInput {
  organizationId: string;
  releaseId: string;
  engineInputs: AdvisorInputs;
}

export type GenerateBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        engineVersion: string;
        recommendationCount: number;
        primary: RecommendationView | null;
        recommendations: RecommendationView[];
        supersededCount: number;
      };
    }
  | { ok: false; error: "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface GenerateResult { status: number; body: GenerateBody }

export async function buildAdvisorGenerateResponse(
  repo: AdvisorRepo,
  input: GenerateInput,
  opts: { correlationId?: string } = {},
): Promise<GenerateResult> {
  try {
    const output = generateRecommendations(input.engineInputs);

    // Supersede any prior pending recs for this release. Implemented
    // and accepted rows are preserved as historical fact.
    const superseded = await repo.advisorRecommendation.updateMany({
      where: { organizationId: input.organizationId, releaseId: input.releaseId, operatorDecision: "pending" },
      data: { operatorDecision: "dismissed" },
    });

    // Sanitize the inputs we persist: drop the live Date and replace
    // with iso strings so JSON is round-trippable.
    const safeInputs = {
      ...input.engineInputs,
      release: {
        ...input.engineInputs.release,
        plannedWindowStart: input.engineInputs.release.plannedWindowStart?.toISOString() ?? null,
        plannedWindowEnd: input.engineInputs.release.plannedWindowEnd?.toISOString() ?? null,
      },
      now: input.engineInputs.now.toISOString(),
    };

    const toInsert = output.recommendations.map((r) => ({
      organizationId: input.organizationId,
      releaseId: input.releaseId,
      kind: r.kind,
      confidence: r.confidence,
      title: r.title,
      rationale: r.rationale,
      suggestedActionsJson: r.suggestedActions as unknown,
      severity: r.severity,
      operatorDecision: "pending" as const,
      inputsJson: safeInputs as unknown,
      engineVersion: ENGINE_VERSION,
    }));

    if (toInsert.length > 0) {
      await repo.advisorRecommendation.createMany({ data: toInsert });
    }

    // Re-read the just-created rows so we return real ids/timestamps.
    const persisted = await repo.advisorRecommendation.findMany({
      where: { organizationId: input.organizationId, releaseId: input.releaseId, operatorDecision: "pending" },
      orderBy: { generatedAt: "desc" },
      take: 50,
    });
    const views = persisted.map(projectRow);
    const primary = pickPrimaryView(views);

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: output.generatedAtIso,
          engineVersion: output.engineVersion,
          recommendationCount: views.length,
          primary,
          recommendations: views,
          supersededCount: superseded.count,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "AdvisorRecommendation table needs Phase 506 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/**
 * Mirror the engine's primary-picking rule: highest-ranked non-proceed
 * view. Returns null when only proceed-ish rows exist.
 */
const KIND_RANK_VIEW: Record<RecommendationKind, number> = {
  block_deploy: 100,
  rollback: 90,
  needs_evidence: 80,
  propose_freeze: 70,
  proceed_with_caution: 50,
  propose_manual_fix_log: 40,
  propose_branch_protection_strengthen: 30,
  proceed: 10,
};

function pickPrimaryView(views: RecommendationView[]): RecommendationView | null {
  const candidates = views.filter((v) => v.kind !== "proceed" && v.kind !== "unknown");
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const ka = a.kind === "unknown" ? 0 : KIND_RANK_VIEW[a.kind];
    const kb = b.kind === "unknown" ? 0 : KIND_RANK_VIEW[b.kind];
    return kb - ka || b.confidence - a.confidence;
  })[0];
}

/* ──────────────────────────────────────────────────────────────────
   List.
   ────────────────────────────────────────────────────────────── */

export type ListBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        recommendations: RecommendationView[];
        summary: {
          total: number;
          pending: number;
          accepted: number;
          rejected: number;
          implemented: number;
          dismissed: number;
        };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ListResult { status: number; body: ListBody }

export async function buildAdvisorListResponse(
  repo: AdvisorRepo,
  input: { organizationId: string; releaseId?: string; operatorDecision?: string },
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ListResult> {
  try {
    const now = opts.now ?? new Date();
    const where: { organizationId: string; releaseId?: string; operatorDecision?: string } = {
      organizationId: input.organizationId,
    };
    if (input.releaseId) where.releaseId = input.releaseId;
    if (input.operatorDecision) where.operatorDecision = input.operatorDecision;
    const rows = await repo.advisorRecommendation.findMany({
      where,
      orderBy: { generatedAt: "desc" },
      take: 200,
    });
    const recommendations = rows.map(projectRow);
    let pending = 0, accepted = 0, rejected = 0, implemented = 0, dismissed = 0;
    for (const r of recommendations) {
      if (r.operatorDecision === "pending") pending += 1;
      else if (r.operatorDecision === "accepted") accepted += 1;
      else if (r.operatorDecision === "rejected") rejected += 1;
      else if (r.operatorDecision === "implemented") implemented += 1;
      else if (r.operatorDecision === "dismissed") dismissed += 1;
    }
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          recommendations,
          summary: { total: recommendations.length, pending, accepted, rejected, implemented, dismissed },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "AdvisorRecommendation table needs Phase 506 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Operator decision transition.
   ────────────────────────────────────────────────────────────── */

export interface DecisionInput {
  organizationId: string;
  actorUserId: string;
  recommendationId: string;
  action: OperatorTransition;
  note?: string;
}

export type DecisionError =
  | "recommendation_not_found"
  | "cross_org_recommendation"
  | "unknown_current_decision"
  | "illegal_transition";

export type DecisionBody =
  | {
      ok: true;
      data: {
        id: string;
        previousDecision: OperatorDecision;
        decision: OperatorDecision;
        action: OperatorTransition;
      };
    }
  | { ok: false; error: DecisionError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface DecisionResult { status: number; body: DecisionBody }

export async function buildAdvisorDecisionResponse(
  repo: AdvisorRepo,
  input: DecisionInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<DecisionResult> {
  if (!(OPERATOR_TRANSITIONS as readonly string[]).includes(input.action)) {
    return { status: 422, body: { ok: false, error: "illegal_transition", hint: `Unknown action "${input.action}".` } };
  }
  try {
    const existing = await repo.advisorRecommendation.findUnique({ where: { id: input.recommendationId } });
    if (!existing) return { status: 404, body: { ok: false, error: "recommendation_not_found" } };
    if (existing.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_recommendation" } };
    }
    if (!isOperatorDecision(existing.operatorDecision)) {
      return {
        status: 409,
        body: { ok: false, error: "unknown_current_decision", hint: `Recommendation.operatorDecision="${existing.operatorDecision}" not in closed-union.` },
      };
    }
    const plan = planOperatorDecision(existing.operatorDecision as OperatorDecision, input.action);
    if (!plan.ok) {
      return {
        status: 409,
        body: { ok: false, error: "illegal_transition", hint: `Cannot ${input.action} from "${existing.operatorDecision}".` },
      };
    }
    const now = opts.now ?? new Date();
    await repo.advisorRecommendation.update({
      where: { id: existing.id },
      data: {
        operatorDecision: plan.next,
        decidedByUserId: input.actorUserId,
        decidedAt: now,
        decisionNote: input.note?.trim() || null,
      },
    });
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          id: existing.id,
          previousDecision: existing.operatorDecision as OperatorDecision,
          decision: plan.next,
          action: input.action,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "AdvisorRecommendation table needs Phase 506 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
