/**
 * Phase 480 — release readiness evaluate + persist orchestrator.
 *
 * Loads release context, calls the Phase 480 evaluator, writes a new
 * ReleaseReadinessSnapshot row. Each call appends a fresh snapshot so
 * the table acts as an audit trail of how readiness evolved over the
 * release lifecycle.
 */

import { isMissingTable } from "./releaseListResponder";
import {
  evaluateReleaseReadiness,
  type ReadinessEvalInput,
  type ReadinessEvalRelease,
  type ReadinessEvalBranchValidation,
  type ReadinessEvalCherryPick,
  type ReadinessEvalPolicyViolation,
  type ReadinessEvalTicket,
  type ReadinessEvaluation,
} from "./releaseReadinessEvaluator";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface ReadinessRepoReleaseRow extends ReadinessEvalRelease {
  organizationId: string;
}

export interface ReadinessRepoSnapshotInsert {
  id: string;
}

export interface ReleaseReadinessRepo {
  release: {
    findUnique(args: { where: { id: string } }): Promise<ReadinessRepoReleaseRow | null>;
  };
  cherryPickException: {
    findMany(args: { where: { organizationId: string; releaseId: string } }): Promise<ReadinessEvalCherryPick[]>;
  };
  policyViolation: {
    findMany(args: {
      where: { organizationId: string; releaseId: string };
      include: { rule: true };
    }): Promise<Array<{ status: string; rule: { severity: string; blocking: boolean } }>>;
  };
  changeTicket: {
    findMany(args: { where: { organizationId: string; linkedReleaseIds: { has: string } } }): Promise<ReadinessEvalTicket[]>;
  };
  releaseReadinessSnapshot: {
    create(args: {
      data: {
        organizationId: string;
        releaseId: string;
        branchGovernance: number;
        changeCompliance: number;
        artifactTraceability: number;
        secretTraceability: number;
        rollbackReadiness: number;
        communicationReadiness: number;
        driftRisk: number;
        manualReconciliation: number;
        overallScore: number;
        riskLevel: string;
        blockersJson: ReadinessEvaluation["blockers"];
        evaluationSource: string;
      };
    }): Promise<ReadinessRepoSnapshotInsert>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Input + output.
   ────────────────────────────────────────────────────────────── */

export interface BuildReleaseReadinessInput {
  organizationId: string;
  releaseId: string;
  /** Optional branch-validation summary supplied by the caller —
   *  e.g., from the Phase 460 detail page. When absent, scoring
   *  defaults to "no data observed" (60). */
  branchValidation?: ReadinessEvalBranchValidation;
  hasManualProdFixes?: boolean;
}

export type ReleaseReadinessBody =
  | {
      ok: true;
      data: {
        snapshotId: string;
        releaseId: string;
        overallScore: number;
        riskLevel: ReadinessEvaluation["riskLevel"];
        blockerCount: number;
        topBlocker: { category: string; severity: string; message: string } | null;
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: ReleaseReadinessBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildReleaseReadinessResponse(
  repo: ReleaseReadinessRepo,
  input: BuildReleaseReadinessInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const release = await repo.release.findUnique({ where: { id: input.releaseId } });
    if (!release) {
      return { status: 404, body: { ok: false, error: "release_not_found" } };
    }
    if (release.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_release" } };
    }

    const [cherryPicks, violationRows, linkedTickets] = await Promise.all([
      repo.cherryPickException.findMany({ where: { organizationId: input.organizationId, releaseId: release.id } }),
      repo.policyViolation.findMany({
        where: { organizationId: input.organizationId, releaseId: release.id },
        include: { rule: true },
      }),
      repo.changeTicket.findMany({ where: { organizationId: input.organizationId, linkedReleaseIds: { has: release.id } } }),
    ]);

    const policyViolations: ReadonlyArray<ReadinessEvalPolicyViolation> = violationRows.map((v) => ({
      severity: v.rule.severity,
      status: v.status,
      blocking: v.rule.blocking,
    }));

    const evalInput: ReadinessEvalInput = {
      release: {
        id: release.id,
        releaseTag: release.releaseTag,
        commitSha: release.commitSha,
        scopeFinalizedAt: release.scopeFinalizedAt,
        rollbackReferenceReleaseId: release.rollbackReferenceReleaseId,
        summary: release.summary,
      },
      branchValidation: input.branchValidation ?? { total: 0, passing: 0, failing: 0, notApplicable: 0, unknown: 0 },
      cherryPicks,
      policyViolations,
      linkedTickets,
      hasManualProdFixes: input.hasManualProdFixes ?? false,
    };
    const evaluation = evaluateReleaseReadiness(evalInput);

    const snapshot = await repo.releaseReadinessSnapshot.create({
      data: {
        organizationId: input.organizationId,
        releaseId: release.id,
        branchGovernance: evaluation.branchGovernance,
        changeCompliance: evaluation.changeCompliance,
        artifactTraceability: evaluation.artifactTraceability,
        secretTraceability: evaluation.secretTraceability,
        rollbackReadiness: evaluation.rollbackReadiness,
        communicationReadiness: evaluation.communicationReadiness,
        driftRisk: evaluation.driftRisk,
        manualReconciliation: evaluation.manualReconciliation,
        overallScore: evaluation.overallScore,
        riskLevel: evaluation.riskLevel,
        blockersJson: evaluation.blockers,
        evaluationSource: evaluation.evaluationSource,
      },
    });

    const topBlocker = evaluation.blockers.length > 0
      ? {
          category: evaluation.blockers[0].category,
          severity: evaluation.blockers[0].severity,
          message: evaluation.blockers[0].message,
        }
      : null;

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          snapshotId: snapshot.id,
          releaseId: release.id,
          overallScore: evaluation.overallScore,
          riskLevel: evaluation.riskLevel,
          blockerCount: evaluation.blockers.length,
          topBlocker,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Phase 442 / 466 migrations required for readiness evaluation." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
