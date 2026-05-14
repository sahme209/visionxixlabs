/**
 * Release / Pipeline Reasoner.
 *
 * `releaseReadiness.ts` produces a typed score + blockers. This module
 * reasons on top of that — turning the blocker taxonomy into an actionable
 * release brief: what the operator must do next, in what order, with which
 * approvals + rollback + verification.
 *
 * No fake "ready to deploy" claims. Every recommendation pins to a
 * blocker id from the underlying readiness output.
 */

import type { ReleaseReadiness, ReadinessBlocker } from "@/lib/releaseops/releaseReadiness";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReleaseRecommendationKind =
  | "fix_branch_protection"
  | "fix_signed_commits"
  | "fix_failing_workflow"
  | "rotate_workflow_secret"
  | "shrink_environment_blast_radius"
  | "add_required_approver"
  | "add_rollback_plan"
  | "tighten_terraform_review"
  | "refresh_stale_pipeline_data"
  | "general_review";

export interface ReleaseRecommendation {
  /** Stable id used by the brain + UI. */
  id: string;
  kind: ReleaseRecommendationKind;
  title: string;
  detail: string;
  /** Underlying blocker(s) this recommendation closes. */
  blockerIds: string[];
  approvalRequirement: "single_approver" | "two_approvers" | "automatic" | "blocked";
  rollbackRequirement: "documented_rollback" | "feature_flag_revert" | "redeploy_previous_tag" | "none_required";
  verificationRequirement: "post_deploy_smoke_test" | "rollback_drill" | "manual_review" | "none_required";
  /** Heuristic blast radius — informs approval policy. */
  blastRadius: "low" | "medium" | "high" | "critical";
  /** Direct action the operator can take. */
  safeNextAction: { label: string; href?: string };
}

export interface ReleaseReasoningSummary {
  grade: ReleaseReadiness["grade"];
  score: ReleaseReadiness["score"];
  blockerCount: number;
  recommendationCount: number;
  productionReady: boolean;
  /** True when readiness rests on preview/stale data, not live signals. */
  evidenceFreshness: "fresh" | "stale" | "preview";
}

export interface ReleaseReasoningOutcome {
  generatedAt: string;
  summary: ReleaseReasoningSummary;
  recommendations: ReleaseRecommendation[];
  /** Suggested ordered sequence — operator works top-down. */
  recommendedSequence: string[];
  /** Single next-best action. */
  safeNextAction: { label: string; href?: string };
}

// ---------------------------------------------------------------------------
// Reasoner
// ---------------------------------------------------------------------------

function severityRank(s: ReadinessBlocker["severity"]): number {
  switch (s) {
    case "critical": return 4;
    case "high":     return 3;
    case "medium":   return 2;
    case "low":      return 1;
    default:         return 0;
  }
}

function blastRadiusFor(blocker: ReadinessBlocker): ReleaseRecommendation["blastRadius"] {
  if (blocker.severity === "critical") return "critical";
  if (blocker.severity === "high")     return "high";
  if (blocker.severity === "medium")   return "medium";
  return "low";
}

function approvalFor(blocker: ReadinessBlocker): ReleaseRecommendation["approvalRequirement"] {
  if (blocker.severity === "critical") return "two_approvers";
  if (blocker.severity === "high")     return "two_approvers";
  if (blocker.severity === "medium")   return "single_approver";
  return "automatic";
}

function recommendationFor(blocker: ReadinessBlocker): ReleaseRecommendation {
  const id = `rec.${blocker.id}`;
  const next = blocker.safeNextAction
    ?? { label: `Resolve blocker · ${blocker.title}`, href: "/dashboard/releaseops" };

  const common = {
    id,
    title: blocker.title,
    detail: blocker.detail,
    blockerIds: [blocker.id],
    approvalRequirement: approvalFor(blocker),
    blastRadius: blastRadiusFor(blocker),
    safeNextAction: next,
  };

  switch (blocker.kind) {
    case "branch_protection_missing":
    case "branch_protection_weak":
      return {
        ...common,
        kind: "fix_branch_protection",
        rollbackRequirement: "none_required",
        verificationRequirement: "manual_review",
      };
    case "signed_commits_missing":
      return {
        ...common,
        kind: "fix_signed_commits",
        rollbackRequirement: "none_required",
        verificationRequirement: "manual_review",
      };
    case "required_checks_missing":
      return {
        ...common,
        kind: "tighten_terraform_review",
        rollbackRequirement: "documented_rollback",
        verificationRequirement: "manual_review",
      };
    case "workflow_failing":
      return {
        ...common,
        kind: "fix_failing_workflow",
        rollbackRequirement: "redeploy_previous_tag",
        verificationRequirement: "post_deploy_smoke_test",
      };
    case "stale_sync":
      return {
        ...common,
        kind: "refresh_stale_pipeline_data",
        approvalRequirement: "automatic",
        rollbackRequirement: "none_required",
        verificationRequirement: "none_required",
      };
    case "rollback_unverified":
      return {
        ...common,
        kind: "add_rollback_plan",
        rollbackRequirement: "documented_rollback",
        verificationRequirement: "rollback_drill",
      };
    case "env_drift":
      return {
        ...common,
        kind: "shrink_environment_blast_radius",
        rollbackRequirement: "feature_flag_revert",
        verificationRequirement: "rollback_drill",
      };
    case "no_deployment_approval":
      return {
        ...common,
        kind: "add_required_approver",
        rollbackRequirement: "none_required",
        verificationRequirement: "manual_review",
      };
    default:
      return {
        ...common,
        kind: "general_review",
        rollbackRequirement: "documented_rollback",
        verificationRequirement: "manual_review",
      };
  }
}

export interface ReleaseReasoningInput {
  readiness: ReleaseReadiness;
  /** Did the readiness data come from a live or preview source? */
  source: "live" | "preview";
  /** Has data been refreshed within the last N ms? */
  lastRefreshedAt?: string;
  /** Threshold beyond which data is considered stale (default 24h). */
  stalenessThresholdMs?: number;
}

export function reasonAboutReleases(input: ReleaseReasoningInput): ReleaseReasoningOutcome {
  const { readiness } = input;
  const threshold = input.stalenessThresholdMs ?? 24 * 60 * 60 * 1000;

  // Sort blockers by severity desc so the recommended sequence makes sense.
  const orderedBlockers = [...readiness.blockers].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  );
  const recommendations = orderedBlockers.map(recommendationFor);

  const evidenceFreshness: ReleaseReasoningSummary["evidenceFreshness"] = (() => {
    if (input.source === "preview") return "preview";
    if (!input.lastRefreshedAt) return "stale";
    const age = Date.now() - new Date(input.lastRefreshedAt).getTime();
    return age <= threshold ? "fresh" : "stale";
  })();

  const productionReady = (readiness.grade === "A" || readiness.grade === "B")
    && readiness.blockers.every((b) => b.severity !== "critical" && b.severity !== "high");

  const top = recommendations[0];
  const safeNextAction = top
    ? top.safeNextAction
    : { label: "Open ReleaseOps", href: "/dashboard/releaseops" };

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      grade: readiness.grade,
      score: readiness.score,
      blockerCount: readiness.blockers.length,
      recommendationCount: recommendations.length,
      productionReady,
      evidenceFreshness,
    },
    recommendations,
    recommendedSequence: recommendations.map((r) => r.id),
    safeNextAction,
  };
}
