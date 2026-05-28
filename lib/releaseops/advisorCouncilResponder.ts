/**
 * Phase 514 — AdvisorCouncilDecision persistence responder.
 */

import { isMissingTable } from "./releaseListResponder";
import {
  runAdvisorCouncil,
  runAdvisorCouncilAsync,
  COUNCIL_ENGINE_VERSION,
  DEFAULT_COUNCIL,
  type AdvisorVoter,
  type AsyncAdvisorVoter,
  type CouncilVote,
} from "./advisorCouncilEngine";
import { RECOMMENDATION_KINDS, type AdvisorInputs, type RecommendationKind } from "./releaseAdvisorEngine";

/* ──────────────────────────────────────────────────────────────────
   Closed-unions.
   ────────────────────────────────────────────────────────────── */

export const COUNCIL_DECISIONS = ["pending", "accepted", "overridden", "dismissed"] as const;
export type CouncilDecisionState = (typeof COUNCIL_DECISIONS)[number];

export const COUNCIL_TRANSITIONS = ["accept", "override", "dismiss"] as const;
export type CouncilTransition = (typeof COUNCIL_TRANSITIONS)[number];

function isCouncilDecision(s: string): s is CouncilDecisionState {
  return (COUNCIL_DECISIONS as readonly string[]).includes(s);
}
function isKind(s: string): s is RecommendationKind {
  return (RECOMMENDATION_KINDS as readonly string[]).includes(s);
}

/* ──────────────────────────────────────────────────────────────────
   Pure transition.
   ────────────────────────────────────────────────────────────── */

export interface DecisionPlan { ok: true; next: CouncilDecisionState }
export interface DecisionReject { ok: false; reason: "illegal_transition"; from: CouncilDecisionState; action: CouncilTransition }

export function planCouncilDecision(
  current: CouncilDecisionState,
  action: CouncilTransition,
): DecisionPlan | DecisionReject {
  if (current !== "pending") return { ok: false, reason: "illegal_transition", from: current, action };
  if (action === "accept") return { ok: true, next: "accepted" };
  if (action === "override") return { ok: true, next: "overridden" };
  if (action === "dismiss") return { ok: true, next: "dismissed" };
  return { ok: false, reason: "illegal_transition", from: current, action };
}

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface CouncilRow {
  id: string;
  organizationId: string;
  releaseId: string;
  consensusKind: string;
  agreementScore: number;
  title: string;
  rationale: string;
  votesJson: unknown;
  voterCount: number;
  inputsJson: unknown;
  engineVersion: string;
  operatorDecision: string;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  overrideKind: string | null;
  generatedAt: Date;
  updatedAt: Date;
}

export interface AdvisorCouncilRepo {
  advisorCouncilDecision: {
    findUnique(args: { where: { id: string } }): Promise<CouncilRow | null>;
    findMany(args: {
      where: { organizationId: string; releaseId?: string; operatorDecision?: string };
      orderBy: { generatedAt: "desc" };
      take?: number;
    }): Promise<CouncilRow[]>;
    updateMany(args: {
      where: { organizationId: string; releaseId: string; operatorDecision: "pending" };
      data: { operatorDecision: "dismissed" };
    }): Promise<{ count: number }>;
    create(args: {
      data: {
        organizationId: string;
        releaseId: string;
        consensusKind: string;
        agreementScore: number;
        title: string;
        rationale: string;
        votesJson: unknown;
        voterCount: number;
        inputsJson: unknown;
        engineVersion: string;
        operatorDecision: "pending";
      };
    }): Promise<CouncilRow>;
    update(args: {
      where: { id: string };
      data: {
        operatorDecision: CouncilDecisionState;
        decidedByUserId: string;
        decidedAt: Date;
        decisionNote?: string | null;
        overrideKind?: string | null;
      };
    }): Promise<CouncilRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Projection.
   ────────────────────────────────────────────────────────────── */

export interface CouncilView {
  id: string;
  releaseId: string;
  consensusKind: RecommendationKind | "no_consensus" | "unknown";
  agreementScore: number;
  title: string;
  rationale: string;
  votes: CouncilVote[];
  voterCount: number;
  engineVersion: string;
  operatorDecision: CouncilDecisionState | "unknown";
  decidedByUserId: string | null;
  decidedAtIso: string | null;
  decisionNote: string | null;
  overrideKind: string | null;
  generatedAtIso: string;
}

function projectRow(r: CouncilRow): CouncilView {
  const consensusKind: CouncilView["consensusKind"] =
    r.consensusKind === "no_consensus" ? "no_consensus" :
    isKind(r.consensusKind) ? r.consensusKind : "unknown";
  return {
    id: r.id,
    releaseId: r.releaseId,
    consensusKind,
    agreementScore: r.agreementScore,
    title: r.title,
    rationale: r.rationale,
    votes: Array.isArray(r.votesJson) ? (r.votesJson as CouncilVote[]) : [],
    voterCount: r.voterCount,
    engineVersion: r.engineVersion,
    operatorDecision: isCouncilDecision(r.operatorDecision) ? r.operatorDecision : "unknown",
    decidedByUserId: r.decidedByUserId,
    decidedAtIso: r.decidedAt ? r.decidedAt.toISOString() : null,
    decisionNote: r.decisionNote,
    overrideKind: r.overrideKind,
    generatedAtIso: r.generatedAt.toISOString(),
  };
}

/* ──────────────────────────────────────────────────────────────────
   Generate.
   ────────────────────────────────────────────────────────────── */

export interface GenerateInput {
  organizationId: string;
  releaseId: string;
  engineInputs: AdvisorInputs;
  voters?: AdvisorVoter[];
  /** Phase 516 — optional async voters (e.g. AI-native) run in parallel. */
  asyncVoters?: AsyncAdvisorVoter[];
}

export type GenerateBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        engineVersion: string;
        decision: CouncilView;
        supersededCount: number;
      };
    }
  | { ok: false; error: "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface GenerateResult { status: number; body: GenerateBody }

export async function buildCouncilGenerateResponse(
  repo: AdvisorCouncilRepo,
  input: GenerateInput,
  opts: { correlationId?: string } = {},
): Promise<GenerateResult> {
  try {
    // Phase 516 — when async voters supplied, run the async council
    // (waits for AI). Otherwise the sync path stays cheap.
    const output = input.asyncVoters && input.asyncVoters.length > 0
      ? await runAdvisorCouncilAsync(
          input.engineInputs,
          input.voters ?? DEFAULT_COUNCIL,
          input.asyncVoters,
        )
      : runAdvisorCouncil(input.engineInputs, input.voters ?? DEFAULT_COUNCIL);

    const superseded = await repo.advisorCouncilDecision.updateMany({
      where: { organizationId: input.organizationId, releaseId: input.releaseId, operatorDecision: "pending" },
      data: { operatorDecision: "dismissed" },
    });

    const safeInputs = {
      ...input.engineInputs,
      release: {
        ...input.engineInputs.release,
        plannedWindowStart: input.engineInputs.release.plannedWindowStart?.toISOString() ?? null,
        plannedWindowEnd: input.engineInputs.release.plannedWindowEnd?.toISOString() ?? null,
      },
      now: input.engineInputs.now.toISOString(),
    };

    const row = await repo.advisorCouncilDecision.create({
      data: {
        organizationId: input.organizationId,
        releaseId: input.releaseId,
        consensusKind: output.consensusKind,
        agreementScore: output.agreementScore,
        title: output.title,
        rationale: output.rationale,
        votesJson: output.votes as unknown,
        voterCount: output.voterCount,
        inputsJson: safeInputs as unknown,
        engineVersion: COUNCIL_ENGINE_VERSION,
        operatorDecision: "pending",
      },
    });

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: output.generatedAtIso,
          engineVersion: output.engineVersion,
          decision: projectRow(row),
          supersededCount: superseded.count,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "AdvisorCouncilDecision table needs Phase 514 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   List.
   ────────────────────────────────────────────────────────────── */

export type ListBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        decisions: CouncilView[];
        summary: {
          total: number;
          pending: number;
          accepted: number;
          overridden: number;
          dismissed: number;
          highAgreement: number;       // ≥ 75
          noConsensus: number;
          avgAgreementScore: number;
        };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ListResult { status: number; body: ListBody }

export async function buildCouncilListResponse(
  repo: AdvisorCouncilRepo,
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
    const rows = await repo.advisorCouncilDecision.findMany({ where, orderBy: { generatedAt: "desc" }, take: 200 });
    const decisions = rows.map(projectRow);
    let pending = 0, accepted = 0, overridden = 0, dismissed = 0, highAgreement = 0, noConsensus = 0;
    let scoreSum = 0;
    for (const d of decisions) {
      if (d.operatorDecision === "pending") pending += 1;
      else if (d.operatorDecision === "accepted") accepted += 1;
      else if (d.operatorDecision === "overridden") overridden += 1;
      else if (d.operatorDecision === "dismissed") dismissed += 1;
      if (d.agreementScore >= 75) highAgreement += 1;
      if (d.consensusKind === "no_consensus") noConsensus += 1;
      scoreSum += d.agreementScore;
    }
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          decisions,
          summary: {
            total: decisions.length,
            pending, accepted, overridden, dismissed,
            highAgreement, noConsensus,
            avgAgreementScore: decisions.length === 0 ? 0 : Math.round(scoreSum / decisions.length),
          },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "AdvisorCouncilDecision table needs Phase 514 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Decision.
   ────────────────────────────────────────────────────────────── */

export interface DecisionInput {
  organizationId: string;
  actorUserId: string;
  decisionId: string;
  action: CouncilTransition;
  note?: string;
  overrideKind?: string;
}

export type DecisionError =
  | "decision_not_found"
  | "cross_org_decision"
  | "unknown_current_decision"
  | "illegal_transition"
  | "override_kind_invalid";

export type DecisionBody =
  | {
      ok: true;
      data: {
        id: string;
        previousDecision: CouncilDecisionState;
        decision: CouncilDecisionState;
        action: CouncilTransition;
        overrideKind: string | null;
      };
    }
  | { ok: false; error: DecisionError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface DecisionResult { status: number; body: DecisionBody }

export async function buildCouncilDecisionResponse(
  repo: AdvisorCouncilRepo,
  input: DecisionInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<DecisionResult> {
  if (!(COUNCIL_TRANSITIONS as readonly string[]).includes(input.action)) {
    return { status: 422, body: { ok: false, error: "illegal_transition", hint: `Unknown action "${input.action}".` } };
  }
  if (input.action === "override") {
    if (!input.overrideKind || !isKind(input.overrideKind)) {
      return { status: 422, body: { ok: false, error: "override_kind_invalid", hint: "overrideKind must be a valid recommendation kind." } };
    }
  }
  try {
    const existing = await repo.advisorCouncilDecision.findUnique({ where: { id: input.decisionId } });
    if (!existing) return { status: 404, body: { ok: false, error: "decision_not_found" } };
    if (existing.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_decision" } };
    }
    if (!isCouncilDecision(existing.operatorDecision)) {
      return {
        status: 409,
        body: { ok: false, error: "unknown_current_decision", hint: `operatorDecision="${existing.operatorDecision}" not in closed-union.` },
      };
    }
    const plan = planCouncilDecision(existing.operatorDecision as CouncilDecisionState, input.action);
    if (!plan.ok) {
      return {
        status: 409,
        body: { ok: false, error: "illegal_transition", hint: `Cannot ${input.action} from "${existing.operatorDecision}".` },
      };
    }
    const now = opts.now ?? new Date();
    await repo.advisorCouncilDecision.update({
      where: { id: existing.id },
      data: {
        operatorDecision: plan.next,
        decidedByUserId: input.actorUserId,
        decidedAt: now,
        decisionNote: input.note?.trim() || null,
        overrideKind: input.action === "override" ? (input.overrideKind ?? null) : null,
      },
    });
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          id: existing.id,
          previousDecision: existing.operatorDecision as CouncilDecisionState,
          decision: plan.next,
          action: input.action,
          overrideKind: input.action === "override" ? (input.overrideKind ?? null) : null,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "AdvisorCouncilDecision table needs Phase 514 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
