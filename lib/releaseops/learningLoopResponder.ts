/**
 * Phase 511 — Learning Loop responder.
 *
 * Aggregates operator decisions across the three AGI engines:
 *   • AdvisorRecommendation
 *   • PolicyProposal
 *   • IncidentTriage
 *
 * Passes them through the pure clustering engine and returns ranked
 * engine-improvement signals. Pure with respect to the supplied repo.
 */

import { isMissingTable } from "./releaseListResponder";
import {
  generateLearningSignals,
  LEARNING_LOOP_ENGINE_VERSION,
  type LearningEngine,
  type OperatorDecisionRow,
} from "./learningLoopEngine";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface AdvisorRowForLearning {
  kind: string;
  operatorDecision: string;
  decisionNote: string | null;
  confidence: number;
  decidedAt: Date | null;
}

export interface ProposalRowForLearning {
  kind: string;
  operatorDecision: string;
  decisionNote: string | null;
  confidence: number;
  decidedAt: Date | null;
}

export interface TriageRowForLearning {
  // Triage has a fixed kind ("triage") since each row's
  // "engine-specific kind" is the triage itself; the engine-specific
  // "thing" is the priority decision. We use the priority as the kind
  // so that improvement signals can target per-priority calibration.
  priority: string;
  operatorDecision: string;
  decisionNote: string | null;
  confidence: number;
  decidedAt: Date | null;
}

export interface LearningLoopRepo {
  advisorRecommendation: {
    findMany(args: {
      where: { organizationId: string; operatorDecision: { in: string[] } };
      orderBy: { decidedAt: "desc" };
      take?: number;
      select: { kind: boolean; operatorDecision: boolean; decisionNote: boolean; confidence: boolean; decidedAt: boolean };
    }): Promise<AdvisorRowForLearning[]>;
  };
  policyProposal: {
    findMany(args: {
      where: { organizationId: string; operatorDecision: { in: string[] } };
      orderBy: { decidedAt: "desc" };
      take?: number;
      select: { kind: boolean; operatorDecision: boolean; decisionNote: boolean; confidence: boolean; decidedAt: boolean };
    }): Promise<ProposalRowForLearning[]>;
  };
  incidentTriage: {
    findMany(args: {
      where: { organizationId: string; operatorDecision: { in: string[] } };
      orderBy: { decidedAt: "desc" };
      take?: number;
      select: { priority: boolean; operatorDecision: boolean; decisionNote: boolean; confidence: boolean; decidedAt: boolean };
    }): Promise<TriageRowForLearning[]>;
  };
  /** Phase 515 — optional council source for voter-dissent signals. */
  advisorCouncilDecision?: {
    findMany(args: {
      where: { organizationId: string };
      orderBy: { generatedAt: "desc" };
      take?: number;
      select: { id: boolean; consensusKind: boolean; votesJson: boolean; generatedAt: boolean };
    }): Promise<Array<{ id: string; consensusKind: string; votesJson: unknown; generatedAt: Date }>>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export type LearningLoopBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        engineVersion: string;
        totalDecisionsAnalyzed: number;
        signals: Array<{
          kind: string;
          engine: LearningEngine;
          targetKind: string;
          keyword: string | null;
          occurrences: number;
          strength: number;
          title: string;
          rationale: string;
          suggestedAction: string;
        }>;
        summary: {
          totalRows: number;
          signalsByKind: Record<string, number>;
        };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface LearningLoopResult { status: number; body: LearningLoopBody }

/* ──────────────────────────────────────────────────────────────────
   Responder.
   ────────────────────────────────────────────────────────────── */

const ANALYZE_DECISIONS = ["accepted", "rejected", "overridden", "dismissed", "implemented"];

export async function buildLearningLoopResponse(
  repo: LearningLoopRepo,
  organizationId: string,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<LearningLoopResult> {
  try {
    const now = opts.now ?? new Date();

    const [advisorRows, proposalRows, triageRows, councilRows] = await Promise.all([
      safe(() =>
        repo.advisorRecommendation.findMany({
          where: { organizationId, operatorDecision: { in: ANALYZE_DECISIONS } },
          orderBy: { decidedAt: "desc" },
          take: 500,
          select: { kind: true, operatorDecision: true, decisionNote: true, confidence: true, decidedAt: true },
        }),
        [] as AdvisorRowForLearning[],
      ),
      safe(() =>
        repo.policyProposal.findMany({
          where: { organizationId, operatorDecision: { in: ANALYZE_DECISIONS } },
          orderBy: { decidedAt: "desc" },
          take: 500,
          select: { kind: true, operatorDecision: true, decisionNote: true, confidence: true, decidedAt: true },
        }),
        [] as ProposalRowForLearning[],
      ),
      safe(() =>
        repo.incidentTriage.findMany({
          where: { organizationId, operatorDecision: { in: ANALYZE_DECISIONS } },
          orderBy: { decidedAt: "desc" },
          take: 500,
          select: { priority: true, operatorDecision: true, decisionNote: true, confidence: true, decidedAt: true },
        }),
        [] as TriageRowForLearning[],
      ),
      // Phase 515 — optional council snapshots for voter-dissent signals.
      repo.advisorCouncilDecision
        ? safe(() =>
            repo.advisorCouncilDecision!.findMany({
              where: { organizationId },
              orderBy: { generatedAt: "desc" },
              take: 200,
              select: { id: true, consensusKind: true, votesJson: true, generatedAt: true },
            }),
            [] as Array<{ id: string; consensusKind: string; votesJson: unknown; generatedAt: Date }>,
          )
        : Promise.resolve([] as Array<{ id: string; consensusKind: string; votesJson: unknown; generatedAt: Date }>),
    ]);

    const rows: OperatorDecisionRow[] = [
      ...advisorRows.map((r) => projectAdvisor(r)),
      ...proposalRows.map((r) => projectProposal(r)),
      ...triageRows.map((r) => projectTriage(r)),
    ].filter((r): r is OperatorDecisionRow => r !== null);

    // Phase 515 — shape council rows into the engine's CouncilSnapshot type.
    const councilSnapshots = councilRows
      .filter((c) => Array.isArray(c.votesJson) && (c.votesJson as unknown[]).length > 0)
      .map((c) => ({
        decisionId: c.id,
        consensusKind: c.consensusKind,
        votes: (c.votesJson as Array<{ voterId: string; kind: string; confidence: number }>)
          .filter((v) => typeof v.voterId === "string" && typeof v.kind === "string")
          .map((v) => ({ voterId: v.voterId, kind: v.kind, confidence: typeof v.confidence === "number" ? v.confidence : 0 })),
        decidedAtIso: c.generatedAt.toISOString(),
      }));

    const output = generateLearningSignals({
      rows,
      councilSnapshots,
      rejectionClusterMin: 3,
      overrideClusterMin: 2,
      highRejectionRateThreshold: 0.5,
      lowConfidenceCeiling: 60,
      now,
    });

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: output.generatedAtIso,
          engineVersion: LEARNING_LOOP_ENGINE_VERSION,
          totalDecisionsAnalyzed: rows.length,
          signals: output.signals,
          summary: { totalRows: output.summary.totalRows, signalsByKind: output.summary.signalsByKind },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Learning loop reads from AdvisorRecommendation + PolicyProposal + IncidentTriage — one of those tables is missing." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Projection helpers.
   ────────────────────────────────────────────────────────────── */

const NORMALIZE_DECISIONS = new Set(["accepted", "rejected", "overridden", "dismissed", "implemented"]);

function projectAdvisor(r: AdvisorRowForLearning): OperatorDecisionRow | null {
  if (!NORMALIZE_DECISIONS.has(r.operatorDecision)) return null;
  return {
    engine: "release_advisor",
    kind: r.kind,
    decision: r.operatorDecision as OperatorDecisionRow["decision"],
    note: r.decisionNote,
    confidence: r.confidence,
    decidedAtIso: r.decidedAt ? r.decidedAt.toISOString() : "",
  };
}

function projectProposal(r: ProposalRowForLearning): OperatorDecisionRow | null {
  if (!NORMALIZE_DECISIONS.has(r.operatorDecision)) return null;
  return {
    engine: "policy_proposal",
    kind: r.kind,
    decision: r.operatorDecision as OperatorDecisionRow["decision"],
    note: r.decisionNote,
    confidence: r.confidence,
    decidedAtIso: r.decidedAt ? r.decidedAt.toISOString() : "",
  };
}

function projectTriage(r: TriageRowForLearning): OperatorDecisionRow | null {
  if (!NORMALIZE_DECISIONS.has(r.operatorDecision)) return null;
  return {
    engine: "incident_triage",
    kind: r.priority, // bucket triage rows by the priority the engine called
    decision: r.operatorDecision as OperatorDecisionRow["decision"],
    note: r.decisionNote,
    confidence: r.confidence,
    decidedAtIso: r.decidedAt ? r.decidedAt.toISOString() : "",
  };
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); }
  catch (err) { if (isMissingTable(err)) return fallback; throw err; }
}
