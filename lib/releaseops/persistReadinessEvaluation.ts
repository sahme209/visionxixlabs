/**
 * Phase 444 — persist a ReleaseReadiness evaluation as a snapshot row.
 *
 * Bridge between two layers:
 *
 *   computeReleaseReadiness() — existing pure function in
 *   lib/releaseops/releaseReadiness.ts. Produces a single score 0-100
 *   + a typed blocker list. Driven primarily by GitHub branch-
 *   protection / workflow signals today.
 *
 *   ReleaseReadinessSnapshot (Phase 442) — DB row with 8 separate
 *   dimensions. Persistence + history for the dashboard.
 *
 * This wrapper maps the engine's output into the 8-dimension shape,
 * persists via the Phase 442 repo, and returns the persisted row so
 * the caller (route handler, cron job) can emit audit events on top.
 *
 * Dimensions we DO measure today:
 *   - branchGovernance — from the engine's existing GitHub branch
 *     protection signals (this is what the current engine does)
 *
 * Dimensions held at a documented baseline (50 = unmeasured) until
 * later phases land their own evaluators:
 *   - changeCompliance        (Phase C — ServiceNow / Jira SM adapter)
 *   - artifactTraceability    (Phase B — artifact registry sync)
 *   - secretTraceability      (Phase D — Vault metadata module)
 *   - rollbackReadiness       (Phase D — Helm + Liquibase rollback)
 *   - communicationReadiness  (Phase C — comms template engine)
 *   - driftRisk               (Phase E — drift detection scanner)
 *   - manualReconciliation    (Phase E — manual change tracker)
 *
 * That's honest: the snapshot shows what's measured AND what isn't,
 * the dashboard surfaces both so operators see the gaps explicitly.
 */

import {
  persistReadinessSnapshot,
  type ReadinessDimension,
  type ReleaseBlocker,
  type ReadinessRiskLevel,
  type ReleaseRepo,
  type ReleaseReadinessSnapshotRow,
} from "./releaseRepo";
import {
  computeReleaseReadiness,
  type ReleaseReadinessInputs,
  type ReadinessBlocker as EngineBlocker,
} from "./releaseReadiness";

/* ──────────────────────────────────────────────────────────────────
   Per-dimension baseline. 50 = "unmeasured" — the dashboard will
   surface a "needs measurement" badge next to any dimension still at
   this value.
   ────────────────────────────────────────────────────────────── */

export const UNMEASURED_BASELINE = 50;

/**
 * Map the engine's blocker.kind → the Phase 442 ReadinessDimension
 * categories. Used for both the persisted blocker list AND, when we
 * extend to per-dimension scoring in later phases, the scoring fan-out.
 */
export function dimensionForEngineBlockerKind(kind: EngineBlocker["kind"]): ReadinessDimension {
  switch (kind) {
    case "branch_protection_missing":
    case "branch_protection_weak":
    case "signed_commits_missing":
    case "required_checks_missing":
      return "branch_governance";
    case "workflow_failing":
      return "artifact_traceability";
    case "stale_sync":
    case "env_drift":
      return "drift_risk";
    case "rollback_unverified":
      return "rollback_readiness";
    case "no_deployment_approval":
      return "communication_readiness";
  }
}

/**
 * Map engine blocker severity → Phase 442 ReadinessRiskLevel union.
 * The engine has 5 levels (info|low|medium|high|critical); Phase 442
 * has 4 (low|medium|high|critical). "info" collapses to "low".
 */
export function severityForEngineBlocker(s: EngineBlocker["severity"]): ReadinessRiskLevel {
  switch (s) {
    case "info":     return "low";
    case "low":      return "low";
    case "medium":   return "medium";
    case "high":     return "high";
    case "critical": return "critical";
  }
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export interface PersistReadinessEvaluationInput {
  organizationId: string;
  releaseId: string;
  /** GitHub preview-sync output the engine consumes. */
  engineInputs: ReleaseReadinessInputs;
  /** Provenance — "manual" | "auto" | "cron:<jobId>" etc. */
  evaluationSource: string;
  /** Optional override for tests. */
  evaluatedAt?: Date;
}

export interface PersistReadinessEvaluationResult {
  snapshot: ReleaseReadinessSnapshotRow;
  /** The engine's raw output, returned for callers that want the headline summary. */
  engineSummary: string;
  /** The engine's headline grade (A-F). Useful for UI badges. */
  engineGrade: "A" | "B" | "C" | "D" | "F";
}

/**
 * Run the engine, project its output into the 8-dimension snapshot
 * shape, and persist via the repo. Returns both the persisted row and
 * the engine's headline summary/grade so callers don't need to re-run
 * the engine.
 */
export async function persistReleaseReadinessEvaluation(
  repo: ReleaseRepo,
  input: PersistReadinessEvaluationInput,
): Promise<PersistReadinessEvaluationResult> {
  const engineResult = computeReleaseReadiness(input.engineInputs);

  // branchGovernance reflects the existing engine's score directly —
  // that's the dimension the current engine actually measures.
  const scores = {
    branchGovernance: engineResult.score,
    changeCompliance: UNMEASURED_BASELINE,
    artifactTraceability: UNMEASURED_BASELINE,
    secretTraceability: UNMEASURED_BASELINE,
    rollbackReadiness: UNMEASURED_BASELINE,
    communicationReadiness: UNMEASURED_BASELINE,
    driftRisk: UNMEASURED_BASELINE,
    manualReconciliation: UNMEASURED_BASELINE,
  };

  // Project each engine blocker into the Phase 442 ReleaseBlocker shape.
  const blockers: ReleaseBlocker[] = engineResult.blockers.map((b) => ({
    id: b.id,
    category: dimensionForEngineBlockerKind(b.kind),
    severity: severityForEngineBlocker(b.severity),
    message: b.title,
    remediation: b.detail,
  }));

  const snapshot = await persistReadinessSnapshot(repo, {
    organizationId: input.organizationId,
    releaseId: input.releaseId,
    scores,
    blockers,
    evaluationSource: input.evaluationSource,
    ...(input.evaluatedAt ? { evaluatedAt: input.evaluatedAt } : {}),
  });

  return {
    snapshot,
    engineSummary: engineResult.summary,
    engineGrade: engineResult.grade,
  };
}
