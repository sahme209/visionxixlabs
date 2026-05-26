import { describe, expect, it } from "vitest";
import {
  classifyRunKind,
  projectGithubPr,
  projectGithubReleaseTag,
  projectGithubWorkflowRun,
  type GithubPrPayload,
  type GithubReleaseTagPayload,
  type GithubWorkflowRunPayload,
} from "../providers/githubProjectors";

const CTX = { organizationId: "o", repositoryId: "repo_1" };

function makePr(over: Partial<GithubPrPayload> = {}): GithubPrPayload {
  return {
    number: 482,
    title: "Checkout retry banner",
    body: "Closes AXIOM-1023.",
    state: "open",
    merged_at: null,
    merged_by: null,
    head: { ref: "feat/retry-banner", sha: "abc123" },
    base: { ref: "main" },
    user: { login: "dev_user" },
    html_url: "https://github.com/org/repo/pull/482",
    labels: [],
    requestedReviewerCount: 2,
    observedApprovalCount: 1,
    codeownersApproved: false,
    ciCombinedState: "pending",
    ...over,
  };
}

/* ──────────────────────────────────────────────────────────────────
   PR projector.
   ────────────────────────────────────────────────────────────── */

describe("projectGithubPr — state normalization", () => {
  it("open PR (no merged_at) → state:open", () => {
    const r = projectGithubPr(makePr(), CTX);
    expect(r.state).toBe("open");
  });

  it("PR with merged_at → state:merged regardless of GitHub state field", () => {
    const r = projectGithubPr(makePr({ state: "closed", merged_at: "2026-06-01T22:00:00Z", merged_by: { login: "captain" } }), CTX);
    expect(r.state).toBe("merged");
    expect(r.mergedAt).toEqual(new Date("2026-06-01T22:00:00Z"));
    expect(r.mergedByUserId).toBe("captain");
  });

  it("closed without merge → state:closed", () => {
    const r = projectGithubPr(makePr({ state: "closed", merged_at: null }), CTX);
    expect(r.state).toBe("closed");
    expect(r.mergedAt).toBeNull();
  });
});

describe("projectGithubPr — ciStatus normalization", () => {
  const cases: Array<[GithubPrPayload["ciCombinedState"] | null, "passing" | "failing" | "pending" | "not_run"]> = [
    ["success", "passing"],
    ["failure", "failing"],
    ["error",   "failing"],
    ["pending", "pending"],
    [null,      "not_run"],
  ];
  it.each(cases)("ciCombinedState=%s → ciStatus=%s", (input, expected) => {
    const r = projectGithubPr(makePr({ ciCombinedState: input }), CTX);
    expect(r.ciStatus).toBe(expected);
  });
});

describe("projectGithubPr — story + ticket extraction", () => {
  it("pulls story IDs from PR body (JIRA-style)", () => {
    const r = projectGithubPr(makePr({ body: "Closes AXIOM-1023 and PLAT-42." }), CTX);
    expect(r.linkedStories.sort()).toEqual(["AXIOM-1023", "PLAT-42"]);
    expect(r.linkedTickets).toEqual([]);
  });

  it("pulls change ticket IDs (CHG / INC / REQ prefixes)", () => {
    const r = projectGithubPr(makePr({ body: "Linked to CHG00482 and INC9912." }), CTX);
    expect(r.linkedTickets.sort()).toEqual(["CHG00482", "INC9912"]);
    expect(r.linkedStories).toEqual([]);
  });

  it("extracts from labels too (CHG label etc.)", () => {
    const r = projectGithubPr(makePr({ body: "", labels: [{ name: "CHG00482" }, { name: "needs-review" }] }), CTX);
    expect(r.linkedTickets).toEqual(["CHG00482"]);
  });

  it("dedupes story + ticket sets", () => {
    const r = projectGithubPr(makePr({ body: "AXIOM-1 AXIOM-1 CHG00001 CHG00001" }), CTX);
    expect(r.linkedStories).toEqual(["AXIOM-1"]);
    expect(r.linkedTickets).toEqual(["CHG00001"]);
  });
});

describe("projectGithubPr — defaults + URL pass-through", () => {
  it("defaults approval/codeowners flags when absent", () => {
    const { requestedReviewerCount: _r1, observedApprovalCount: _r2, codeownersApproved: _r3, ...rest } = makePr();
    const r = projectGithubPr(rest as GithubPrPayload, CTX);
    expect(r.approvalsRequiredCount).toBe(0);
    expect(r.approvalsObservedCount).toBe(0);
    expect(r.codeownersApproved).toBe(false);
  });

  it("preserves html_url as webUrl", () => {
    const r = projectGithubPr(makePr(), CTX);
    expect(r.webUrl).toBe("https://github.com/org/repo/pull/482");
  });

  it("carries source/target branch + head SHA", () => {
    const r = projectGithubPr(makePr(), CTX);
    expect(r.sourceBranch).toBe("feat/retry-banner");
    expect(r.targetBranch).toBe("main");
    expect(r.commitShaHead).toBe("abc123");
  });
});

/* ──────────────────────────────────────────────────────────────────
   Release tag projector.
   ────────────────────────────────────────────────────────────── */

describe("projectGithubReleaseTag", () => {
  it("maps tag_name + resolvedCommitSha + author + body", () => {
    const payload: GithubReleaseTagPayload = {
      tag_name: "v2.7.0",
      target_commitish: "main",
      resolvedCommitSha: "deadbeef",
      created_at: "2026-06-01T20:00:00Z",
      body: "Checkout retry banner",
      author: { login: "captain" },
      prListSincePrevious: ["pr_482", "pr_483"],
      commitListSincePrevious: ["abc", "def"],
    };
    const r = projectGithubReleaseTag(payload, CTX);
    expect(r.tagName).toBe("v2.7.0");
    expect(r.commitSha).toBe("deadbeef");
    expect(r.taggerUserId).toBe("captain");
    expect(r.notes).toBe("Checkout retry banner");
    expect(r.prListJson).toEqual(["pr_482", "pr_483"]);
    expect(r.commitListJson).toEqual(["abc", "def"]);
    expect(r.createdAt).toEqual(new Date("2026-06-01T20:00:00Z"));
  });

  it("handles missing author + body + prList cleanly (null)", () => {
    const payload: GithubReleaseTagPayload = {
      tag_name: "v1.0.0", target_commitish: "main",
      resolvedCommitSha: "aaa",
    };
    const r = projectGithubReleaseTag(payload, CTX);
    expect(r.taggerUserId).toBeNull();
    expect(r.notes).toBeNull();
    expect(r.prListJson).toBeNull();
    expect(r.commitListJson).toBeNull();
    expect(r.diffAgainstPreviousProdJson).toBeNull();
  });
});

/* ──────────────────────────────────────────────────────────────────
   Workflow run projector.
   ────────────────────────────────────────────────────────────── */

describe("projectGithubWorkflowRun — status + conclusion + runKind", () => {
  function makeRun(over: Partial<GithubWorkflowRunPayload> = {}): GithubWorkflowRunPayload {
    return {
      id: 12345,
      name: "Deploy",
      path: ".github/workflows/deploy.yml",
      status: "completed",
      conclusion: "success",
      head_sha: "abc123",
      head_branch: "refs/tags/v2.7.0",
      run_started_at: "2026-06-01T22:00:00Z",
      updated_at: "2026-06-01T22:30:00Z",
      html_url: "https://github.com/org/repo/actions/runs/12345",
      ...over,
    };
  }

  it("status: waiting / pending / requested all collapse to queued", () => {
    for (const s of ["waiting", "pending", "requested"] as const) {
      const r = projectGithubWorkflowRun(makeRun({ status: s }), CTX);
      expect(r.status).toBe("queued");
    }
  });

  it("status: in_progress passes through", () => {
    const r = projectGithubWorkflowRun(makeRun({ status: "in_progress" }), CTX);
    expect(r.status).toBe("in_progress");
  });

  it("status: completed passes through", () => {
    const r = projectGithubWorkflowRun(makeRun({ status: "completed" }), CTX);
    expect(r.status).toBe("completed");
  });

  it("conclusion: timed_out + action_required collapse to failure", () => {
    expect(projectGithubWorkflowRun(makeRun({ conclusion: "timed_out" }), CTX).conclusion).toBe("failure");
    expect(projectGithubWorkflowRun(makeRun({ conclusion: "action_required" }), CTX).conclusion).toBe("failure");
  });

  it("conclusion: null/undefined stays null", () => {
    const r1 = projectGithubWorkflowRun(makeRun({ conclusion: null }), CTX);
    expect(r1.conclusion).toBeNull();
  });

  it("uses path as workflowName when GitHub didn't supply name", () => {
    const r = projectGithubWorkflowRun(makeRun({ name: null }), CTX);
    expect(r.workflowName).toBe(".github/workflows/deploy.yml");
  });

  it("stamps completedAt only when status=completed", () => {
    const completed = projectGithubWorkflowRun(makeRun(), CTX);
    expect(completed.completedAt).not.toBeNull();

    const inProg = projectGithubWorkflowRun(makeRun({ status: "in_progress" }), CTX);
    expect(inProg.completedAt).toBeNull();
  });
});

describe("classifyRunKind", () => {
  it("deploy workflows → deploy", () => {
    expect(classifyRunKind(".github/workflows/deploy.yml", "Deploy")).toBe("deploy");
    expect(classifyRunKind(".github/workflows/release.yml", "Release")).toBe("deploy");
    expect(classifyRunKind(".github/workflows/publish.yml", "Publish image")).toBe("deploy");
  });

  it("build / docker / image workflows → build", () => {
    expect(classifyRunKind(".github/workflows/build.yml", "Build")).toBe("build");
    expect(classifyRunKind(".github/workflows/docker.yml", "Docker build")).toBe("build");
  });

  it("test / lint / check / qa workflows → check", () => {
    expect(classifyRunKind(".github/workflows/test.yml", "Test")).toBe("check");
    expect(classifyRunKind(".github/workflows/lint.yml", "Lint")).toBe("check");
    expect(classifyRunKind(".github/workflows/qa.yml", "QA gate")).toBe("check");
  });

  it("unknown workflows → other", () => {
    expect(classifyRunKind(".github/workflows/mystery.yml", "Mystery")).toBe("other");
  });

  it("deploy hint wins over build hint when both present", () => {
    expect(classifyRunKind(".github/workflows/build-and-deploy.yml", "Build and Deploy")).toBe("deploy");
  });
});
