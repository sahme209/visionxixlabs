import { describe, expect, it } from "vitest";
import {
  projectGitlabMergeRequest,
  projectGitlabPipeline,
  projectGitlabPipelineStatus,
  projectGitlabPipelineToCiStatus,
  projectGitlabReleaseTag,
  type GitlabMergeRequestPayload,
  type GitlabPipelinePayload,
  type GitlabReleaseTagPayload,
} from "../providers/gitlabProjectors";

const CTX = { organizationId: "o", repositoryId: "repo_1" };

function makeMr(over: Partial<GitlabMergeRequestPayload> = {}): GitlabMergeRequestPayload {
  return {
    iid: 482,
    title: "Retry banner",
    description: "Closes AXIOM-1023.",
    state: "opened",
    source_branch: "feat/retry",
    target_branch: "main",
    sha: "abc123",
    author: { username: "dev_user" },
    web_url: "https://gitlab.com/org/repo/-/merge_requests/482",
    labels: [],
    approvalsRequiredCount: 2,
    approvalsObservedCount: 1,
    codeownersApproved: false,
    headPipelineStatus: "pending",
    ...over,
  };
}

describe("projectGitlabMergeRequest — state mapping", () => {
  it("opened → open", () => {
    expect(projectGitlabMergeRequest(makeMr(), CTX).state).toBe("open");
  });
  it("merged → merged", () => {
    expect(projectGitlabMergeRequest(makeMr({ state: "merged", merged_at: "2026-06-01T00:00:00Z", merged_by: { username: "captain" } }), CTX).state).toBe("merged");
  });
  it("merged_at without merged state still → merged", () => {
    const r = projectGitlabMergeRequest(makeMr({ state: "closed", merged_at: "2026-06-01T00:00:00Z" }), CTX);
    expect(r.state).toBe("merged");
  });
  it("closed → closed; locked → closed", () => {
    expect(projectGitlabMergeRequest(makeMr({ state: "closed" }), CTX).state).toBe("closed");
    expect(projectGitlabMergeRequest(makeMr({ state: "locked" }), CTX).state).toBe("closed");
  });
});

describe("projectGitlabPipelineToCiStatus — closed-union projection", () => {
  it("success → passing", () => expect(projectGitlabPipelineToCiStatus("success")).toBe("passing"));
  it("failed → failing; canceled → failing", () => {
    expect(projectGitlabPipelineToCiStatus("failed")).toBe("failing");
    expect(projectGitlabPipelineToCiStatus("canceled")).toBe("failing");
  });
  it("running/pending/created etc. → pending", () => {
    for (const s of ["running", "pending", "preparing", "created", "waiting_for_resource", "scheduled", "manual"] as const) {
      expect(projectGitlabPipelineToCiStatus(s)).toBe("pending");
    }
  });
  it("skipped + null → not_run", () => {
    expect(projectGitlabPipelineToCiStatus("skipped")).toBe("not_run");
    expect(projectGitlabPipelineToCiStatus(null)).toBe("not_run");
  });
});

describe("projectGitlabMergeRequest — story + ticket extraction", () => {
  it("from description body", () => {
    const r = projectGitlabMergeRequest(makeMr({ description: "Closes AXIOM-1023 and CHG00482 and PLAT-99" }), CTX);
    expect(r.linkedStories.sort()).toEqual(["AXIOM-1023", "PLAT-99"]);
    expect(r.linkedTickets).toEqual(["CHG00482"]);
  });
  it("from labels (GitLab labels are flat strings)", () => {
    const r = projectGitlabMergeRequest(makeMr({ description: "", labels: ["AXIOM-1", "CHG00001", "needs-review"] }), CTX);
    expect(r.linkedStories).toEqual(["AXIOM-1"]);
    expect(r.linkedTickets).toEqual(["CHG00001"]);
  });
});

describe("projectGitlabReleaseTag", () => {
  it("maps tag_name + commit.id + description + author", () => {
    const r = projectGitlabReleaseTag(
      {
        tag_name: "v2.7.0",
        commit: { id: "deadbeef" },
        released_at: "2026-06-01T20:00:00Z",
        description: "Retry banner",
        author: { username: "captain" },
        prListSincePrevious: ["mr_482"],
        commitListSincePrevious: ["abc"],
      },
      CTX,
    );
    expect(r.tagName).toBe("v2.7.0");
    expect(r.commitSha).toBe("deadbeef");
    expect(r.taggerUserId).toBe("captain");
    expect(r.notes).toBe("Retry banner");
    expect(r.createdAt).toEqual(new Date("2026-06-01T20:00:00Z"));
    expect(r.prListJson).toEqual(["mr_482"]);
  });

  it("falls back to created_at when released_at is null", () => {
    const r = projectGitlabReleaseTag(
      { tag_name: "v1", commit: { id: "aaa" }, released_at: null, created_at: "2026-01-01T00:00:00Z" },
      CTX,
    );
    expect(r.createdAt).toEqual(new Date("2026-01-01T00:00:00Z"));
  });

  it("null author + description → nulls in row", () => {
    const r = projectGitlabReleaseTag({ tag_name: "v1", commit: { id: "aaa" } }, CTX);
    expect(r.taggerUserId).toBeNull();
    expect(r.notes).toBeNull();
    expect(r.prListJson).toBeNull();
  });
});

describe("projectGitlabPipelineStatus — closed-union pair (status, conclusion)", () => {
  it.each([
    ["success", "completed", "success"],
    ["failed", "completed", "failure"],
    ["canceled", "completed", "cancelled"],
    ["skipped", "completed", "skipped"],
  ] as const)("%s → [%s, %s]", (input, status, conclusion) => {
    const [s, c] = projectGitlabPipelineStatus(input);
    expect(s).toBe(status);
    expect(c).toBe(conclusion);
  });

  it("queued-shaped statuses → [queued, null]", () => {
    for (const s of ["created", "waiting_for_resource", "preparing", "pending", "manual", "scheduled"] as const) {
      expect(projectGitlabPipelineStatus(s)).toEqual(["queued", null]);
    }
  });

  it("running → [in_progress, null]", () => {
    expect(projectGitlabPipelineStatus("running")).toEqual(["in_progress", null]);
  });
});

describe("projectGitlabPipeline — full row", () => {
  function makeP(over: Partial<GitlabPipelinePayload> = {}): GitlabPipelinePayload {
    return {
      id: 99,
      ref: "main",
      sha: "abc123",
      status: "success",
      pipelineName: "deploy",
      configPath: ".gitlab-ci.yml",
      created_at: "2026-06-01T22:00:00Z",
      started_at: "2026-06-01T22:01:00Z",
      finished_at: "2026-06-01T22:25:00Z",
      web_url: "https://gitlab.com/org/repo/-/pipelines/99",
      ...over,
    };
  }
  it("happy path: success pipeline → completed/success runKind=deploy (name hint)", () => {
    const r = projectGitlabPipeline(makeP(), CTX);
    expect(r.status).toBe("completed");
    expect(r.conclusion).toBe("success");
    expect(r.runKind).toBe("deploy");
    expect(r.externalRunId).toBe("99");
  });

  it("falls back to configPath when pipelineName missing", () => {
    const r = projectGitlabPipeline(makeP({ pipelineName: undefined }), CTX);
    expect(r.workflowName).toBe(".gitlab-ci.yml");
  });

  it("startedAt + finishedAt round-trip as Dates", () => {
    const r = projectGitlabPipeline(makeP(), CTX);
    expect(r.startedAt).toEqual(new Date("2026-06-01T22:01:00Z"));
    expect(r.completedAt).toEqual(new Date("2026-06-01T22:25:00Z"));
  });
});
