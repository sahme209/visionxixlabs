/**
 * Phase 445 — BranchValidationSession kernel (third closed-union
 * state machine in the family, sibling to ConnectorSetupSession and
 * AlertEscalationSession).
 *
 * Models the lifecycle of validating that the code being deployed
 * comes from an approved source: correct branch/tag, correct PR
 * approvals, correct CI checks, correct change-ticket / story
 * linkage, etc. Wraps the 18-item branch-validation checklist from
 * the spec into a single status the dashboard can render and the
 * release readiness engine can read as a boolean gate.
 *
 * No I/O, no Prisma. Persistence + repo land in Phase 445b. The
 * kernel pattern is identical to Phase 413 — closed-union statuses
 * + closed-union events + a transition function that returns
 * { ok, next } | { ok:false, illegal_transition }.
 */

/* ──────────────────────────────────────────────────────────────────
   Closed union of statuses.
   ────────────────────────────────────────────────────────────── */

export type BranchValidationStatus =
  | "pending"              // session created, no checks run yet
  | "in_progress"          // at least one check has emitted a result
  | "passing"              // ALL checks completed + all green
  | "failing"              // at least one check failed; no exception yet
  | "exception_requested"  // operator asked for an exception waiver
  | "exception_approved"   // approver granted the waiver; release may proceed
  | "blocked_no_exception"; // exception denied; release blocked

export const ALL_BRANCH_VALIDATION_STATUSES: ReadonlyArray<BranchValidationStatus> = [
  "pending",
  "in_progress",
  "passing",
  "failing",
  "exception_requested",
  "exception_approved",
  "blocked_no_exception",
];

/* ──────────────────────────────────────────────────────────────────
   Closed union of events.
   ────────────────────────────────────────────────────────────── */

/**
 * The 18 checks the engine evaluates. Spec §4 enumerates them; this
 * union lets us emit a typed event per check without weakening to
 * strings in the kernel.
 */
export type BranchValidationCheckKey =
  | "source_branch_or_tag_identified"
  | "target_environment_confirmed"
  | "follows_branch_environment_policy"
  | "direct_push_blocked_on_protected_branches"
  | "merged_through_pr"
  | "required_reviewers_present"
  | "codeowners_approved"
  | "ci_checks_passed"
  | "pr_linked_to_user_story"
  | "pr_linked_to_change_ticket"
  | "changed_files_within_approved_scope"
  | "no_unrelated_commits"
  | "branch_up_to_date_with_target"
  | "release_tag_created"
  | "release_tag_based_on_approved_branch"
  | "release_tag_points_to_approved_commit_sha"
  | "release_diff_matches_approved_pr_list"
  | "rollback_reference_identified";

export type BranchValidationEvent =
  | { kind: "validation_started" }
  | { kind: "check_passed";  checkKey: BranchValidationCheckKey }
  | { kind: "check_failed";  checkKey: BranchValidationCheckKey; reason: string }
  | { kind: "validation_completed_clean" }
  | { kind: "validation_completed_with_failures"; failingCount: number }
  | { kind: "operator_requested_exception"; operatorUserId: string; rationale: string }
  | { kind: "approver_granted_exception"; approverUserId: string }
  | { kind: "approver_denied_exception"; approverUserId: string; reason: string };

/* ──────────────────────────────────────────────────────────────────
   Transition function.
   ────────────────────────────────────────────────────────────── */

export type BranchValidationTransitionResult =
  | { ok: true;  next: BranchValidationStatus }
  | { ok: false; reason: "illegal_transition"; from: BranchValidationStatus; eventKind: string };

export function transitionBranchValidation(
  current: BranchValidationStatus,
  event: BranchValidationEvent,
): BranchValidationTransitionResult {
  const reject = (): BranchValidationTransitionResult => ({
    ok: false, reason: "illegal_transition", from: current, eventKind: event.kind,
  });

  switch (event.kind) {
    case "validation_started":
      // Only meaningful from pending — re-running validation goes back
      // to pending first (via the operator_requested_exception ladder
      // OR by creating a new session entirely).
      if (current === "pending") return { ok: true, next: "in_progress" };
      return reject();

    case "check_passed":
    case "check_failed":
      // Individual check results land in either in_progress or failing.
      // A check_failed flips a passing-so-far session to failing once
      // validation completes; check_passed in failing state doesn't
      // unblock until validation_completed_clean fires.
      if (current === "in_progress" || current === "failing") {
        return { ok: true, next: event.kind === "check_failed" ? "failing" : current };
      }
      return reject();

    case "validation_completed_clean":
      // All checks ran, all passed — session lands at passing.
      if (current === "in_progress") return { ok: true, next: "passing" };
      return reject();

    case "validation_completed_with_failures":
      // All checks ran, some failed — session is firmly in failing.
      // Idempotent from failing (re-running the engine still produces
      // the same outcome) but illegal from passing / pending / *.
      if (current === "in_progress" || current === "failing") {
        return { ok: true, next: "failing" };
      }
      return reject();

    case "operator_requested_exception":
      // Only from failing — there's nothing to except when passing,
      // and you can't request a waiver before checks have run.
      if (current === "failing") return { ok: true, next: "exception_requested" };
      return reject();

    case "approver_granted_exception":
      if (current === "exception_requested") return { ok: true, next: "exception_approved" };
      return reject();

    case "approver_denied_exception":
      if (current === "exception_requested") return { ok: true, next: "blocked_no_exception" };
      return reject();
  }
}

/* ──────────────────────────────────────────────────────────────────
   UI-driving predicates.
   ────────────────────────────────────────────────────────────── */

/**
 * True when the release MAY proceed to deploy from a branch-validation
 * standpoint. Either everything passed, or a human-approved exception
 * is on file.
 */
export function isReleaseGateOpen(s: BranchValidationStatus): boolean {
  return s === "passing" || s === "exception_approved";
}

/** True when the session is in an active/working state and the operator should wait. */
export function isInFlight(s: BranchValidationStatus): boolean {
  return s === "pending" || s === "in_progress" || s === "exception_requested";
}

/** True when the session is in a final/blocked state needing operator action. */
export function needsOperatorAttention(s: BranchValidationStatus): boolean {
  return s === "failing" || s === "blocked_no_exception";
}

/** Plain-English label for the dashboard pill. */
export function branchValidationStatusLabel(s: BranchValidationStatus): string {
  switch (s) {
    case "pending":              return "Pending";
    case "in_progress":          return "Running checks";
    case "passing":              return "Passing";
    case "failing":              return "Failing";
    case "exception_requested":  return "Exception requested";
    case "exception_approved":   return "Exception approved";
    case "blocked_no_exception": return "Blocked";
  }
}

/* ──────────────────────────────────────────────────────────────────
   Pure helpers — the per-check projection.
   ────────────────────────────────────────────────────────────── */

/** All 18 check keys, in their canonical display order. */
export const ALL_BRANCH_VALIDATION_CHECKS: ReadonlyArray<BranchValidationCheckKey> = [
  "source_branch_or_tag_identified",
  "target_environment_confirmed",
  "follows_branch_environment_policy",
  "direct_push_blocked_on_protected_branches",
  "merged_through_pr",
  "required_reviewers_present",
  "codeowners_approved",
  "ci_checks_passed",
  "pr_linked_to_user_story",
  "pr_linked_to_change_ticket",
  "changed_files_within_approved_scope",
  "no_unrelated_commits",
  "branch_up_to_date_with_target",
  "release_tag_created",
  "release_tag_based_on_approved_branch",
  "release_tag_points_to_approved_commit_sha",
  "release_diff_matches_approved_pr_list",
  "rollback_reference_identified",
];

/** Operator-facing label per check. Used by the dashboard checklist. */
export function branchValidationCheckLabel(c: BranchValidationCheckKey): string {
  switch (c) {
    case "source_branch_or_tag_identified":       return "Source branch or tag identified";
    case "target_environment_confirmed":          return "Target environment confirmed";
    case "follows_branch_environment_policy":     return "Follows branch-to-environment policy";
    case "direct_push_blocked_on_protected_branches": return "Direct push blocked on protected branches";
    case "merged_through_pr":                     return "Merged through a pull request";
    case "required_reviewers_present":            return "Required reviewers present";
    case "codeowners_approved":                   return "CODEOWNERS approvals present";
    case "ci_checks_passed":                      return "Required CI/CD checks passed";
    case "pr_linked_to_user_story":               return "PR linked to user story / defect";
    case "pr_linked_to_change_ticket":            return "PR linked to production change ticket";
    case "changed_files_within_approved_scope":   return "Changed files within approved scope";
    case "no_unrelated_commits":                  return "No unrelated commits included";
    case "branch_up_to_date_with_target":         return "Branch up to date with target";
    case "release_tag_created":                   return "Release tag created";
    case "release_tag_based_on_approved_branch":  return "Release tag based on approved branch";
    case "release_tag_points_to_approved_commit_sha": return "Release tag points to approved commit SHA";
    case "release_diff_matches_approved_pr_list": return "Release diff matches approved PR list";
    case "rollback_reference_identified":         return "Rollback reference identified";
  }
}
