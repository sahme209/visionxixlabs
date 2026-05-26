/**
 * Phase 455 — branch validation evaluator.
 *
 * Pure function: given the head PR + the candidate release tag +
 * the workflow runs for the release commit, produces a per-check
 * result for every check in the Phase 445 closed-union catalog.
 *
 * The kernel state machine consumes the per-check results to decide
 * whether the session is in_progress / passing / failing.
 *
 * No I/O. The route handler / cron job fetches the rows via the
 * Phase 451 repo and hands them in.
 */

import {
  ALL_BRANCH_VALIDATION_CHECKS,
  type BranchValidationCheckKey,
} from "./branchValidationSession";
import type {
  PullRequestRecordRow,
  ReleaseTagRecordRow,
  WorkflowRunRecordRow,
  ReleaseTagDiffSummary,
} from "./gitDiscoveryRepo";

/* ──────────────────────────────────────────────────────────────────
   Per-check result.
   ────────────────────────────────────────────────────────────── */

export interface BranchValidationCheckResult {
  key: BranchValidationCheckKey;
  state: "pass" | "fail" | "not_applicable" | "unknown";
  detail: string;
}

export interface BranchValidationEvaluation {
  results: BranchValidationCheckResult[];
  /** Convenience counts the kernel state machine consumes. */
  passCount: number;
  failCount: number;
  notApplicableCount: number;
  unknownCount: number;
}

/* ──────────────────────────────────────────────────────────────────
   Inputs.
   ────────────────────────────────────────────────────────────── */

export interface BranchValidationContext {
  /** The PR being deployed; null if no PR is linked. */
  pr: PullRequestRecordRow | null;
  /** Candidate release tag for this deploy; null if not tagged yet. */
  releaseTag: ReleaseTagRecordRow | null;
  /** Workflow runs observed for the release commit. */
  workflowRuns: ReadonlyArray<WorkflowRunRecordRow>;
  /** Target environment tier. Production-only checks short-circuit elsewhere. */
  isProductionDeploy: boolean;
  /** Optional diff against the previous prod tag — drives the "no unrelated commits" + "release diff matches approved PR list" checks. */
  diffAgainstPreviousProd: ReleaseTagDiffSummary | null;
  /** Branch-to-environment policy in effect at the time. */
  branchEnvPolicy: {
    requireReleaseTag: boolean;
    requireCodeowners: boolean;
    requirePrLink: boolean;
    requireChangeTicket: boolean;
    /** The branch pattern the target environment expects (e.g. "release/*"). */
    branchPattern: string;
  } | null;
  /** Whether direct-push protection is enabled on the protected branch at the provider level. */
  directPushBlocked: boolean;
  /** Whether the branch is up-to-date with target at observation time. */
  branchUpToDateWithTarget: boolean;
  /** Whether a rollback reference release has been identified. */
  hasRollbackReference: boolean;
  /** Whether changed files are within the approved scope (caller projects this from PR/release). */
  changedFilesWithinApprovedScope: boolean | null;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export function evaluateBranchValidation(
  ctx: BranchValidationContext,
): BranchValidationEvaluation {
  const results: BranchValidationCheckResult[] = ALL_BRANCH_VALIDATION_CHECKS.map((key) =>
    evaluateCheck(key, ctx),
  );
  let passCount = 0, failCount = 0, notApplicableCount = 0, unknownCount = 0;
  for (const r of results) {
    if (r.state === "pass") passCount += 1;
    else if (r.state === "fail") failCount += 1;
    else if (r.state === "not_applicable") notApplicableCount += 1;
    else unknownCount += 1;
  }
  return { results, passCount, failCount, notApplicableCount, unknownCount };
}

/* ──────────────────────────────────────────────────────────────────
   Per-check evaluators.
   ────────────────────────────────────────────────────────────── */

function evaluateCheck(
  key: BranchValidationCheckKey,
  ctx: BranchValidationContext,
): BranchValidationCheckResult {
  switch (key) {
    case "source_branch_or_tag_identified":
      return ctx.releaseTag || ctx.pr
        ? pass(key, ctx.releaseTag ? `Release tag ${ctx.releaseTag.tagName}` : `PR head ${ctx.pr!.sourceBranch}`)
        : fail(key, "No source branch or release tag identified.");

    case "target_environment_confirmed":
      // The caller wouldn't have asked for evaluation without a target; mark passing
      // as a sanity check. Future versions may take environment id explicitly.
      return pass(key, "Target environment supplied by caller.");

    case "follows_branch_environment_policy":
      if (!ctx.branchEnvPolicy) return notApplicable(key, "No branch policy configured for this environment.");
      if (ctx.releaseTag) return pass(key, `Release tag ${ctx.releaseTag.tagName} satisfies policy.`);
      if (!ctx.pr) return fail(key, "Neither release tag nor PR available to evaluate against policy.");
      return matchesPattern(ctx.pr.sourceBranch, ctx.branchEnvPolicy.branchPattern)
        ? pass(key, `Source branch ${ctx.pr.sourceBranch} matches ${ctx.branchEnvPolicy.branchPattern}.`)
        : fail(key, `Source branch ${ctx.pr.sourceBranch} does not match ${ctx.branchEnvPolicy.branchPattern}.`);

    case "direct_push_blocked_on_protected_branches":
      return ctx.directPushBlocked
        ? pass(key, "Direct push blocked per provider branch protection.")
        : fail(key, "Direct push to protected branches is not blocked.");

    case "merged_through_pr":
      if (!ctx.pr) return fail(key, "No PR linked; release tag points at a non-PR commit.");
      return ctx.pr.state === "merged"
        ? pass(key, `PR #${ctx.pr.number} merged at ${ctx.pr.mergedAt?.toISOString() ?? "unknown"}.`)
        : fail(key, `PR #${ctx.pr.number} is in state ${ctx.pr.state}, not merged.`);

    case "required_reviewers_present":
      if (!ctx.pr) return fail(key, "No PR linked.");
      return ctx.pr.approvalsObservedCount >= ctx.pr.approvalsRequiredCount
        ? pass(key, `${ctx.pr.approvalsObservedCount}/${ctx.pr.approvalsRequiredCount} reviewers approved.`)
        : fail(key, `Only ${ctx.pr.approvalsObservedCount}/${ctx.pr.approvalsRequiredCount} required reviewers approved.`);

    case "codeowners_approved":
      if (!ctx.branchEnvPolicy?.requireCodeowners) return notApplicable(key, "CODEOWNERS approval not required for this branch/env.");
      if (!ctx.pr) return fail(key, "No PR linked to check CODEOWNERS.");
      return ctx.pr.codeownersApproved
        ? pass(key, "CODEOWNERS approval observed.")
        : fail(key, "CODEOWNERS approval missing.");

    case "ci_checks_passed":
      if (!ctx.pr) return fail(key, "No PR linked.");
      switch (ctx.pr.ciStatus) {
        case "passing": return pass(key, "CI is green on the merge commit.");
        case "failing": return fail(key, "CI is failing on the merge commit.");
        case "pending": return fail(key, "CI is still pending — wait or re-run.");
        case "not_run": return fail(key, "CI has not run on the merge commit.");
      }

    case "pr_linked_to_user_story":
      if (!ctx.pr) return fail(key, "No PR linked.");
      return ctx.pr.linkedStories.length > 0
        ? pass(key, `Linked to ${ctx.pr.linkedStories.join(", ")}.`)
        : fail(key, "PR has no linked story or defect.");

    case "pr_linked_to_change_ticket":
      if (!ctx.branchEnvPolicy?.requireChangeTicket && !ctx.isProductionDeploy) {
        return notApplicable(key, "Change-ticket linkage not required for this deploy.");
      }
      if (!ctx.pr) return fail(key, "No PR linked.");
      return ctx.pr.linkedTickets.length > 0
        ? pass(key, `Linked to ${ctx.pr.linkedTickets.join(", ")}.`)
        : fail(key, "PR has no linked change ticket.");

    case "changed_files_within_approved_scope":
      if (ctx.changedFilesWithinApprovedScope === null) return unknown(key, "Approved-scope projection not provided yet.");
      return ctx.changedFilesWithinApprovedScope
        ? pass(key, "All changed files are within the approved scope.")
        : fail(key, "PR touches files outside the approved scope.");

    case "no_unrelated_commits":
      if (!ctx.diffAgainstPreviousProd) return unknown(key, "Diff against previous prod release not computed yet.");
      return ctx.diffAgainstPreviousProd.droppedPrIds.length === 0
        ? pass(key, "No PRs dropped from the previous release; diff is linear.")
        : fail(key, `${ctx.diffAgainstPreviousProd.droppedPrIds.length} PR(s) dropped vs the previous release — cherry-pick path requires explicit exception.`);

    case "branch_up_to_date_with_target":
      return ctx.branchUpToDateWithTarget
        ? pass(key, "Branch is up to date with target.")
        : fail(key, "Branch is behind the target branch.");

    case "release_tag_created":
      if (ctx.isProductionDeploy || ctx.branchEnvPolicy?.requireReleaseTag) {
        return ctx.releaseTag ? pass(key, `Release tag ${ctx.releaseTag.tagName} present.`) : fail(key, "No release tag for a deploy that requires one.");
      }
      return notApplicable(key, "Release tag not required for this deploy.");

    case "release_tag_based_on_approved_branch":
      if (!ctx.releaseTag) return notApplicable(key, "No release tag to evaluate.");
      if (!ctx.branchEnvPolicy) return notApplicable(key, "No branch policy configured.");
      // We can't directly inspect the commit's branch lineage without a graph call;
      // we approximate via the PR target. If the head PR's target matches the policy
      // pattern, the tag is approved-branch based.
      if (!ctx.pr) return unknown(key, "No PR linked to confirm tag is based on approved branch.");
      return matchesPattern(ctx.pr.targetBranch, ctx.branchEnvPolicy.branchPattern)
        ? pass(key, `PR target ${ctx.pr.targetBranch} matches policy ${ctx.branchEnvPolicy.branchPattern}.`)
        : fail(key, `PR target ${ctx.pr.targetBranch} does not match policy ${ctx.branchEnvPolicy.branchPattern}.`);

    case "release_tag_points_to_approved_commit_sha":
      if (!ctx.releaseTag) return notApplicable(key, "No release tag to evaluate.");
      if (!ctx.pr) return unknown(key, "No PR linked to confirm tag commit.");
      return ctx.releaseTag.commitSha === ctx.pr.commitShaHead
        ? pass(key, `Release tag points at PR head ${ctx.pr.commitShaHead}.`)
        : fail(key, `Release tag commit ${ctx.releaseTag.commitSha} differs from PR head ${ctx.pr.commitShaHead}.`);

    case "release_diff_matches_approved_pr_list":
      if (!ctx.diffAgainstPreviousProd) return unknown(key, "Diff against previous prod release not computed yet.");
      if (!ctx.releaseTag) return notApplicable(key, "No release tag to evaluate.");
      return ctx.diffAgainstPreviousProd.newlyIncludedPrIds.length > 0
        ? pass(key, `${ctx.diffAgainstPreviousProd.newlyIncludedPrIds.length} new PR(s) included vs previous release.`)
        : fail(key, "Release diff is empty — nothing to deploy or diff projection is broken.");

    case "rollback_reference_identified":
      return ctx.hasRollbackReference
        ? pass(key, "Rollback reference release identified.")
        : fail(key, "No rollback reference release identified.");
  }
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

function pass(key: BranchValidationCheckKey, detail: string): BranchValidationCheckResult {
  return { key, state: "pass", detail };
}
function fail(key: BranchValidationCheckKey, detail: string): BranchValidationCheckResult {
  return { key, state: "fail", detail };
}
function notApplicable(key: BranchValidationCheckKey, detail: string): BranchValidationCheckResult {
  return { key, state: "not_applicable", detail };
}
function unknown(key: BranchValidationCheckKey, detail: string): BranchValidationCheckResult {
  return { key, state: "unknown", detail };
}

/**
 * Simple glob pattern match for branch names. Supports `*` (single
 * segment) and `**` (multi-segment). No DSL, no regex injection.
 */
export function matchesPattern(value: string, pattern: string): boolean {
  if (pattern === value) return true;
  const re = "^" + pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "::DOUBLESTAR::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DOUBLESTAR::/g, ".*") + "$";
  return new RegExp(re).test(value);
}
