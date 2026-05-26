import { describe, expect, it } from "vitest";
import {
  ALL_CHERRY_PICK_STATUSES,
  transitionCherryPick,
  transitionCherryPickFromNone,
  validateCherryPickRequest,
  type CherryPickStatus,
} from "../cherryPickWorkflow";
import type { ReleaseTagDiffSummary } from "../gitDiscoveryRepo";

const SAMPLE_DIFF: ReleaseTagDiffSummary = {
  fromTag: "v2.6.0",
  toTag: "v2.7.0",
  prCount: 3,
  commitCount: 3,
  newlyIncludedPrIds: ["pr_1", "pr_2", "pr_3"],
  droppedPrIds: ["pr_drop_a"],
};

const GOOD_RATIONALE = "Hotfix for retry banner — feature flag PR is in scope but the metrics-overhaul branch must NOT ship yet.";

/* ──────────────────────────────────────────────────────────────────
   transitionCherryPickFromNone.
   ────────────────────────────────────────────────────────────── */

describe("transitionCherryPickFromNone", () => {
  it("operator_submitted_request → requested", () => {
    const r = transitionCherryPickFromNone({
      kind: "operator_submitted_request",
      rationale: GOOD_RATIONALE,
      approvedPrIds: ["pr_1"], excludedPrIds: [],
      requestedByUserId: "u",
    });
    expect(r).toEqual({ ok: true, next: "requested" });
  });

  it("rejects any other event from `none` state", () => {
    expect(transitionCherryPickFromNone({ kind: "approver_granted", approverUserId: "u" }).ok).toBe(false);
    expect(transitionCherryPickFromNone({ kind: "approver_denied", approverUserId: "u", reason: "no" }).ok).toBe(false);
    expect(transitionCherryPickFromNone({ kind: "release_rescoped", reason: "scope changed" }).ok).toBe(false);
    expect(transitionCherryPickFromNone({ kind: "operator_validated_final_commits", operatorUserId: "u" }).ok).toBe(false);
  });
});

/* ──────────────────────────────────────────────────────────────────
   transitionCherryPick — legal + illegal.
   ────────────────────────────────────────────────────────────── */

describe("transitionCherryPick — legal transitions", () => {
  it("requested → approved via approver_granted", () => {
    expect(transitionCherryPick("requested", { kind: "approver_granted", approverUserId: "u" }))
      .toEqual({ ok: true, next: "approved" });
  });

  it("requested → denied via approver_denied", () => {
    expect(transitionCherryPick("requested", { kind: "approver_denied", approverUserId: "u", reason: "no" }))
      .toEqual({ ok: true, next: "denied" });
  });

  it("requested → superseded via release_rescoped", () => {
    expect(transitionCherryPick("requested", { kind: "release_rescoped", reason: "scope changed" }))
      .toEqual({ ok: true, next: "superseded" });
  });

  it("approved → superseded via release_rescoped", () => {
    expect(transitionCherryPick("approved", { kind: "release_rescoped", reason: "scope changed" }))
      .toEqual({ ok: true, next: "superseded" });
  });

  it("operator_validated_final_commits is a flag flip (status unchanged) from requested or approved", () => {
    for (const from of ["requested", "approved"] as const) {
      const r = transitionCherryPick(from, { kind: "operator_validated_final_commits", operatorUserId: "u" });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.next).toBe(from);
        expect(r.setHasFinalCommitValidation).toBe(true);
      }
    }
  });
});

describe("transitionCherryPick — illegal transitions", () => {
  it("operator_submitted_request from existing status is illegal (create a new row instead)", () => {
    for (const from of ALL_CHERRY_PICK_STATUSES) {
      const r = transitionCherryPick(from, {
        kind: "operator_submitted_request",
        rationale: GOOD_RATIONALE,
        approvedPrIds: [], excludedPrIds: [],
        requestedByUserId: "u",
      });
      expect(r.ok).toBe(false);
    }
  });

  it("approver_granted from any state except requested is illegal", () => {
    for (const from of ALL_CHERRY_PICK_STATUSES.filter((s) => s !== "requested")) {
      expect(transitionCherryPick(from, { kind: "approver_granted", approverUserId: "u" }).ok).toBe(false);
    }
  });

  it("release_rescoped from terminal states (denied | superseded) is illegal", () => {
    expect(transitionCherryPick("denied", { kind: "release_rescoped", reason: "x" }).ok).toBe(false);
    expect(transitionCherryPick("superseded", { kind: "release_rescoped", reason: "x" }).ok).toBe(false);
  });

  it("operator_validated_final_commits from denied | superseded is illegal", () => {
    expect(transitionCherryPick("denied", { kind: "operator_validated_final_commits", operatorUserId: "u" }).ok).toBe(false);
    expect(transitionCherryPick("superseded", { kind: "operator_validated_final_commits", operatorUserId: "u" }).ok).toBe(false);
  });

  it("illegal returns include from + eventKind in the payload", () => {
    const r = transitionCherryPick("denied", { kind: "approver_granted", approverUserId: "u" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.from).toBe("denied");
      expect(r.eventKind).toBe("approver_granted");
    }
  });
});

/* ──────────────────────────────────────────────────────────────────
   validateCherryPickRequest.
   ────────────────────────────────────────────────────────────── */

describe("validateCherryPickRequest", () => {
  it("happy path → ok:true", () => {
    expect(validateCherryPickRequest({
      rationale: GOOD_RATIONALE,
      approvedPrIds: ["pr_1", "pr_2"],
      excludedPrIds: ["pr_drop_a"],
      diff: SAMPLE_DIFF,
    })).toEqual({ ok: true });
  });

  it("rationale_too_short when < 20 chars", () => {
    const v = validateCherryPickRequest({
      rationale: "tiny", approvedPrIds: ["pr_1"], excludedPrIds: [], diff: SAMPLE_DIFF,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors).toContain("rationale_too_short");
  });

  it("approved_list_empty when no PRs approved", () => {
    const v = validateCherryPickRequest({
      rationale: GOOD_RATIONALE, approvedPrIds: [], excludedPrIds: [], diff: SAMPLE_DIFF,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors).toContain("approved_list_empty");
  });

  it("approved_and_excluded_overlap when a PR appears in both lists", () => {
    const v = validateCherryPickRequest({
      rationale: GOOD_RATIONALE,
      approvedPrIds: ["pr_1", "pr_2"],
      excludedPrIds: ["pr_2"],
      diff: SAMPLE_DIFF,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors).toContain("approved_and_excluded_overlap");
  });

  it("approved_list_does_not_match_diff when operator approves a PR not in the diff", () => {
    const v = validateCherryPickRequest({
      rationale: GOOD_RATIONALE,
      approvedPrIds: ["pr_unrelated"],
      excludedPrIds: [],
      diff: SAMPLE_DIFF,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors).toContain("approved_list_does_not_match_diff");
  });

  it("excluded_list_includes_unrelated_prs when operator excludes a PR not in the diff", () => {
    const v = validateCherryPickRequest({
      rationale: GOOD_RATIONALE,
      approvedPrIds: ["pr_1"],
      excludedPrIds: ["pr_random"],
      diff: SAMPLE_DIFF,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors).toContain("excluded_list_includes_unrelated_prs");
  });

  it("collects multiple errors at once", () => {
    const v = validateCherryPickRequest({
      rationale: "x",
      approvedPrIds: ["unrelated"],
      excludedPrIds: ["unrelated"],
      diff: SAMPLE_DIFF,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.errors).toContain("rationale_too_short");
      expect(v.errors).toContain("approved_and_excluded_overlap");
      expect(v.errors).toContain("approved_list_does_not_match_diff");
    }
  });
});
