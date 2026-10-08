import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBranch, commitFile, createPullRequest, dispatchWorkflow, getFile, getPullRequestGovernanceEvidence, getWorkflowRun, isSafeRepositoryPath, resolveGitReference } from "../githubWriteClient";

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

    const result = await createBranch({
      owner: "acme", repo: "widgets", baseBranch: "main", newBranchName: "feature-x", installationToken: "tok",
    });

    expect(result).toEqual({ ok: true, data: { ref: "refs/heads/feature-x", sha: "abc123" } });
    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining("/git/ref/heads/main"), expect.any(Object));
    const [, createCall] = fetchMock.mock.calls[1] as [string, { body: string }];
    expect(JSON.parse(createCall.body)).toEqual({ ref: "refs/heads/feature-x", sha: "abc123" });
  });

  it("fails clearly when the base branch doesn't exist", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { message: "Not Found" }));
    const result = await createBranch({
      owner: "acme", repo: "widgets", baseBranch: "does-not-exist", newBranchName: "feature-x", installationToken: "tok",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("base_branch_not_found");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("commitFile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a new file (no existing sha) when the file doesn't exist yet", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, { message: "Not Found" }))
      .mockResolvedValueOnce(jsonResponse(201, { content: { sha: "newsha", html_url: "https://github.com/acme/widgets/blob/feature-x/a.txt" } }));

    const result = await commitFile({
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

    await commitFile({
      owner: "acme", repo: "widgets", branch: "feature-x", path: "a.txt", content: "updated", message: "update a.txt", installationToken: "tok",
    });

    const [, putCall] = fetchMock.mock.calls[1] as [string, { body: string }];
    expect(JSON.parse(putCall.body).sha).toBe("oldsha");
  });

  it("refuses an update when the file changed after approval was proposed", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sha: "newer-sha" }));
    const result = await commitFile({
      owner: "acme", repo: "widgets", branch: "feature-x", path: "a.txt", content: "updated", message: "update a.txt",
      installationToken: "tok", expectedSha: "reviewed-sha",
    });
    expect(result).toEqual({ ok: false, error: "github_file_changed_since_proposal" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a create when the proposed path now exists", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sha: "someone-created-it" }));
    const result = await commitFile({
      owner: "acme", repo: "widgets", branch: "feature-x", path: "a.txt", content: "updated", message: "add a.txt",
      installationToken: "tok", expectedSha: null,
    });
    expect(result).toEqual({ ok: false, error: "github_file_changed_since_proposal" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects traversal paths before contacting GitHub", async () => {
    const result = await commitFile({
      owner: "acme", repo: "widgets", branch: "feature-x", path: "../secret", content: "no", message: "bad", installationToken: "tok",
    });
    expect(result).toEqual({ ok: false, error: "invalid_repository_path" });
    expect(fetchMock).not.toHaveBeenCalled();
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
    const result = await createPullRequest({
      owner: "acme", repo: "widgets", head: "feature-x", base: "main", title: "Add a.txt", installationToken: "tok",
    });
    expect(result).toEqual({ ok: true, data: { number: 42, htmlUrl: "https://github.com/acme/widgets/pull/42" } });
  });

  it("surfaces a clear error when GitHub rejects the PR (e.g. one already exists)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(422, { message: "A pull request already exists for acme:feature-x." }));
    const result = await createPullRequest({
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
    const result = await dispatchWorkflow({
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
    const result = await dispatchWorkflow({
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
    const result = await dispatchWorkflow({
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

  it("reports successful rollback evidence from the exact run's steps", async () => {
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
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ status: "completed", conclusion: "failure", rollback: "succeeded" }) });
  });

  it("rejects an invalid run id before contacting GitHub", async () => {
    await expect(getWorkflowRun({ owner: "acme", repo: "widgets", workflowRunId: "../secrets", installationToken: "tok" }))
      .resolves.toEqual({ ok: false, error: "invalid_workflow_run_id" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
