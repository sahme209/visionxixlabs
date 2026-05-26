import { describe, expect, it } from "vitest";
import {
  evaluateBranchValidation,
  matchesPattern,
  type BranchValidationContext,
} from "../branchValidationEvaluator";
import {
  ALL_BRANCH_VALIDATION_CHECKS,
  type BranchValidationCheckKey,
} from "../branchValidationSession";
import type {
  PullRequestRecordRow,
  ReleaseTagRecordRow,
  WorkflowRunRecordRow,
} from "../gitDiscoveryRepo";

const NOW = new Date("2026-06-01T22:00:00Z");

function makePr(over: Partial<PullRequestRecordRow> = {}): PullRequestRecordRow {
  return {
    id: "pr_1", organizationId: "o", repositoryId: "repo_1",
    number: 482, title: "Retry banner", state: "merged",
    sourceBranch: "feat/retry", targetBranch: "release/2.7",
    commitShaHead: "abc123",
    mergedAt: NOW, mergedByUserId: "captain",
    linkedStories: ["AXIOM-1023"], linkedTickets: ["CHG00001"],
    approvalsRequiredCount: 2, approvalsObservedCount: 2,
    codeownersApproved: true, ciStatus: "passing",
    webUrl: "https://x", lastSyncedAt: NOW, createdAt: NOW, updatedAt: NOW,
    ...over,
  };
}

function makeTag(over: Partial<ReleaseTagRecordRow> = {}): ReleaseTagRecordRow {
  return {
    id: "tag_1", organizationId: "o", repositoryId: "repo_1",
    tagName: "v2.7.0", commitSha: "abc123", createdAt: NOW,
    taggerUserId: "captain", prListJson: ["pr_1"], commitListJson: ["abc123"],
    diffAgainstPreviousProdJson: null, notes: null,
    lastSyncedAt: NOW, updatedAt: NOW,
    ...over,
  };
}

function makeCtx(over: Partial<BranchValidationContext> = {}): BranchValidationContext {
  return {
    pr: makePr(),
    releaseTag: makeTag(),
    workflowRuns: [],
    isProductionDeploy: true,
    diffAgainstPreviousProd: { fromTag: "v2.6.0", toTag: "v2.7.0", prCount: 1, commitCount: 1, newlyIncludedPrIds: ["pr_1"], droppedPrIds: [] },
    branchEnvPolicy: {
      requireReleaseTag: true,
      requireCodeowners: true,
      requirePrLink: true,
      requireChangeTicket: true,
      branchPattern: "release/*",
    },
    directPushBlocked: true,
    branchUpToDateWithTarget: true,
    hasRollbackReference: true,
    changedFilesWithinApprovedScope: true,
    ...over,
  };
}

function checkOf(results: ReturnType<typeof evaluateBranchValidation>["results"], key: BranchValidationCheckKey) {
  return results.find((r) => r.key === key)!;
}

/* ──────────────────────────────────────────────────────────────────
   Catalog coverage + pattern matcher.
   ────────────────────────────────────────────────────────────── */

describe("evaluateBranchValidation — catalog coverage", () => {
  it("returns one result per check in the catalog", () => {
    const ev = evaluateBranchValidation(makeCtx());
    expect(ev.results).toHaveLength(ALL_BRANCH_VALIDATION_CHECKS.length);
    expect(ev.results.map((r) => r.key).sort()).toEqual([...ALL_BRANCH_VALIDATION_CHECKS].sort());
  });

  it("clean context → all 18 results are pass", () => {
    const ev = evaluateBranchValidation(makeCtx());
    expect(ev.passCount).toBe(18);
    expect(ev.failCount).toBe(0);
  });
});

describe("matchesPattern", () => {
  it("matches exact", () => {
    expect(matchesPattern("main", "main")).toBe(true);
    expect(matchesPattern("main", "release/2.7")).toBe(false);
  });
  it("matches single-segment glob (*)", () => {
    expect(matchesPattern("release/2.7", "release/*")).toBe(true);
    expect(matchesPattern("release/2.7/hotfix", "release/*")).toBe(false);
  });
  it("matches multi-segment glob (**)", () => {
    expect(matchesPattern("release/2.7/hotfix", "release/**")).toBe(true);
  });
});

/* ──────────────────────────────────────────────────────────────────
   Per-check failure paths.
   ────────────────────────────────────────────────────────────── */

describe("per-check failure paths", () => {
  it("source_branch_or_tag_identified fails when no PR + no tag", () => {
    const ev = evaluateBranchValidation(makeCtx({ pr: null, releaseTag: null }));
    expect(checkOf(ev.results, "source_branch_or_tag_identified").state).toBe("fail");
  });

  it("follows_branch_environment_policy fails when source branch doesn't match pattern (no tag)", () => {
    const ev = evaluateBranchValidation(makeCtx({
      releaseTag: null,
      pr: makePr({ sourceBranch: "feat/whatever" }),
    }));
    expect(checkOf(ev.results, "follows_branch_environment_policy").state).toBe("fail");
  });

  it("direct_push_blocked fails when policy is not enforced at provider", () => {
    const ev = evaluateBranchValidation(makeCtx({ directPushBlocked: false }));
    expect(checkOf(ev.results, "direct_push_blocked_on_protected_branches").state).toBe("fail");
  });

  it("merged_through_pr fails when PR state is open", () => {
    const ev = evaluateBranchValidation(makeCtx({ pr: makePr({ state: "open", mergedAt: null }) }));
    expect(checkOf(ev.results, "merged_through_pr").state).toBe("fail");
  });

  it("required_reviewers_present fails when observed < required", () => {
    const ev = evaluateBranchValidation(makeCtx({ pr: makePr({ approvalsObservedCount: 1, approvalsRequiredCount: 2 }) }));
    const c = checkOf(ev.results, "required_reviewers_present");
    expect(c.state).toBe("fail");
    expect(c.detail).toMatch(/1\/2/);
  });

  it("codeowners_approved fails when required + missing", () => {
    const ev = evaluateBranchValidation(makeCtx({ pr: makePr({ codeownersApproved: false }) }));
    expect(checkOf(ev.results, "codeowners_approved").state).toBe("fail");
  });

  it("codeowners_approved is not_applicable when policy doesn't require it", () => {
    const ev = evaluateBranchValidation(makeCtx({
      pr: makePr({ codeownersApproved: false }),
      branchEnvPolicy: { ...makeCtx().branchEnvPolicy!, requireCodeowners: false },
    }));
    expect(checkOf(ev.results, "codeowners_approved").state).toBe("not_applicable");
  });

  it("ci_checks_passed fails for failing/pending/not_run", () => {
    for (const ciStatus of ["failing", "pending", "not_run"] as const) {
      const ev = evaluateBranchValidation(makeCtx({ pr: makePr({ ciStatus }) }));
      expect(checkOf(ev.results, "ci_checks_passed").state).toBe("fail");
    }
  });

  it("pr_linked_to_user_story fails when linkedStories empty", () => {
    const ev = evaluateBranchValidation(makeCtx({ pr: makePr({ linkedStories: [] }) }));
    expect(checkOf(ev.results, "pr_linked_to_user_story").state).toBe("fail");
  });

  it("pr_linked_to_change_ticket fails when prod deploy + linkedTickets empty", () => {
    const ev = evaluateBranchValidation(makeCtx({ pr: makePr({ linkedTickets: [] }) }));
    expect(checkOf(ev.results, "pr_linked_to_change_ticket").state).toBe("fail");
  });

  it("pr_linked_to_change_ticket is not_applicable for non-prod + policy doesn't require", () => {
    const ev = evaluateBranchValidation(makeCtx({
      pr: makePr({ linkedTickets: [] }),
      isProductionDeploy: false,
      branchEnvPolicy: { ...makeCtx().branchEnvPolicy!, requireChangeTicket: false },
    }));
    expect(checkOf(ev.results, "pr_linked_to_change_ticket").state).toBe("not_applicable");
  });

  it("changed_files_within_approved_scope is unknown when not projected", () => {
    const ev = evaluateBranchValidation(makeCtx({ changedFilesWithinApprovedScope: null }));
    expect(checkOf(ev.results, "changed_files_within_approved_scope").state).toBe("unknown");
  });

  it("no_unrelated_commits fails when diff has dropped PRs (cherry-pick path without exception)", () => {
    const ev = evaluateBranchValidation(makeCtx({
      diffAgainstPreviousProd: { fromTag: "v2.6.0", toTag: "v2.7.0", prCount: 1, commitCount: 1, newlyIncludedPrIds: ["pr_1"], droppedPrIds: ["pr_x"] },
    }));
    expect(checkOf(ev.results, "no_unrelated_commits").state).toBe("fail");
  });

  it("branch_up_to_date_with_target fails when behind", () => {
    const ev = evaluateBranchValidation(makeCtx({ branchUpToDateWithTarget: false }));
    expect(checkOf(ev.results, "branch_up_to_date_with_target").state).toBe("fail");
  });

  it("release_tag_created fails for prod deploy without tag", () => {
    const ev = evaluateBranchValidation(makeCtx({ releaseTag: null }));
    expect(checkOf(ev.results, "release_tag_created").state).toBe("fail");
  });

  it("release_tag_created not_applicable when not required (non-prod, not required by policy)", () => {
    const ev = evaluateBranchValidation(makeCtx({
      releaseTag: null,
      isProductionDeploy: false,
      branchEnvPolicy: { ...makeCtx().branchEnvPolicy!, requireReleaseTag: false },
    }));
    expect(checkOf(ev.results, "release_tag_created").state).toBe("not_applicable");
  });

  it("release_tag_points_to_approved_commit_sha fails when tag commit differs from PR head", () => {
    const ev = evaluateBranchValidation(makeCtx({
      releaseTag: makeTag({ commitSha: "OTHER" }),
    }));
    expect(checkOf(ev.results, "release_tag_points_to_approved_commit_sha").state).toBe("fail");
  });

  it("release_diff_matches_approved_pr_list fails when diff has no newly included PRs", () => {
    const ev = evaluateBranchValidation(makeCtx({
      diffAgainstPreviousProd: { fromTag: "v2.6.0", toTag: "v2.7.0", prCount: 0, commitCount: 0, newlyIncludedPrIds: [], droppedPrIds: [] },
    }));
    expect(checkOf(ev.results, "release_diff_matches_approved_pr_list").state).toBe("fail");
  });

  it("rollback_reference_identified fails when not present", () => {
    const ev = evaluateBranchValidation(makeCtx({ hasRollbackReference: false }));
    expect(checkOf(ev.results, "rollback_reference_identified").state).toBe("fail");
  });
});

/* ──────────────────────────────────────────────────────────────────
   Tally invariants.
   ────────────────────────────────────────────────────────────── */

describe("tally invariants", () => {
  it("pass + fail + n/a + unknown = total checks", () => {
    const ev = evaluateBranchValidation(makeCtx({
      pr: null, releaseTag: null,
      diffAgainstPreviousProd: null,
      changedFilesWithinApprovedScope: null,
    }));
    expect(ev.passCount + ev.failCount + ev.notApplicableCount + ev.unknownCount).toBe(ALL_BRANCH_VALIDATION_CHECKS.length);
  });
});
