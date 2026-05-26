import { describe, expect, it } from "vitest";
import {
  ALL_BRANCH_VALIDATION_CHECKS,
  ALL_BRANCH_VALIDATION_STATUSES,
  branchValidationCheckLabel,
  branchValidationStatusLabel,
  isInFlight,
  isReleaseGateOpen,
  needsOperatorAttention,
  transitionBranchValidation,
  type BranchValidationEvent,
  type BranchValidationStatus,
} from "../branchValidationSession";

/* ──────────────────────────────────────────────────────────────────
   Phase 445 — kernel matrix tests. Same pattern as Phase 413/426.
   ────────────────────────────────────────────────────────────── */

describe("transitionBranchValidation — legal transitions", () => {
  it("validation_started: pending → in_progress", () => {
    expect(transitionBranchValidation("pending", { kind: "validation_started" }))
      .toEqual({ ok: true, next: "in_progress" });
  });

  it("check_passed in in_progress is idempotent", () => {
    expect(transitionBranchValidation("in_progress", { kind: "check_passed", checkKey: "merged_through_pr" }))
      .toEqual({ ok: true, next: "in_progress" });
  });

  it("check_failed in in_progress flips to failing", () => {
    expect(transitionBranchValidation("in_progress", { kind: "check_failed", checkKey: "ci_checks_passed", reason: "build red" }))
      .toEqual({ ok: true, next: "failing" });
  });

  it("check_passed in failing stays failing (one fail = failing, can't unblock incrementally)", () => {
    expect(transitionBranchValidation("failing", { kind: "check_passed", checkKey: "merged_through_pr" }))
      .toEqual({ ok: true, next: "failing" });
  });

  it("validation_completed_clean: in_progress → passing", () => {
    expect(transitionBranchValidation("in_progress", { kind: "validation_completed_clean" }))
      .toEqual({ ok: true, next: "passing" });
  });

  it("validation_completed_with_failures: in_progress → failing", () => {
    expect(transitionBranchValidation("in_progress", { kind: "validation_completed_with_failures", failingCount: 2 }))
      .toEqual({ ok: true, next: "failing" });
  });

  it("operator_requested_exception: failing → exception_requested", () => {
    expect(transitionBranchValidation("failing", { kind: "operator_requested_exception", operatorUserId: "u", rationale: "emergency hotfix" }))
      .toEqual({ ok: true, next: "exception_requested" });
  });

  it("approver_granted_exception: exception_requested → exception_approved", () => {
    expect(transitionBranchValidation("exception_requested", { kind: "approver_granted_exception", approverUserId: "u_captain" }))
      .toEqual({ ok: true, next: "exception_approved" });
  });

  it("approver_denied_exception: exception_requested → blocked_no_exception", () => {
    expect(transitionBranchValidation("exception_requested", { kind: "approver_denied_exception", approverUserId: "u_captain", reason: "scope too large" }))
      .toEqual({ ok: true, next: "blocked_no_exception" });
  });
});

describe("transitionBranchValidation — illegal transitions", () => {
  it("rejects validation_started from anything other than pending", () => {
    for (const from of ALL_BRANCH_VALIDATION_STATUSES.filter((s) => s !== "pending")) {
      const r = transitionBranchValidation(from, { kind: "validation_started" });
      expect(r.ok).toBe(false);
    }
  });

  it("rejects check_passed / check_failed from pending or terminal states", () => {
    for (const from of ALL_BRANCH_VALIDATION_STATUSES.filter((s) => s !== "in_progress" && s !== "failing")) {
      expect(transitionBranchValidation(from, { kind: "check_passed", checkKey: "merged_through_pr" }).ok).toBe(false);
      expect(transitionBranchValidation(from, { kind: "check_failed", checkKey: "merged_through_pr", reason: "x" }).ok).toBe(false);
    }
  });

  it("rejects validation_completed_clean from failing", () => {
    expect(transitionBranchValidation("failing", { kind: "validation_completed_clean" }).ok).toBe(false);
  });

  it("rejects operator_requested_exception from any state except failing", () => {
    for (const from of ALL_BRANCH_VALIDATION_STATUSES.filter((s) => s !== "failing")) {
      expect(transitionBranchValidation(from, { kind: "operator_requested_exception", operatorUserId: "u", rationale: "x" }).ok).toBe(false);
    }
  });

  it("rejects approver_granted / approver_denied from any state except exception_requested", () => {
    for (const from of ALL_BRANCH_VALIDATION_STATUSES.filter((s) => s !== "exception_requested")) {
      expect(transitionBranchValidation(from, { kind: "approver_granted_exception", approverUserId: "u" }).ok).toBe(false);
      expect(transitionBranchValidation(from, { kind: "approver_denied_exception", approverUserId: "u", reason: "x" }).ok).toBe(false);
    }
  });

  it("returns from + eventKind in illegal-transition payload (debug shape)", () => {
    const r = transitionBranchValidation("passing", { kind: "operator_requested_exception", operatorUserId: "u", rationale: "x" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.from).toBe("passing");
    expect(r.eventKind).toBe("operator_requested_exception");
    expect(r.reason).toBe("illegal_transition");
  });
});

/* ──────────────────────────────────────────────────────────────────
   UI-driving predicates — partition + sanity.
   ────────────────────────────────────────────────────────────── */

describe("predicates", () => {
  it("isReleaseGateOpen is true only for passing + exception_approved", () => {
    const open = ALL_BRANCH_VALIDATION_STATUSES.filter(isReleaseGateOpen);
    expect(new Set(open)).toEqual(new Set(["passing", "exception_approved"]));
  });

  it("isInFlight is true only for pending + in_progress + exception_requested", () => {
    const inFlight = ALL_BRANCH_VALIDATION_STATUSES.filter(isInFlight);
    expect(new Set(inFlight)).toEqual(new Set(["pending", "in_progress", "exception_requested"]));
  });

  it("needsOperatorAttention is true only for failing + blocked_no_exception", () => {
    const att = ALL_BRANCH_VALIDATION_STATUSES.filter(needsOperatorAttention);
    expect(new Set(att)).toEqual(new Set(["failing", "blocked_no_exception"]));
  });

  it("every status falls into exactly one of {gate-open} ∪ {in-flight} ∪ {needs-attention}", () => {
    for (const s of ALL_BRANCH_VALIDATION_STATUSES) {
      const buckets = [isReleaseGateOpen(s), isInFlight(s), needsOperatorAttention(s)].filter(Boolean).length;
      expect(buckets).toBe(1);
    }
  });
});

describe("labels", () => {
  it("branchValidationStatusLabel returns a non-empty operator-readable string for every status", () => {
    for (const s of ALL_BRANCH_VALIDATION_STATUSES) {
      const label = branchValidationStatusLabel(s);
      expect(label.length).toBeGreaterThan(2);
      expect(label).not.toMatch(/_/);
    }
  });

  it("branchValidationCheckLabel returns a non-empty operator-readable string for every check", () => {
    for (const c of ALL_BRANCH_VALIDATION_CHECKS) {
      const label = branchValidationCheckLabel(c);
      expect(label.length).toBeGreaterThan(5);
      expect(label).not.toMatch(/_/);
    }
  });

  it("ALL_BRANCH_VALIDATION_CHECKS contains all 18 spec checks", () => {
    expect(ALL_BRANCH_VALIDATION_CHECKS).toHaveLength(18);
    // every entry is unique
    expect(new Set(ALL_BRANCH_VALIDATION_CHECKS).size).toBe(18);
  });
});

/* ──────────────────────────────────────────────────────────────────
   Happy-path lifecycle walks.
   ────────────────────────────────────────────────────────────── */

describe("happy-path walks", () => {
  it("clean path: pending → in_progress → passing", () => {
    let s: BranchValidationStatus = "pending";
    for (const e of [
      { kind: "validation_started" as const },
      { kind: "check_passed" as const, checkKey: "merged_through_pr" as const },
      { kind: "check_passed" as const, checkKey: "ci_checks_passed" as const },
      { kind: "validation_completed_clean" as const },
    ]) {
      const r = transitionBranchValidation(s, e);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.next;
    }
    expect(s).toBe("passing");
    expect(isReleaseGateOpen(s)).toBe(true);
  });

  it("exception-approved path: pending → in_progress → failing → exception_requested → exception_approved", () => {
    let s: BranchValidationStatus = "pending";
    const events: BranchValidationEvent[] = [
      { kind: "validation_started" },
      { kind: "check_failed", checkKey: "ci_checks_passed", reason: "flaky test" },
      { kind: "validation_completed_with_failures", failingCount: 1 },
      { kind: "operator_requested_exception", operatorUserId: "u", rationale: "flaky test, manually verified" },
      { kind: "approver_granted_exception", approverUserId: "u_captain" },
    ];
    for (const e of events) {
      const r = transitionBranchValidation(s, e);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.next;
    }
    expect(s).toBe("exception_approved");
    expect(isReleaseGateOpen(s)).toBe(true);
  });

  it("blocked path: pending → in_progress → failing → exception_requested → blocked_no_exception", () => {
    let s: BranchValidationStatus = "pending";
    const events: BranchValidationEvent[] = [
      { kind: "validation_started" },
      { kind: "check_failed", checkKey: "release_tag_created", reason: "no release tag" },
      { kind: "validation_completed_with_failures", failingCount: 1 },
      { kind: "operator_requested_exception", operatorUserId: "u", rationale: "in a hurry" },
      { kind: "approver_denied_exception", approverUserId: "u_captain", reason: "release tag is non-negotiable" },
    ];
    for (const e of events) {
      const r = transitionBranchValidation(s, e);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.next;
    }
    expect(s).toBe("blocked_no_exception");
    expect(isReleaseGateOpen(s)).toBe(false);
    expect(needsOperatorAttention(s)).toBe(true);
  });
});
