import { describe, expect, it } from "vitest";
import {
  projectAdoBuildStatus,
  projectAdoPipelineRun,
  projectAdoPullRequest,
  projectAdoReleaseTag,
  type AdoPipelineRunPayload,
  type AdoPullRequestPayload,
  type AdoReleaseTagPayload,
} from "../providers/azureDevOpsProjectors";

const CTX = { organizationId: "o", repositoryId: "repo_1" };

function makePr(over: Partial<AdoPullRequestPayload> = {}): AdoPullRequestPayload {
  return {
    pullRequestId: 482,
    title: "Retry banner",
    description: "AB#1023 closes AXIOM-1023 and CHG00001",
    status: "active",
    sourceRefName: "refs/heads/feat/retry",
    targetRefName: "refs/heads/main",
    lastMergeSourceCommit: { commitId: "abc123" },
    createdBy: { uniqueName: "dev@example.com" },
    approvalsRequiredCount: 2,
    approvalsObservedCount: 1,
    codeownersApproved: false,
    buildStatus: "inProgress",
    labels: [],
    workItemRefs: [{ id: "1023" }],
    webUrl: "https://dev.azure.com/org/proj/_git/repo/pullrequest/482",
    ...over,
  };
}

describe("projectAdoPullRequest — state mapping", () => {
  it("active → open", () => expect(projectAdoPullRequest(makePr(), CTX).state).toBe("open"));
  it("completed → merged + closedDate/closedBy populate mergedAt/By", () => {
    const r = projectAdoPullRequest(makePr({
      status: "completed",
      closedDate: "2026-06-01T22:00:00Z",
      closedBy: { uniqueName: "captain@x.com" },
    }), CTX);
    expect(r.state).toBe("merged");
    expect(r.mergedAt).toEqual(new Date("2026-06-01T22:00:00Z"));
    expect(r.mergedByUserId).toBe("captain@x.com");
  });
  it("abandoned → closed (no merge stamps)", () => {
    const r = projectAdoPullRequest(makePr({ status: "abandoned" }), CTX);
    expect(r.state).toBe("closed");
    expect(r.mergedAt).toBeNull();
    expect(r.mergedByUserId).toBeNull();
  });
});

describe("projectAdoBuildStatus — closed-union projection", () => {
  it.each([
    ["succeeded", "passing"],
    ["failed", "failing"],
    ["partiallySucceeded", "failing"],
    ["canceled", "failing"],
    ["inProgress", "pending"],
    ["notStarted", "pending"],
    [null, "not_run"],
  ] as const)("%s → %s", (input, expected) => {
    expect(projectAdoBuildStatus(input)).toBe(expected);
  });
});

describe("projectAdoPullRequest — refs/heads/ stripping", () => {
  it("removes refs/heads/ prefix from source/target", () => {
    const r = projectAdoPullRequest(makePr(), CTX);
    expect(r.sourceBranch).toBe("feat/retry");
    expect(r.targetBranch).toBe("main");
  });
  it("also strips refs/tags/ on weird inputs", () => {
    const r = projectAdoPullRequest(makePr({ sourceRefName: "refs/tags/hotfix" }), CTX);
    expect(r.sourceBranch).toBe("hotfix");
  });
});

describe("projectAdoPullRequest — story + ticket + workItem extraction", () => {
  it("extracts stories from description AND merges in workItemRefs", () => {
    const r = projectAdoPullRequest(makePr(), CTX);
    expect(r.linkedStories.sort()).toEqual(["1023", "AXIOM-1023"]);
    expect(r.linkedTickets).toEqual(["CHG00001"]);
  });

  it("dedupes when same story appears in body + workItem", () => {
    const r = projectAdoPullRequest(makePr({
      description: "Implements AXIOM-1023",
      workItemRefs: [{ id: "AXIOM-1023" }],
    }), CTX);
    expect(r.linkedStories).toEqual(["AXIOM-1023"]);
  });
});

describe("projectAdoReleaseTag", () => {
  it("maps tagName + resolvedCommitSha + taggedAt + message + tagger", () => {
    const r = projectAdoReleaseTag(
      {
        tagName: "v2.7.0",
        resolvedCommitSha: "deadbeef",
        taggedAt: "2026-06-01T20:00:00Z",
        message: "Retry banner",
        tagger: { uniqueName: "captain@x.com" },
      },
      CTX,
    );
    expect(r.tagName).toBe("v2.7.0");
    expect(r.commitSha).toBe("deadbeef");
    expect(r.taggerUserId).toBe("captain@x.com");
    expect(r.notes).toBe("Retry banner");
  });

  it("falls back to displayName when uniqueName absent", () => {
    const r = projectAdoReleaseTag(
      { tagName: "v1", resolvedCommitSha: "aaa", tagger: { displayName: "Captain" } },
      CTX,
    );
    expect(r.taggerUserId).toBe("Captain");
  });

  it("null tagger + message → nulls", () => {
    const r = projectAdoReleaseTag({ tagName: "v1", resolvedCommitSha: "aaa" }, CTX);
    expect(r.taggerUserId).toBeNull();
    expect(r.notes).toBeNull();
    expect(r.prListJson).toBeNull();
  });
});

describe("projectAdoPipelineRun — state + result combinations", () => {
  function makeRun(over: Partial<AdoPipelineRunPayload> = {}): AdoPipelineRunPayload {
    return {
      id: 99,
      name: "Deploy pipeline",
      yamlPath: "azure-pipelines/deploy.yml",
      state: "completed",
      result: "succeeded",
      sourceBranch: "refs/heads/main",
      sourceSha: "abc123",
      createdDate: "2026-06-01T22:00:00Z",
      finishedDate: "2026-06-01T22:25:00Z",
      webUrl: "https://dev.azure.com/.../runs/99",
      ...over,
    };
  }

  it("completed/succeeded → completed/success", () => {
    const r = projectAdoPipelineRun(makeRun(), CTX);
    expect(r.status).toBe("completed");
    expect(r.conclusion).toBe("success");
  });

  it("inProgress → in_progress / null conclusion", () => {
    const r = projectAdoPipelineRun(makeRun({ state: "inProgress", result: null }), CTX);
    expect(r.status).toBe("in_progress");
    expect(r.conclusion).toBeNull();
  });

  it("canceling + cancelling both → in_progress", () => {
    expect(projectAdoPipelineRun(makeRun({ state: "canceling" }), CTX).status).toBe("in_progress");
    expect(projectAdoPipelineRun(makeRun({ state: "cancelling" }), CTX).status).toBe("in_progress");
  });

  it("notStarted / postponed / unknown → queued", () => {
    for (const s of ["notStarted", "postponed", "unknown"] as const) {
      expect(projectAdoPipelineRun(makeRun({ state: s }), CTX).status).toBe("queued");
    }
  });

  it("partiallySucceeded collapses to failure", () => {
    const r = projectAdoPipelineRun(makeRun({ result: "partiallySucceeded" }), CTX);
    expect(r.conclusion).toBe("failure");
  });

  it("abandoned + canceled both collapse to cancelled", () => {
    expect(projectAdoPipelineRun(makeRun({ result: "canceled" }), CTX).conclusion).toBe("cancelled");
    expect(projectAdoPipelineRun(makeRun({ result: "abandoned" }), CTX).conclusion).toBe("cancelled");
  });

  it("runKind via classifyRunKind on yamlPath + name", () => {
    expect(projectAdoPipelineRun(makeRun({ yamlPath: "ci/test.yml", name: "Test" }), CTX).runKind).toBe("check");
    expect(projectAdoPipelineRun(makeRun({ yamlPath: "ci/build.yml", name: "Build image" }), CTX).runKind).toBe("build");
  });

  it("ref is stripped of refs/heads/", () => {
    const r = projectAdoPipelineRun(makeRun({ sourceBranch: "refs/heads/release/2.7" }), CTX);
    expect(r.ref).toBe("release/2.7");
  });
});
