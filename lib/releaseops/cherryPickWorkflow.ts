/**
 * Phase 457 — cherry-pick exception workflow.
 *
 * Closed-union state machine + pure validators for the cherry-pick
 * path. The kernel decides legal transitions; the validators decide
 * whether an exception request is well-formed (rationale present,
 * approvedPrIds + excludedPrIds non-overlapping, etc.).
 */

import type { ReleaseTagDiffSummary } from "./gitDiscoveryRepo";

/* ──────────────────────────────────────────────────────────────────
   Closed-union status + transitions.
   ────────────────────────────────────────────────────────────── */

export type CherryPickStatus = "requested" | "approved" | "denied" | "superseded";

export const ALL_CHERRY_PICK_STATUSES: ReadonlyArray<CherryPickStatus> = [
  "requested", "approved", "denied", "superseded",
];

export type CherryPickEvent =
  | { kind: "operator_submitted_request"; rationale: string; approvedPrIds: string[]; excludedPrIds: string[]; requestedByUserId: string }
  | { kind: "approver_granted"; approverUserId: string; reason?: string }
  | { kind: "approver_denied"; approverUserId: string; reason: string }
  | { kind: "release_rescoped"; reason: string }
  | { kind: "operator_validated_final_commits"; operatorUserId: string };

export type CherryPickTransitionResult =
  | { ok: true;  next: CherryPickStatus; setHasFinalCommitValidation?: boolean }
  | { ok: false; reason: "illegal_transition"; from: CherryPickStatus | "none"; eventKind: string };

/**
 * Initial transition: there's no row yet, only operator_submitted_request
 * is legal — and the result is the new `requested` status.
 */
export function transitionCherryPickFromNone(
  event: CherryPickEvent,
): CherryPickTransitionResult {
  if (event.kind === "operator_submitted_request") {
    return { ok: true, next: "requested" };
  }
  return { ok: false, reason: "illegal_transition", from: "none", eventKind: event.kind };
}

export function transitionCherryPick(
  current: CherryPickStatus,
  event: CherryPickEvent,
): CherryPickTransitionResult {
  const reject = (): CherryPickTransitionResult => ({
    ok: false, reason: "illegal_transition", from: current, eventKind: event.kind,
  });

  switch (event.kind) {
    case "operator_submitted_request":
      // Cannot re-submit; create a fresh row instead.
      return reject();

    case "approver_granted":
      if (current === "requested") return { ok: true, next: "approved" };
      return reject();

    case "approver_denied":
      if (current === "requested") return { ok: true, next: "denied" };
      return reject();

    case "release_rescoped":
      // Release scope changed underneath an open exception — supersede it
      // so the next readiness pass re-asks for an exception against the
      // new diff.
      if (current === "requested" || current === "approved") {
        return { ok: true, next: "superseded" };
      }
      return reject();

    case "operator_validated_final_commits":
      // Idempotent flag flip; status doesn't change. Only valid while
      // the exception is requested or approved.
      if (current === "requested" || current === "approved") {
        return { ok: true, next: current, setHasFinalCommitValidation: true };
      }
      return reject();
  }
}

/* ──────────────────────────────────────────────────────────────────
   Request validation.
   ────────────────────────────────────────────────────────────── */

export type CherryPickRequestValidation =
  | { ok: true }
  | { ok: false; errors: ReadonlyArray<CherryPickRequestError> };

export type CherryPickRequestError =
  | "rationale_too_short"
  | "approved_list_empty"
  | "approved_and_excluded_overlap"
  | "approved_list_does_not_match_diff"
  | "excluded_list_includes_unrelated_prs";

export interface ValidateCherryPickRequestInput {
  rationale: string;
  approvedPrIds: string[];
  excludedPrIds: string[];
  /** The current diff against previous prod that triggered the cherry-pick path. */
  diff: ReleaseTagDiffSummary;
}

export function validateCherryPickRequest(
  input: ValidateCherryPickRequestInput,
): CherryPickRequestValidation {
  const errors: CherryPickRequestError[] = [];
  if (input.rationale.trim().length < 20) errors.push("rationale_too_short");
  if (input.approvedPrIds.length === 0) errors.push("approved_list_empty");

  const approved = new Set(input.approvedPrIds);
  const excluded = new Set(input.excludedPrIds);
  for (const id of approved) if (excluded.has(id)) {
    errors.push("approved_and_excluded_overlap");
    break;
  }

  // The approved list must be a subset of the newly-included PRs in the
  // diff — operators can't approve PRs that aren't even in the release.
  const newlyIncluded = new Set(input.diff.newlyIncludedPrIds);
  for (const id of approved) if (!newlyIncluded.has(id)) {
    errors.push("approved_list_does_not_match_diff");
    break;
  }

  // The excluded list must come from the diff (newly-included or
  // dropped) — excluding random PRs is meaningless.
  const universe = new Set([...input.diff.newlyIncludedPrIds, ...input.diff.droppedPrIds]);
  for (const id of excluded) if (!universe.has(id)) {
    errors.push("excluded_list_includes_unrelated_prs");
    break;
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
