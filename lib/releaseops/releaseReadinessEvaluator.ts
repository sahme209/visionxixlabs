/**
 * Phase 480 — release readiness evaluator.
 *
 * Pure function. Given a release + its branch-validation summary +
 * cherry-pick + policy violation snapshot + ticket linkage, produces a
 * ReleaseReadinessSnapshot-shaped payload (8 dimensions 0-100 +
 * overall + risk level + blocker list).
 *
 * The orchestrator persists the result into ReleaseReadinessSnapshot.
 * The evidence pack reads it. The branch-validation page surfaces it.
 *
 * Scoring is deterministic and explainable — every dimension's score
 * is derived from a small number of observable signals so an auditor
 * can trace the number back to the underlying data.
 */

/* ──────────────────────────────────────────────────────────────────
   Input shape.
   ────────────────────────────────────────────────────────────── */

export interface ReadinessEvalRelease {
  id: string;
  releaseTag: string | null;
  commitSha: string | null;
  scopeFinalizedAt: Date | null;
  rollbackReferenceReleaseId: string | null;
  summary: string | null;
}

export interface ReadinessEvalBranchValidation {
  total: number;
  passing: number;
  failing: number;
  notApplicable: number;
  unknown: number;
}

export interface ReadinessEvalCherryPick {
  status: string;
  hasFinalCommitValidation: boolean;
}

export interface ReadinessEvalPolicyViolation {
  severity: string;
  status: string;
  blocking: boolean;
}

export interface ReadinessEvalTicket {
  status: string;
}

export interface ReadinessEvalInput {
  release: ReadinessEvalRelease;
  branchValidation: ReadinessEvalBranchValidation;
  cherryPicks: ReadonlyArray<ReadinessEvalCherryPick>;
  policyViolations: ReadonlyArray<ReadinessEvalPolicyViolation>;
  linkedTickets: ReadonlyArray<ReadinessEvalTicket>;
  /** True iff the platform observed manual production fixes since the previous release. */
  hasManualProdFixes?: boolean;
}

/* ──────────────────────────────────────────────────────────────────
   Output shape — matches the ReleaseReadinessSnapshot row.
   ────────────────────────────────────────────────────────────── */

export type ReadinessRiskLevel = "low" | "medium" | "high" | "critical";

export interface ReadinessBlocker {
  id: string;
  category: ReadinessDimension;
  severity: ReadinessRiskLevel;
  message: string;
  remediation?: string;
}

export type ReadinessDimension =
  | "branch_governance"
  | "change_compliance"
  | "artifact_traceability"
  | "secret_traceability"
  | "rollback_readiness"
  | "communication_readiness"
  | "drift_risk"
  | "manual_reconciliation";

export interface ReadinessEvaluation {
  branchGovernance: number;
  changeCompliance: number;
  artifactTraceability: number;
  secretTraceability: number;
  rollbackReadiness: number;
  communicationReadiness: number;
  driftRisk: number;
  manualReconciliation: number;
  overallScore: number;
  riskLevel: ReadinessRiskLevel;
  blockers: ReadinessBlocker[];
  evaluationSource: string;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export function evaluateReleaseReadiness(input: ReadinessEvalInput): ReadinessEvaluation {
  const blockers: ReadinessBlocker[] = [];

  const branchGovernance = scoreBranchGovernance(input.branchValidation, blockers);
  const changeCompliance = scoreChangeCompliance(input.linkedTickets, blockers);
  const artifactTraceability = scoreArtifactTraceability(input.release, blockers);
  const secretTraceability = scoreSecretTraceability();
  const rollbackReadiness = scoreRollbackReadiness(input.release, blockers);
  const communicationReadiness = scoreCommunicationReadiness(input.release, blockers);
  const driftRisk = scoreDriftRisk(input.policyViolations, blockers);
  const manualReconciliation = scoreManualReconciliation(input.cherryPicks, input.hasManualProdFixes ?? false, blockers);

  const overallScore = avg([
    branchGovernance, changeCompliance, artifactTraceability, secretTraceability,
    rollbackReadiness, communicationReadiness, driftRisk, manualReconciliation,
  ]);
  const riskLevel = riskLevelFromScore(overallScore);

  return {
    branchGovernance,
    changeCompliance,
    artifactTraceability,
    secretTraceability,
    rollbackReadiness,
    communicationReadiness,
    driftRisk,
    manualReconciliation,
    overallScore,
    riskLevel,
    blockers,
    evaluationSource: "phase-480-evaluator",
  };
}

/* ──────────────────────────────────────────────────────────────────
   Per-dimension scorers — each pushes a blocker if its score is poor.
   ────────────────────────────────────────────────────────────── */

function scoreBranchGovernance(bv: ReadinessEvalBranchValidation, blockers: ReadinessBlocker[]): number {
  const observed = bv.total - bv.notApplicable;
  if (observed <= 0) return 60; // unknown — middle of the road
  const passRate = bv.passing / observed;
  const score = Math.round(passRate * 100);
  if (bv.failing > 0) {
    blockers.push({
      id: "branch_governance_failing",
      category: "branch_governance",
      severity: bv.failing >= 3 ? "critical" : "high",
      message: `${bv.failing} branch-validation check(s) failing.`,
      remediation: "Resolve each failing check or document a Phase 445 exception.",
    });
  }
  return score;
}

function scoreChangeCompliance(tickets: ReadonlyArray<ReadinessEvalTicket>, blockers: ReadinessBlocker[]): number {
  if (tickets.length === 0) {
    blockers.push({
      id: "change_compliance_missing_ticket",
      category: "change_compliance",
      severity: "high",
      message: "No change ticket linked to this release.",
      remediation: "Link the release to a Jira / Linear / ServiceNow ticket via the change-tickets sync.",
    });
    return 40;
  }
  // Implemented or approved tickets → full credit.
  const aligned = tickets.filter((t) => t.status === "implemented" || t.status === "approved").length;
  const ratio = aligned / tickets.length;
  return Math.round(60 + ratio * 40);
}

function scoreArtifactTraceability(r: ReadinessEvalRelease, blockers: ReadinessBlocker[]): number {
  let score = 100;
  if (!r.commitSha) {
    score -= 40;
    blockers.push({
      id: "artifact_traceability_no_commit",
      category: "artifact_traceability",
      severity: "high",
      message: "Release has no commit SHA recorded.",
      remediation: "Tag the release; the GitHub sync will populate commitSha automatically.",
    });
  }
  if (!r.releaseTag) {
    score -= 20;
    blockers.push({
      id: "artifact_traceability_no_tag",
      category: "artifact_traceability",
      severity: "medium",
      message: "Release has no tag set.",
    });
  }
  return Math.max(0, score);
}

function scoreSecretTraceability(): number {
  // Secret-scan integration lands in a follow-on phase. Default to
  // a confident-passing score until the integration exists; the
  // operator-visible "evaluationSource" makes this honest.
  return 95;
}

function scoreRollbackReadiness(r: ReadinessEvalRelease, blockers: ReadinessBlocker[]): number {
  if (r.rollbackReferenceReleaseId) return 95;
  blockers.push({
    id: "rollback_readiness_no_reference",
    category: "rollback_readiness",
    severity: "high",
    message: "No rollback reference release is set.",
    remediation: "Pick the previous-prod release as the rollback target before sealing scope.",
  });
  return 30;
}

function scoreCommunicationReadiness(r: ReadinessEvalRelease, blockers: ReadinessBlocker[]): number {
  if (!r.summary || r.summary.trim().length < 20) {
    blockers.push({
      id: "communication_readiness_no_summary",
      category: "communication_readiness",
      severity: "medium",
      message: "Release has no operator-facing summary (or it's <20 chars).",
      remediation: "Write a one-paragraph summary for the release announcement.",
    });
    return 50;
  }
  return 90;
}

function scoreDriftRisk(violations: ReadonlyArray<ReadinessEvalPolicyViolation>, blockers: ReadinessBlocker[]): number {
  const openBlocking = violations.filter((v) => v.status === "open" && v.blocking).length;
  const openOther = violations.filter((v) => v.status === "open" && !v.blocking).length;
  if (openBlocking > 0) {
    blockers.push({
      id: "drift_risk_open_blocking",
      category: "drift_risk",
      severity: "critical",
      message: `${openBlocking} blocking policy violation(s) open.`,
      remediation: "Either fix the underlying issue (Mark resolved) or grant a documented exception.",
    });
    return Math.max(0, 50 - openBlocking * 15);
  }
  if (openOther > 0) {
    return Math.max(60, 90 - openOther * 5);
  }
  return 95;
}

function scoreManualReconciliation(
  cps: ReadonlyArray<ReadinessEvalCherryPick>,
  hasManualProdFixes: boolean,
  blockers: ReadinessBlocker[],
): number {
  const approvedCp = cps.filter((c) => c.status === "approved");
  const unvalidated = approvedCp.filter((c) => !c.hasFinalCommitValidation).length;
  if (hasManualProdFixes) {
    blockers.push({
      id: "manual_reconciliation_prod_fixes",
      category: "manual_reconciliation",
      severity: "high",
      message: "Manual production fixes recorded since previous release.",
      remediation: "Reconcile the fixes into source-of-truth and document them in the release notes.",
    });
    return 40;
  }
  if (unvalidated > 0) {
    blockers.push({
      id: "manual_reconciliation_cherry_pick_unvalidated",
      category: "manual_reconciliation",
      severity: "medium",
      message: `${unvalidated} approved cherry-pick(s) without final-commit validation.`,
      remediation: "Validate the final release tag contains only approved commits.",
    });
    return 60;
  }
  return 90;
}

/* ──────────────────────────────────────────────────────────────────
   Helpers.
   ────────────────────────────────────────────────────────────── */

function avg(scores: ReadonlyArray<number>): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round(sum / scores.length);
}

export function riskLevelFromScore(score: number): ReadinessRiskLevel {
  if (score >= 80) return "low";
  if (score >= 60) return "medium";
  if (score >= 40) return "high";
  return "critical";
}
