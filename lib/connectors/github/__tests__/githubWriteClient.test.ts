import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBranch, commitFile, createPullRequest, dispatchWorkflow } from "../githubWriteClient";

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
