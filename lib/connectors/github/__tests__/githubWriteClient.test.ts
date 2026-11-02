// Synthetic transport guards below test protocol behavior only; they grant no production authority.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBranch, commitFile, commitFiles, createPullRequest, dispatchWorkflow, getCommitCiStatus, getFile, getPullRequestGovernanceEvidence, getWorkflowRun, isSafeRepositoryPath, listBranches, listRepositoryFiles, resolveGitReference } from "../githubWriteClient";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe("createBranch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the base branch sha then creates a new ref pointing at it", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { object: { sha: "abc123" } }))
      .mockResolvedValueOnce(jsonResponse(201, { ref: "refs/heads/feature-x", object: { sha: "abc123" } }));

    const result = await createBranch({ beforeWrite:async()=>{},
      owner: "acme", repo: "widgets", baseBranch: "main", newBranchName: "feature-x", installationToken: "tok",
    });

    expect(result).toEqual({ ok: true, data: { ref: "refs/heads/feature-x", sha: "abc123" } });
    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining("/git/ref/heads/main"), expect.any(Object));
    const [, createCall] = fetchMock.mock.calls[1] as [string, { body: string }];
    expect(JSON.parse(createCall.body)).toEqual({ ref: "refs/heads/feature-x", sha: "abc123" });
  });

  it("fails clearly when the base branch doesn't exist", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { message: "Not Found" }));
    const result = await createBranch({ beforeWrite:async()=>{},
      owner: "acme", repo: "widgets", baseBranch: "does-not-exist", newBranchName: "feature-x", installationToken: "tok",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("base_branch_not_found");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("listBranches", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only normalized read-only branch metadata", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, [
      { name: "main", protected: true, commit: { sha: "abc123" } },
      { name: "feature/demo", protected: false, commit: { sha: "def456" } },
      { name: 42, protected: false, commit: {} },
    ]));

    const result = await listBranches({ owner: "acme", repo: "widgets", installationToken: "tok" });

    expect(result).toEqual({ ok: true, data: [
      { name: "main", protected: true, commitSha: "abc123" },
      { name: "feature/demo", protected: false, commitSha: "def456" },
    ] });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/repos/acme/widgets/branches?per_page=100&page=1"), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer tok" }),
    }));
  });
});

describe("commitFile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a new file (no existing sha) when the file doesn't exist yet", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, { message: "Not Found" }))
      .mockResolvedValueOnce(jsonResponse(201, { content: { sha: "newsha", html_url: "https://github.com/acme/widgets/blob/feature-x/a.txt" } }));

    const result = await commitFile({ beforeWrite:async()=>{},
      owner: "acme", repo: "widgets", branch: "feature-x", path: "a.txt", content: "hello", message: "add a.txt", installationToken: "tok",
    });

    expect(result).toEqual({ ok: true, data: { sha: "newsha", htmlUrl: "https://github.com/acme/widgets/blob/feature-x/a.txt" } });
    const [, putCall] = fetchMock.mock.calls[1] as [string, { body: string }];
    const putBody = JSON.parse(putCall.body);
    expect(putBody.sha).toBeUndefined();
    expect(Buffer.from(putBody.content, "base64").toString("utf8")).toBe("hello");
  });

  it("includes the existing file's sha when updating a file that already exists", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { sha: "oldsha" }))
      .mockResolvedValueOnce(jsonResponse(200, { content: { sha: "newsha", html_url: "https://github.com/acme/widgets/blob/feature-x/a.txt" } }));

    await commitFile({ beforeWrite:async()=>{},
      owner: "acme", repo: "widgets", branch: "feature-x", path: "a.txt", content: "updated", message: "update a.txt", installationToken: "tok",
    });

    const [, putCall] = fetchMock.mock.calls[1] as [string, { body: string }];
    expect(JSON.parse(putCall.body).sha).toBe("oldsha");
  });

  it("refuses an update when the file changed after approval was proposed", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sha: "newer-sha" }));
    const result = await commitFile({ beforeWrite:async()=>{},
      owner: "acme", repo: "widgets", branch: "feature-x", path: "a.txt", content: "updated", message: "update a.txt",
      installationToken: "tok", expectedSha: "reviewed-sha",
    });
    expect(result).toEqual({ ok: false, error: "github_file_changed_since_proposal" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a create when the proposed path now exists", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sha: "someone-created-it" }));
    const result = await commitFile({ beforeWrite:async()=>{},
      owner: "acme", repo: "widgets", branch: "feature-x", path: "a.txt", content: "updated", message: "add a.txt",
      installationToken: "tok", expectedSha: null,
    });
    expect(result).toEqual({ ok: false, error: "github_file_changed_since_proposal" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects traversal paths before contacting GitHub", async () => {
    const result = await commitFile({ beforeWrite:async()=>{},
      owner: "acme", repo: "widgets", branch: "feature-x", path: "../secret", content: "no", message: "bad", installationToken: "tok",
    });
    expect(result).toEqual({ ok: false, error: "invalid_repository_path" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("commitFiles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checks reviewed files against the captured commit rather than a branch which moved during review", async () => {
    fetchMock.mockReset();
    const writes: string[] = [];
    fetchMock.mockImplementation(async (raw: string, options: { method?: string }) => {
      const url = new URL(raw);
      if (options.method && options.method !== "GET") {
        writes.push(options.method);
        return jsonResponse(200, { sha: "synthetic-created", html_url: "https://github.test/commit" });
      }
      if (url.pathname.endsWith("/git/ref/heads/axiom%2Fchange")) return jsonResponse(200, { object: { type: "commit", sha: "captured-parent" } });
      if (url.pathname.endsWith("/git/commits/captured-parent")) return jsonResponse(200, { tree: { sha: "captured-tree" } });
      if (url.pathname.endsWith("/contents/src/a.ts")) {
        // The floating branch has advanced to the reviewed blob, but the
        // captured parent still contains a different file. Building on that
        // parent must not be authorized by evidence from the newer branch.
        return jsonResponse(200, { type: "file", path: "src/a.ts", sha: url.searchParams.get("ref") === "captured-parent" ? "older-blob" : "reviewed-blob", encoding: "base64", content: Buffer.from("fixture").toString("base64"), html_url: "https://github.test/a" });
      }
      if (url.pathname.endsWith("/contents/src/b.ts")) return jsonResponse(404, {});
      throw Error("unexpected_fixture_request");
    });
    try {
      const result = await commitFiles({ beforeWrite:async()=>{}, owner: "acme", repo: "widgets", branch: "axiom/change", message: "Reviewed change", installationToken: "synthetic-token", files: [{ path: "src/a.ts", content: "new a", expectedSha: "reviewed-blob" }, { path: "src/b.ts", content: "new b", expectedSha: null }] });
      expect(result).toEqual({ ok: false, error: "github_file_changed_since_proposal" });
      expect(writes).toEqual([]);
    } finally { fetchMock.mockReset(); }
  });

  it("creates blobs and advances the branch once for an atomic multi-file commit", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { object: { type: "commit", sha: "parent" } }))
      .mockResolvedValueOnce(jsonResponse(200, { tree: { sha: "base-tree" } }))
      .mockResolvedValueOnce(jsonResponse(200, { type: "file", path: "src/a.ts", sha: "a-old", encoding: "base64", content: Buffer.from("old").toString("base64"), html_url: "https://github.test/a" }))
      .mockResolvedValueOnce(jsonResponse(404, { message: "Not Found" }))
      .mockResolvedValueOnce(jsonResponse(201, { sha: "blob-a" }))
      .mockResolvedValueOnce(jsonResponse(201, { sha: "blob-b" }))
      .mockResolvedValueOnce(jsonResponse(201, { sha: "new-tree" }))
      .mockResolvedValueOnce(jsonResponse(201, { sha: "new-commit", html_url: "https://github.test/commit" }))
      .mockResolvedValueOnce(jsonResponse(200, { ref: "refs/heads/axiom/change" }));

    const result = await commitFiles({ beforeWrite:async()=>{},
      owner: "acme", repo: "widgets", branch: "axiom/change", message: "Update feature", installationToken: "tok",
      files: [
        { path: "src/a.ts", content: "new a", expectedSha: "a-old" },
        { path: "src/b.ts", content: "new b", expectedSha: null },
      ],
    });

    expect(result).toEqual({ ok: true, data: { sha: "new-commit", htmlUrl: "https://github.test/commit", fileCount: 2 } });
    const [, refUpdate] = fetchMock.mock.calls[8] as [string, { method: string; body: string }];
    expect(refUpdate.method).toBe("PATCH");
    expect(JSON.parse(refUpdate.body)).toEqual({ sha: "new-commit", force: false });
  });

  it("refuses the whole commit if any reviewed file changed", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { object: { type: "commit", sha: "parent" } }))
      .mockResolvedValueOnce(jsonResponse(200, { tree: { sha: "base-tree" } }))
      .mockResolvedValueOnce(jsonResponse(200, { type: "file", path: "src/a.ts", sha: "newer", encoding: "base64", content: Buffer.from("changed").toString("base64"), html_url: "https://github.test/a" }));
    const result = await commitFiles({ beforeWrite:async()=>{},
      owner: "acme", repo: "widgets", branch: "axiom/change", message: "Update feature", installationToken: "tok",
      files: [{ path: "src/a.ts", content: "new a", expectedSha: "reviewed" }, { path: "src/b.ts", content: "new b", expectedSha: null }],
    });
    expect(result).toEqual({ ok: false, error: "github_file_changed_since_proposal" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns a divergent branch-update rejection without forcing or rebuilding on a newer parent", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { object: { type: "commit", sha: "captured-parent" } }))
      .mockResolvedValueOnce(jsonResponse(200, { tree: { sha: "captured-tree" } }))
      .mockResolvedValueOnce(jsonResponse(200, { type: "file", path: "src/a.ts", sha: "a-old", encoding: "base64", content: Buffer.from("old").toString("base64"), html_url: "https://github.test/a" }))
      .mockResolvedValueOnce(jsonResponse(404, {}))
      .mockResolvedValueOnce(jsonResponse(201, { sha: "a-new" }))
      .mockResolvedValueOnce(jsonResponse(201, { sha: "b-new" }))
      .mockResolvedValueOnce(jsonResponse(201, { sha: "new-tree" }))
      .mockResolvedValueOnce(jsonResponse(201, { sha: "new-commit" }))
      .mockResolvedValueOnce(jsonResponse(422, { message: "Update is not a fast forward" }));
    const result = await commitFiles({ beforeWrite:async()=>{}, owner: "acme", repo: "widgets", branch: "axiom/change", message: "Reviewed change", installationToken: "synthetic-token", files: [{ path: "src/a.ts", content: "new a", expectedSha: "a-old" }, { path: "src/b.ts", content: "new b", expectedSha: null }] });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("github_422:") });
    expect(fetchMock).toHaveBeenCalledTimes(9);
    expect(JSON.parse(fetchMock.mock.calls[8][1].body)).toEqual({ sha: "new-commit", force: false });
    expect(String(fetchMock.mock.calls[2][0])).toContain("ref=captured-parent");
    expect(String(fetchMock.mock.calls[3][0])).toContain("ref=captured-parent");
    expect(JSON.parse(fetchMock.mock.calls[7][1].body).parents).toEqual(["captured-parent"]);
  });
});

describe("getFile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("decodes a UTF-8 repository file", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      type: "file", path: "src/app.ts", sha: "abc", encoding: "base64",
      content: Buffer.from("export const ready = true;", "utf8").toString("base64"),
      html_url: "https://github.com/acme/widgets/blob/main/src/app.ts",
    }));
    const result = await getFile({ owner: "acme", repo: "widgets", branch: "main", path: "src/app.ts", installationToken: "tok" });
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ content: "export const ready = true;", sha: "abc" }) });
  });

  it("rejects non-text bytes", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      type: "file", path: "image.bin", sha: "abc", encoding: "base64",
      content: Buffer.from([0xff, 0xfe, 0xfd]).toString("base64"), html_url: "https://github.com/acme/widgets/blob/main/image.bin",
    }));
    await expect(getFile({ owner: "acme", repo: "widgets", branch: "main", path: "image.bin", installationToken: "tok" }))
      .resolves.toEqual({ ok: false, error: "github_file_is_not_utf8_text" });
  });
});

describe("listRepositoryFiles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves a branch to its recursive tree and returns only repository files", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { object: { type: "commit", sha: "commit-sha" } }))
      .mockResolvedValueOnce(jsonResponse(200, { tree: { sha: "tree-sha" } }))
      .mockResolvedValueOnce(jsonResponse(200, {
        truncated: false,
        tree: [
          { path: "src", type: "tree", size: 0 },
          { path: "src/index.ts", type: "blob", size: 42 },
          { path: "README.md", type: "blob" },
          { path: "", type: "blob", size: 1 },
        ],
      }));

    const result = await listRepositoryFiles({
      owner: "acme", repo: "widgets", branch: "main", installationToken: "tok",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        files: [{ path: "README.md", size: 0 }, { path: "src/index.ts", size: 42 }],
        truncated: false,
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining("/git/ref/heads/main"), expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining("/git/commits/commit-sha"), expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(3, expect.stringContaining("/git/trees/tree-sha?recursive=1"), expect.any(Object));
  });

  it("rejects malformed branch names before contacting GitHub", async () => {
    await expect(listRepositoryFiles({
      owner: "acme", repo: "widgets", branch: "main\nother", installationToken: "tok",
    })).resolves.toEqual({ ok: false, error: "invalid_branch_name" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("isSafeRepositoryPath", () => {
  it("accepts normal nested files and rejects ambiguous paths", () => {
    expect(isSafeRepositoryPath("src/app.ts")).toBe(true);
    expect(isSafeRepositoryPath("/src/app.ts")).toBe(false);
    expect(isSafeRepositoryPath("src/../secret")).toBe(false);
    expect(isSafeRepositoryPath("src//app.ts")).toBe(false);
  });
});

describe("createPullRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens a pull request and returns its number and URL", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { number: 42, html_url: "https://github.com/acme/widgets/pull/42" }));
    const result = await createPullRequest({ beforeWrite:async()=>{},
      owner: "acme", repo: "widgets", head: "feature-x", base: "main", title: "Add a.txt", installationToken: "tok",
    });
    expect(result).toEqual({ ok: true, data: { number: 42, htmlUrl: "https://github.com/acme/widgets/pull/42" } });
  });

  it("surfaces a clear error when GitHub rejects the PR (e.g. one already exists)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(422, { message: "A pull request already exists for acme:feature-x." }));
    const result = await createPullRequest({ beforeWrite:async()=>{},
      owner: "acme", repo: "widgets", head: "feature-x", base: "main", title: "Add a.txt", installationToken: "tok",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("pull_request_create_failed");
  });
});

describe("deployment governance evidence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dereferences an annotated release tag to its commit", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { object: { type: "tag", sha: "tag-object" } }))
      .mockResolvedValueOnce(jsonResponse(200, { object: { type: "commit", sha: "release-commit" } }));
    const result = await resolveGitReference({ owner: "acme", repo: "widgets", ref: "v1.2.3", kind: "tag", installationToken: "tok" });
    expect(result).toEqual({ ok: true, data: { kind: "tag", ref: "v1.2.3", commitSha: "release-commit" } });
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining("/git/tags/tag-object"), expect.any(Object));
  });

  it("collects merged PR, CODEOWNERS enforcement, approval, and ticket evidence", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, {
        number: 42, state: "closed", merged_at: "2026-10-07T12:00:00Z",
        head: { ref: "release/2026-10", sha: "sha-1" }, base: { ref: "main" }, merge_commit_sha: "merge-sha",
        body: "Release approved under CHG12345", labels: [{ name: "production" }], html_url: "https://github.test/pull/42",
      }))
      .mockResolvedValueOnce(jsonResponse(200, [{ state: "APPROVED", user: { login: "reviewer" } }]))
      .mockResolvedValueOnce(jsonResponse(200, { require_code_owner_reviews: true }));
    const result = await getPullRequestGovernanceEvidence({
      owner: "acme", repo: "widgets", pullRequestNumber: 42, requireCodeowners: true, installationToken: "tok",
    });
    expect(result).toEqual({ ok: true, data: expect.objectContaining({
      mergedAt: "2026-10-07T12:00:00Z", approvedReviewCount: 1,
      codeOwnerReviewsRequired: true, linkedChangeTickets: ["CHG12345"],
    }) });
  });
});

describe("dispatchWorkflow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dispatches with the given ref and string inputs, and succeeds on GitHub's 204", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(204, {}));
    const result = await dispatchWorkflow({ beforeWrite:async()=>{},
      owner: "acme", repo: "widgets", workflowFile: "axiom-deploy-aws-ecs.yml", ref: "abc1234",
      inputs: { role_arn: "arn:aws:iam::123456789012:role/deploy", region: "us-east-1", cluster: "prod", service: "web" },
      installationToken: "tok",
    });
    expect(result.ok).toBe(true);
    expect(result).toEqual({ ok: true, data: { workflowRunId: null, runUrl: null, htmlUrl: null } });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/repos/acme/widgets/actions/workflows/axiom-deploy-aws-ecs.yml/dispatches"),
      expect.any(Object),
    );
    const [, call] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(call.body)).toEqual({
      ref: "abc1234",
      inputs: { role_arn: "arn:aws:iam::123456789012:role/deploy", region: "us-east-1", cluster: "prod", service: "web" },
    });
  });

  it("captures the exact run identity from GitHub's current dispatch response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      workflow_run_id: 123456789,
      run_url: "https://api.github.com/repos/acme/widgets/actions/runs/123456789",
      html_url: "https://github.com/acme/widgets/actions/runs/123456789",
    }));
    const result = await dispatchWorkflow({ beforeWrite:async()=>{},
      owner: "acme", repo: "widgets", workflowFile: "axiom-deploy-aws-ecs.yml", ref: "main",
      inputs: { role_arn: "arn", region: "us-east-1", cluster: "prod", service: "web" }, installationToken: "tok",
    });
    expect(result).toEqual({ ok: true, data: {
      workflowRunId: "123456789",
      runUrl: "https://api.github.com/repos/acme/widgets/actions/runs/123456789",
      htmlUrl: "https://github.com/acme/widgets/actions/runs/123456789",
    } });
    const [, call] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(call.headers["X-GitHub-Api-Version"]).toBe("2026-03-10");
  });

  it("surfaces a clear error when GitHub rejects the dispatch (e.g. workflow file not found)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { message: "Not Found" }));
    const result = await dispatchWorkflow({ beforeWrite:async()=>{},
      owner: "acme", repo: "widgets", workflowFile: "axiom-deploy-aws-ecs.yml", ref: "main",
      inputs: { role_arn: "arn", region: "us-east-1", cluster: "prod", service: "web" },
      installationToken: "tok",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("workflow_dispatch_failed");
  });
});

describe("getWorkflowRun", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not certify rollback recovery from an opaque successful step", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, {
        id: 123, status: "completed", conclusion: "failure",
        html_url: "https://github.com/acme/widgets/actions/runs/123",
        created_at: "2026-10-07T10:00:00Z", run_started_at: "2026-10-07T10:00:02Z", updated_at: "2026-10-07T10:08:00Z",
      }))
      .mockResolvedValueOnce(jsonResponse(200, { jobs: [{ steps: [
        { name: "Wait for the new deployment to stabilize", status: "completed", conclusion: "failure" },
        { name: "Roll back — deployment did not stabilize", status: "completed", conclusion: "success" },
      ] }] }));
    const result = await getWorkflowRun({ owner: "acme", repo: "widgets", workflowRunId: "123", installationToken: "tok" });
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ status: "completed", conclusion: "failure", rollback: "unknown" }) });
  });

  it("rejects an invalid run id before contacting GitHub", async () => {
    await expect(getWorkflowRun({ owner: "acme", repo: "widgets", workflowRunId: "../secrets", installationToken: "tok" }))
      .resolves.toEqual({ ok: false, error: "invalid_workflow_run_id" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getCommitCiStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports no_checks when neither combined status nor check-runs exist", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { state: "pending", total_count: 0, statuses: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { check_runs: [] }));
    const result = await getCommitCiStatus({ owner: "acme", repo: "widgets", commitSha: "sha1", installationToken: "tok" });
    expect(result).toEqual({ ok: true, data: { state: "no_checks", detailsUrl: null } });
  });

  it("reports success when all check-runs completed successfully", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { state: "success", total_count: 0, statuses: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { check_runs: [
        { status: "completed", conclusion: "success", html_url: "https://github.test/checks/1" },
        { status: "completed", conclusion: "neutral", html_url: "https://github.test/checks/2" },
      ] }));
    const result = await getCommitCiStatus({ owner: "acme", repo: "widgets", commitSha: "sha1", installationToken: "tok" });
    expect(result).toEqual({ ok: true, data: { state: "success", detailsUrl: "https://github.test/checks/1" } });
  });

  it("reports failure when any check-run failed", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { state: "success", total_count: 0, statuses: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { check_runs: [
        { status: "completed", conclusion: "success", html_url: "https://github.test/checks/1" },
        { status: "completed", conclusion: "failure", html_url: "https://github.test/checks/2" },
      ] }));
    const result = await getCommitCiStatus({ owner: "acme", repo: "widgets", commitSha: "sha1", installationToken: "tok" });
    expect(result).toEqual({ ok: true, data: { state: "failure", detailsUrl: "https://github.test/checks/1" } });
  });

  it("reports failure when the legacy combined status reports failure, even if check-runs are clean", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { state: "failure", total_count: 1, statuses: [{ state: "failure", target_url: "https://ci.test/1" }] }))
      .mockResolvedValueOnce(jsonResponse(200, { check_runs: [] }));
    const result = await getCommitCiStatus({ owner: "acme", repo: "widgets", commitSha: "sha1", installationToken: "tok" });
    expect(result).toEqual({ ok: true, data: { state: "failure", detailsUrl: "https://ci.test/1" } });
  });

  it("reports pending when a check-run is still in progress", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { state: "success", total_count: 0, statuses: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { check_runs: [
        { status: "in_progress", conclusion: null, html_url: "https://github.test/checks/1" },
      ] }));
    const result = await getCommitCiStatus({ owner: "acme", repo: "widgets", commitSha: "sha1", installationToken: "tok" });
    expect(result).toEqual({ ok: true, data: { state: "pending", detailsUrl: "https://github.test/checks/1" } });
  });

  it("surfaces a clear error when the combined-status call fails", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, { message: "server error" }))
      .mockResolvedValueOnce(jsonResponse(200, { check_runs: [] }));
    const result = await getCommitCiStatus({ owner: "acme", repo: "widgets", commitSha: "sha1", installationToken: "tok" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("commit_status_unavailable");
  });
});


describe("uncertain GitHub writes", () => {
  beforeEach(() => vi.clearAllMocks());
  const input = { owner: "acme", repo: "widgets", baseBranch: "main", newBranchName: "feature-x", installationToken: "synthetic-token" };
  it("does not disclose transport details or retry a branch write after connection loss", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { object: { sha: "base" } }))
      .mockRejectedValueOnce(new Error("connection lost with synthetic private detail"));
    expect(await createBranch({...input,beforeWrite:async()=>{}})).toEqual({ ok: false, error: "action_outcome_unknown" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("treats a server error after a branch write as unconfirmed", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { object: { sha: "base" } }))
      .mockResolvedValueOnce(jsonResponse(502, { message: "synthetic upstream detail" }));
    expect(await createBranch({...input,beforeWrite:async()=>{}})).toEqual({ ok: false, error: "action_outcome_unknown" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("preserves uncertainty for pull requests without a misleading failure prefix", async () => {
    fetchMock.mockRejectedValueOnce(new Error("synthetic lost response"));
    expect(await createPullRequest({ beforeWrite:async()=>{}, owner: "acme", repo: "widgets", head: "feature-x", base: "main", title: "Reviewed change", installationToken: "synthetic-token" }))
      .toEqual({ ok: false, error: "action_outcome_unknown" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("treats a timed-out write as unconfirmed", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { object: { sha: "base" } }))
      .mockResolvedValueOnce(jsonResponse(408, { message: "request timeout" }));
    expect(await createBranch({...input,beforeWrite:async()=>{}})).toEqual({ ok: false, error: "action_outcome_unknown" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("does not claim a pull request exists when the successful response lacks its identity", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, {}));
    expect(await createPullRequest({ beforeWrite:async()=>{}, owner: "acme", repo: "widgets", head: "feature-x", base: "main", title: "Reviewed change", installationToken: "synthetic-token" }))
      .toEqual({ ok: false, error: "action_outcome_unknown" });
  });
  it("retains a definite authorization rejection without retrying", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { object: { sha: "base" } }))
      .mockResolvedValueOnce(jsonResponse(403, { message: "Forbidden" }));
    const result = await createBranch({...input,beforeWrite:async()=>{}});
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/^github_403:/) });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not treat an unreadable pull request response as confirmed success", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => { throw new Error("synthetic broken body"); } });
    expect(await createPullRequest({ beforeWrite:async()=>{}, owner: "acme", repo: "widgets", head: "feature-x", base: "main", title: "Reviewed change", installationToken: "synthetic-token" }))
      .toEqual({ ok: false, error: "action_outcome_unknown" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

});

describe("bounded workflow metadata file reads", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uses GET-only redirect-refusing bounded transport", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({type:'file',path:'.github/workflows/deploy.yml',sha:'a'.repeat(40),encoding:'base64',content:Buffer.from('on: workflow_dispatch').toString('base64'),html_url:'https://github.com/acme/widgets'}),{status:200}));
    const result = await getFile({owner:'acme',repo:'widgets',branch:'main',path:'.github/workflows/deploy.yml',installationToken:'synthetic-token',read:{signal:new AbortController().signal,maxBytes:200000}});
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/contents/.github/workflows/deploy.yml?ref=main'),expect.objectContaining({method:'GET',redirect:'error',cache:'no-store',credentials:'omit'}));
  });
  it("rejects oversized transport bodies before parsing metadata", async () => {
    fetchMock.mockResolvedValueOnce(new Response('x'.repeat(101),{status:200,headers:{'content-length':'101'}}));
    const result=await getFile({owner:'acme',repo:'widgets',branch:'main',path:'.github/workflows/deploy.yml',installationToken:'synthetic-token',read:{signal:new AbortController().signal,maxBytes:100}});
    expect(result).toEqual({ok:false,error:'github_provenance_read_unavailable'});
  });
});

describe('server-owned mutation admission',()=>{
 beforeEach(()=>{fetchMock.mockReset();});
 it('rechecks admission after branch observation and before its only POST',async()=>{fetchMock.mockResolvedValueOnce(jsonResponse(200,{object:{sha:'base'}})).mockResolvedValueOnce(jsonResponse(201,{ref:'refs/heads/new',object:{sha:'base'}}));const beforeWrite=vi.fn(async()=>{throw Error('enrolled')});const result=await createBranch({owner:'acme',repo:'widgets',baseBranch:'main',newBranchName:'new',installationToken:'synthetic',beforeWrite}as any);expect(result).toEqual({ok:false,error:'github_write_authority_unavailable'});expect(beforeWrite).toHaveBeenCalledOnce();expect(fetchMock).toHaveBeenCalledTimes(1)});
 it('does not submit a pull request when current policy cannot be verified',async()=>{fetchMock.mockResolvedValue(jsonResponse(201,{number:4,html_url:'https://github.test/pr/4'}));const beforeWrite=vi.fn(async()=>{throw Error('unavailable')});expect(await createPullRequest({owner:'acme',repo:'widgets',head:'feature',base:'main',title:'Reviewed',installationToken:'synthetic',beforeWrite}as any)).toEqual({ok:false,error:'github_write_authority_unavailable'});expect(fetchMock).not.toHaveBeenCalled()});
 it('keeps a dispatched network failure unknown and does not retry',async()=>{fetchMock.mockRejectedValueOnce(Error('lost response'));const beforeWrite=vi.fn(async()=>{});expect(await createPullRequest({owner:'acme',repo:'widgets',head:'feature',base:'main',title:'Reviewed',installationToken:'synthetic',beforeWrite}as any)).toEqual({ok:false,error:'action_outcome_unknown'});expect(fetchMock).toHaveBeenCalledOnce();expect(beforeWrite).toHaveBeenCalledOnce()});
});


describe('multi-object mutation authority',()=>{
 beforeEach(()=>{fetchMock.mockReset();});
 const input={owner:'acme',repo:'widgets',branch:'axiom/change',message:'Reviewed',installationToken:'synthetic',files:[{path:'src/a.ts',content:'new a',expectedSha:'a-old'},{path:'src/b.ts',content:'new b',expectedSha:null}]};
 function provider(){fetchMock.mockImplementation(async(url:string,options:any)=>{if(options.method==='POST'||options.method==='PATCH')return jsonResponse(201,{sha:'created',html_url:'https://github.test/commit'});if(url.includes('/git/ref/heads/'))return jsonResponse(200,{object:{type:'commit',sha:'parent'}});if(url.includes('/git/commits/'))return jsonResponse(200,{tree:{sha:'tree'}});if(url.includes('/contents/src/a.ts'))return jsonResponse(200,{type:'file',path:'src/a.ts',sha:'a-old',encoding:'base64',content:Buffer.from('old').toString('base64'),html_url:'https://github.test/a'});return jsonResponse(404,{message:'Not Found'})})}
 it('checks current authority before every blob, tree, commit and reference mutation',async()=>{provider();const beforeWrite=vi.fn(async()=>{});expect((await commitFiles({...input,beforeWrite})).ok).toBe(true);expect(beforeWrite).toHaveBeenCalledTimes(5);expect(fetchMock.mock.calls.filter(c=>['POST','PATCH'].includes(c[1]?.method))).toHaveLength(5)});
 it('keeps partial object creation unknown when later authority is refused and never advances the branch',async()=>{provider();let checks=0;const beforeWrite=vi.fn(async()=>{if(++checks>1)throw Error('enrolled')});expect(await commitFiles({...input,beforeWrite})).toEqual({ok:false,error:'action_outcome_unknown'});expect(fetchMock.mock.calls.filter(c=>c[1]?.method==='POST')).toHaveLength(1);expect(fetchMock.mock.calls.some(c=>c[1]?.method==='PATCH')).toBe(false)});
});


describe("reviewed immutable branch creation", () => {
  beforeEach(() => vi.clearAllMocks());
  const input = { owner: "acme", repo: "widgets", baseBranch: "main", newBranchName: "reviewed", installationToken: "fixture", expectedBaseSha: "a".repeat(40) };
  it("refuses changed source without invoking write authority or POST", async () => {
    const beforeWrite = vi.fn(async () => {});
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { object: { sha: "b".repeat(40) } }));
    expect(await createBranch({ ...input, beforeWrite })).toEqual({ ok: false, error: "branch_source_changed" });
    expect(beforeWrite).not.toHaveBeenCalled(); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed reviewed SHA before any provider call", async () => {
    expect(await createBranch({ ...input, expectedBaseSha: "short", beforeWrite: async () => {} })).toEqual({ ok: false, error: "invalid_reviewed_branch_source" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("sends exactly the approved SHA even when the symbolic base moves during authority validation", async () => {
    let currentSha = input.expectedBaseSha;
    fetchMock.mockImplementation(async (_url, init) => init.method === "POST" ? jsonResponse(201, { ref: "refs/heads/reviewed", object: { sha: JSON.parse(init.body).sha } }) : jsonResponse(200, { object: { sha: currentSha } }));
    const result = await createBranch({ ...input, beforeWrite: async () => { currentSha = "b".repeat(40); } });
    expect(result).toEqual({ ok: true, data: { ref: "refs/heads/reviewed", sha: input.expectedBaseSha } });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ ref: "refs/heads/reviewed", sha: input.expectedBaseSha });
  });
});


describe("reviewed pull-request source checks",()=>{
  const input={owner:"acme",repo:"widgets",head:"reviewed",base:"main",title:"Reviewed change",installationToken:"fixture",expectedHeadSha:"a".repeat(40),expectedBaseSha:"b".repeat(40)};
  beforeEach(()=>{fetchMock.mockReset();});
  function respond(changed?:"head"|"base"|"response") { fetchMock.mockImplementation(async(url:string,init:any)=>{
    if(init.method === "POST") return jsonResponse(201,{number:42,html_url:"https://github.com/acme/widgets/pull/42",head:{ref:"reviewed",sha:(changed==="response"?"c":"a").repeat(40),repo:{full_name:"acme/widgets"}},base:{ref:"main",sha:"b".repeat(40),repo:{full_name:"acme/widgets"}}});
    const head=url.endsWith("/reviewed");return jsonResponse(200,{object:{type:"commit",sha:((head&&changed==="head")||(!head&&changed==="base")?"c":head?"a":"b").repeat(40)}});
  }); }
  it.each(["head","base"] as const)("refuses changed %s without POST or final write authority",async changed=>{respond(changed);const beforeWrite=vi.fn(async()=>{});expect(await createPullRequest({...input,beforeWrite})).toEqual({ok:false,error:"pull_request_source_changed"});expect(beforeWrite).not.toHaveBeenCalled();expect(fetchMock.mock.calls.some(([,init])=>init.method==='POST')).toBe(false);});
  it("confirms only the source pair returned by the creation response",async()=>{respond();const beforeWrite=vi.fn(async()=>{});expect(await createPullRequest({...input,beforeWrite})).toEqual({ok:true,data:{number:42,htmlUrl:"https://github.com/acme/widgets/pull/42"}});expect(beforeWrite).toHaveBeenCalledOnce();expect(fetchMock.mock.calls.filter(([,init])=>init.method==='POST')).toHaveLength(1);});
  it("does not confirm or retry a possibly created PR with changed response source",async()=>{respond("response");expect(await createPullRequest({...input,beforeWrite:async()=>{}})).toEqual({ok:false,error:"action_outcome_unknown"});expect(fetchMock.mock.calls.filter(([,init])=>init.method==='POST')).toHaveLength(1);});
  it("rejects incomplete reviewed source before reading or writing",async()=>{expect(await createPullRequest({...input,expectedBaseSha:undefined,beforeWrite:async()=>{}})).toEqual({ok:false,error:"invalid_reviewed_pull_request_source"});expect(fetchMock).not.toHaveBeenCalled();});
  it.each(['missing_base','wrong_head_ref','foreign_repository','nonstring_repository'])('keeps malformed or mismatched %s creation evidence unknown',async kind=>{
    respond();const original=fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async(url:string,init:any)=>{const response=await original(url,init);if(init.method!=='POST')return response;const data=await response.json();if(kind==='missing_base')delete data.base;else if(kind==='wrong_head_ref')data.head.ref='another';else data.head.repo.full_name=kind==='foreign_repository'?'other/widgets':123;return jsonResponse(201,data)});
    expect(await createPullRequest({...input,beforeWrite:async()=>{}})).toEqual({ok:false,error:'action_outcome_unknown'});expect(fetchMock.mock.calls.filter(([,init])=>init.method==='POST')).toHaveLength(1);
  });

});


describe('branch commit provenance parsing',()=>{
 beforeEach(()=>{fetchMock.mockReset();});
 it.each(['tree','tag',undefined])('refuses branch reference object type %s',async type=>{fetchMock.mockResolvedValueOnce(jsonResponse(200,{object:{type,sha:'a'.repeat(40)}}));expect(await resolveGitReference({owner:'acme',repo:'widgets',ref:'reviewed',kind:'branch',installationToken:'fixture'})).toEqual({ok:false,error:'branch_commit_unavailable'});});
});
