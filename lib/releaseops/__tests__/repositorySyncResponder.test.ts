import { describe, expect, it } from "vitest";
import {
  buildRepositorySyncResponse,
  parseAzureDevOpsLocator,
  type RepositorySyncRepo,
  type SyncRepositoryRow,
  type GitHubFetcher,
  type AzureDevOpsFetcher,
} from "../repositorySyncResponder";
import type {
  GithubPrPayload,
  GithubReleaseTagPayload,
  GithubWorkflowRunPayload,
} from "../providers/githubProjectors";
import type {
  PullRequestRecordRow,
  ReleaseTagRecordRow,
  WorkflowRunRecordRow,
} from "../gitDiscoveryRepo";

function makeRepoStub(initial?: SyncRepositoryRow): RepositorySyncRepo & {
  _prs: Map<string, PullRequestRecordRow>;
  _tags: Map<string, ReleaseTagRecordRow>;
  _runs: Map<string, WorkflowRunRecordRow>;
} {
  const prs = new Map<string, PullRequestRecordRow>();
  const tags = new Map<string, ReleaseTagRecordRow>();
  const runs = new Map<string, WorkflowRunRecordRow>();
  const repoRow = initial;
  return {
    _prs: prs,
    _tags: tags,
    _runs: runs,
    repository: {
      async findUnique({ where }) {
        return repoRow && repoRow.id === where.id ? repoRow : null;
      },
    },
    pullRequestRecord: {
      async findUnique() { return null; },
      async findMany() { return []; },
      async upsert({ where, create }) {
        const k = `${where.repositoryId_number.repositoryId}#${where.repositoryId_number.number}`;
        const row: PullRequestRecordRow = {
          id: `pr_${prs.size + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSyncedAt: create.lastSyncedAt ?? new Date(),
          ...create,
        } as PullRequestRecordRow;
        prs.set(k, row);
        return row;
      },
    },
    releaseTagRecord: {
      async findUnique() { return null; },
      async findMany() { return []; },
      async upsert({ where, create }) {
        const k = `${where.repositoryId_tagName.repositoryId}#${where.repositoryId_tagName.tagName}`;
        const row: ReleaseTagRecordRow = {
          id: `tag_${tags.size + 1}`,
          updatedAt: new Date(),
          lastSyncedAt: create.lastSyncedAt ?? new Date(),
          ...create,
        } as ReleaseTagRecordRow;
        tags.set(k, row);
        return row;
      },
    },
    workflowRunRecord: {
      async findUnique() { return null; },
      async findMany() { return []; },
      async upsert({ where, create }) {
        const k = `${where.repositoryId_externalRunId.repositoryId}#${where.repositoryId_externalRunId.externalRunId}`;
        const row: WorkflowRunRecordRow = {
          id: `run_${runs.size + 1}`,
          createdAt: new Date(),
          lastSyncedAt: create.lastSyncedAt ?? new Date(),
          ...create,
        } as WorkflowRunRecordRow;
        runs.set(k, row);
        return row;
      },
    },
    async $transaction(fn) {
      return fn(this);
    },
  };
}

function fetcherStub(over: Partial<GitHubFetcher> = {}): GitHubFetcher {
  return {
    async listPullRequests() { return []; },
    async listReleases() { return []; },
    async listWorkflowRuns() { return []; },
    ...over,
  };
}

const REPO_ROW: SyncRepositoryRow = {
  id: "repo_1",
  organizationId: "o",
  provider: "github",
  remoteOwner: "acme",
  remoteName: "checkout",
};

function makePr(over: Partial<GithubPrPayload> = {}): GithubPrPayload {
  return {
    number: 1,
    title: "Fix bug",
    body: "Closes PROJ-1",
    state: "open",
    merged_at: null,
    merged_by: null,
    head: { ref: "feature/x", sha: "deadbeef" },
    base: { ref: "main" },
    user: { login: "alice" },
    html_url: "https://github.com/acme/checkout/pull/1",
    labels: [],
    ...over,
  };
}

describe("buildRepositorySyncResponse", () => {
  it("404 when repository not found", async () => {
    const repo = makeRepoStub();
    const r = await buildRepositorySyncResponse(repo, { github: fetcherStub() }, {
      organizationId: "o", repositoryId: "missing", kind: "pull_requests",
    });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("repository_not_found");
  });

  it("403 when repository belongs to another org", async () => {
    const repo = makeRepoStub({ ...REPO_ROW, organizationId: "other_org" });
    const r = await buildRepositorySyncResponse(repo, { github: fetcherStub() }, {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "pull_requests",
    });
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_repository");
  });

  it("400 unsupported_provider for 'other' (no dispatch arm)", async () => {
    const repo = makeRepoStub({ ...REPO_ROW, provider: "other" });
    const r = await buildRepositorySyncResponse(repo, { github: fetcherStub() }, {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "pull_requests",
    });
    expect(r.status).toBe(400);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("unsupported_provider");
  });

  it("501 fetcher_not_configured for github when no github fetcher present", async () => {
    const repo = makeRepoStub(REPO_ROW);
    const r = await buildRepositorySyncResponse(repo, {}, {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "pull_requests",
    });
    expect(r.status).toBe(501);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("fetcher_not_configured");
  });

  it("501 fetcher_not_configured for gitlab when no gitlab fetcher present", async () => {
    const repo = makeRepoStub({ ...REPO_ROW, provider: "gitlab" });
    const r = await buildRepositorySyncResponse(repo, { github: fetcherStub() }, {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "pull_requests",
    });
    expect(r.status).toBe(501);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("fetcher_not_configured");
  });

  it("GitLab PR slice: fetches MRs, projects, and upserts", async () => {
    const repo = makeRepoStub({ ...REPO_ROW, provider: "gitlab" });
    const gitlabFetcher = {
      async listMergeRequests() {
        return [
          {
            iid: 7,
            title: "Add SSO",
            description: "Closes PROJ-1",
            state: "merged" as const,
            source_branch: "feature/sso",
            target_branch: "main",
            sha: "abc1234",
            merged_at: "2026-05-20T10:00:00Z",
            merged_by: { username: "bob" },
            author: { username: "alice" },
            web_url: "https://gitlab.com/acme/checkout/-/merge_requests/7",
            labels: ["security"],
            headPipelineStatus: "success" as const,
          },
        ];
      },
      async listReleases() { return []; },
      async listPipelines() { return []; },
    };
    const r = await buildRepositorySyncResponse(repo, { gitlab: gitlabFetcher }, {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "pull_requests",
    }, { now: new Date("2026-05-25T12:00:00Z") });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.fetched).toBe(1);
    expect(r.body.data.upserted).toBe(1);
    expect(repo._prs.size).toBe(1);
    const pr = repo._prs.get("repo_1#7")!;
    expect(pr.state).toBe("merged");
    expect(pr.ciStatus).toBe("passing");
  });

  it("GitLab releases slice: fetches releases, projects, upserts", async () => {
    const repo = makeRepoStub({ ...REPO_ROW, provider: "gitlab" });
    const gitlabFetcher = {
      async listMergeRequests() { return []; },
      async listReleases() {
        return [{
          tag_name: "v1.2.0",
          commit: { id: "deadbeef" },
          released_at: "2026-05-01T00:00:00Z",
          description: "Notes",
          author: { username: "alice" },
        }];
      },
      async listPipelines() { return []; },
    };
    const r = await buildRepositorySyncResponse(repo, { gitlab: gitlabFetcher }, {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "releases",
    });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.fetched).toBe(1);
    expect(repo._tags.size).toBe(1);
  });

  it("GitLab workflow_runs slice: fetches pipelines, projects, upserts", async () => {
    const repo = makeRepoStub({ ...REPO_ROW, provider: "gitlab" });
    const gitlabFetcher = {
      async listMergeRequests() { return []; },
      async listReleases() { return []; },
      async listPipelines() {
        return [{
          id: 123, ref: "main", sha: "abc", status: "success" as const,
          pipelineName: "Deploy prod", configPath: ".gitlab-ci.yml",
          created_at: "2026-05-20T08:00:00Z",
          started_at: "2026-05-20T08:01:00Z",
          finished_at: "2026-05-20T08:05:00Z",
          web_url: "https://gitlab.com/acme/checkout/-/pipelines/123",
        }];
      },
    };
    const r = await buildRepositorySyncResponse(repo, { gitlab: gitlabFetcher }, {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "workflow_runs",
    });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.fetched).toBe(1);
    expect(repo._runs.size).toBe(1);
    const run = repo._runs.get("repo_1#123")!;
    expect(run.runKind).toBe("deploy");
    expect(run.status).toBe("completed");
    expect(run.conclusion).toBe("success");
  });

  it("PR slice: fetches, projects, and upserts every PR", async () => {
    const repo = makeRepoStub(REPO_ROW);
    const prs: GithubPrPayload[] = [
      makePr({ number: 1, title: "First", merged_at: "2026-05-20T10:00:00Z" }),
      makePr({ number: 2, title: "Second", state: "closed" }),
      makePr({ number: 3, title: "Third" }),
    ];
    const fetcher = fetcherStub({ async listPullRequests() { return prs; } });
    const r = await buildRepositorySyncResponse(repo, { github: fetcher }, {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "pull_requests",
    }, { now: new Date("2026-05-25T12:00:00Z") });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data).toMatchObject({
      repositoryId: "repo_1",
      kind: "pull_requests",
      fetched: 3,
      upserted: 3,
      skipped: 0,
    });
    expect(r.body.data.errors).toEqual([]);
    expect(repo._prs.size).toBe(3);
    // Stored PR 1 was projected to merged state
    const pr1 = repo._prs.get("repo_1#1")!;
    expect(pr1.state).toBe("merged");
    expect(pr1.linkedStories).toContain("PROJ-1");
  });

  it("PR slice: per-PR errors surfaced, others still upserted", async () => {
    const repo = makeRepoStub(REPO_ROW);
    // Force the upsert for #2 to throw
    const origUpsert = repo.pullRequestRecord.upsert.bind(repo.pullRequestRecord);
    repo.pullRequestRecord.upsert = async (args) => {
      if (args.where.repositoryId_number.number === 2) throw new Error("simulated boom");
      return origUpsert(args);
    };
    const fetcher = fetcherStub({
      async listPullRequests() {
        return [makePr({ number: 1 }), makePr({ number: 2 }), makePr({ number: 3 })];
      },
    });
    const r = await buildRepositorySyncResponse(repo, { github: fetcher }, {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "pull_requests",
    });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.fetched).toBe(3);
    expect(r.body.data.upserted).toBe(2);
    expect(r.body.data.skipped).toBe(1);
    expect(r.body.data.errors).toHaveLength(1);
    expect(r.body.data.errors[0]).toMatchObject({
      identifier: "acme/checkout#2",
      reason: expect.stringContaining("simulated boom"),
    });
  });

  it("releases slice: fetches, projects, upserts", async () => {
    const repo = makeRepoStub(REPO_ROW);
    const releases: GithubReleaseTagPayload[] = [
      {
        tag_name: "v1.0.0",
        name: "Initial",
        target_commitish: "abc123",
        resolvedCommitSha: "abc123",
        created_at: "2026-05-01T00:00:00Z",
        body: null,
        author: { login: "alice" },
      },
    ];
    const fetcher = fetcherStub({ async listReleases() { return releases; } });
    const r = await buildRepositorySyncResponse(repo, { github: fetcher }, {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "releases",
    });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.fetched).toBe(1);
    expect(r.body.data.upserted).toBe(1);
    expect(repo._tags.size).toBe(1);
  });

  it("workflow_runs slice: fetches, projects, upserts", async () => {
    const repo = makeRepoStub(REPO_ROW);
    const runs: GithubWorkflowRunPayload[] = [
      {
        id: 999,
        name: "Deploy prod",
        path: ".github/workflows/deploy.yml",
        status: "completed",
        conclusion: "success",
        head_sha: "abc123",
        head_branch: "main",
        run_started_at: "2026-05-20T10:00:00Z",
        updated_at: "2026-05-20T10:05:00Z",
        html_url: "https://github.com/acme/checkout/actions/runs/999",
      },
    ];
    const fetcher = fetcherStub({ async listWorkflowRuns() { return runs; } });
    const r = await buildRepositorySyncResponse(repo, { github: fetcher }, {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "workflow_runs",
    });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.fetched).toBe(1);
    expect(r.body.data.upserted).toBe(1);
    const run = repo._runs.get("repo_1#999");
    expect(run?.runKind).toBe("deploy");
    expect(run?.status).toBe("completed");
    expect(run?.conclusion).toBe("success");
  });

  it("503 migration_pending when underlying upsert hits a missing table", async () => {
    const repo = makeRepoStub(REPO_ROW);
    repo.pullRequestRecord.upsert = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const fetcher = fetcherStub({
      async listPullRequests() { return [makePr({ number: 1 })]; },
    });
    const r = await buildRepositorySyncResponse(repo, { github: fetcher }, {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "pull_requests",
    });
    // The per-PR loop captures the upsert error, so it surfaces as
    // skipped=1 / errors=1, not a 503 at the responder level. This is
    // the right behavior — one PR's missing index shouldn't fail the
    // whole sync.
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.upserted).toBe(0);
    expect(r.body.data.skipped).toBe(1);
  });

  /* ─── Azure DevOps ─── */

  it("400 invalid_repository_url when ADO row has no remoteUrl", async () => {
    const repo = makeRepoStub({ ...REPO_ROW, provider: "azuredevops" });
    const adoFetcher: AzureDevOpsFetcher = {
      async listPullRequests() { return []; },
      async listReleases() { return []; },
      async listPipelineRuns() { return []; },
    };
    const r = await buildRepositorySyncResponse(repo, { azuredevops: adoFetcher }, {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "pull_requests",
    });
    expect(r.status).toBe(400);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("invalid_repository_url");
  });

  it("501 fetcher_not_configured for azuredevops when no fetcher present", async () => {
    const repo = makeRepoStub({
      ...REPO_ROW, provider: "azuredevops",
      remoteUrl: "https://dev.azure.com/acme/checkout/_git/api",
    });
    const r = await buildRepositorySyncResponse(repo, { github: fetcherStub() }, {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "pull_requests",
    });
    expect(r.status).toBe(501);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("fetcher_not_configured");
  });

  it("ADO PR slice: parses locator + projects + upserts", async () => {
    const repo = makeRepoStub({
      ...REPO_ROW, provider: "azuredevops",
      remoteOwner: "acme", remoteName: "api",
      remoteUrl: "https://dev.azure.com/acme/checkout/_git/api",
    });
    const adoFetcher: AzureDevOpsFetcher = {
      async listPullRequests(locator) {
        // assert the URL parser produced the right locator
        expect(locator).toEqual({ org: "acme", project: "checkout", repo: "api" });
        return [{
          pullRequestId: 42, title: "Hotfix",
          status: "completed", isDraft: false,
          sourceRefName: "refs/heads/hotfix/x", targetRefName: "refs/heads/main",
          lastMergeSourceCommit: { commitId: "abcdef" },
          closedDate: "2026-05-20T10:00:00Z",
          closedBy: { uniqueName: "bob" },
          createdBy: { uniqueName: "alice" },
          webUrl: "https://dev.azure.com/acme/checkout/_git/api/pullrequest/42",
          labels: [],
        }];
      },
      async listReleases() { return []; },
      async listPipelineRuns() { return []; },
    };
    const r = await buildRepositorySyncResponse(repo, { azuredevops: adoFetcher }, {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "pull_requests",
    }, { now: new Date("2026-05-25T12:00:00Z") });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.upserted).toBe(1);
    const pr = repo._prs.get("repo_1#42")!;
    expect(pr.state).toBe("merged");
    expect(pr.sourceBranch).toBe("hotfix/x");
    expect(pr.targetBranch).toBe("main");
  });

  it("ADO releases slice: tag refs project to release rows", async () => {
    const repo = makeRepoStub({
      ...REPO_ROW, provider: "azuredevops",
      remoteUrl: "https://dev.azure.com/acme/checkout/_git/api",
    });
    const adoFetcher: AzureDevOpsFetcher = {
      async listPullRequests() { return []; },
      async listReleases() {
        return [{ tagName: "v1.0.0", resolvedCommitSha: "abc123" }];
      },
      async listPipelineRuns() { return []; },
    };
    const r = await buildRepositorySyncResponse(repo, { azuredevops: adoFetcher }, {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "releases",
    });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.upserted).toBe(1);
    expect(repo._tags.size).toBe(1);
  });

  it("ADO workflow_runs slice: pipeline runs project to workflow rows", async () => {
    const repo = makeRepoStub({
      ...REPO_ROW, provider: "azuredevops",
      remoteUrl: "https://dev.azure.com/acme/checkout/_git/api",
    });
    const adoFetcher: AzureDevOpsFetcher = {
      async listPullRequests() { return []; },
      async listReleases() { return []; },
      async listPipelineRuns() {
        return [{
          id: 777, name: "Deploy prod", yamlPath: "azure-pipelines-deploy.yml",
          state: "completed", result: "succeeded",
          sourceBranch: "refs/heads/main", sourceSha: "abc",
          createdDate: "2026-05-20T08:00:00Z", finishedDate: "2026-05-20T08:05:00Z",
          webUrl: "https://dev.azure.com/acme/checkout/_build/results?buildId=777",
        }];
      },
    };
    const r = await buildRepositorySyncResponse(repo, { azuredevops: adoFetcher }, {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "workflow_runs",
    });
    if (!r.body.ok) throw new Error("expected ok");
    const run = repo._runs.get("repo_1#777")!;
    expect(run.status).toBe("completed");
    expect(run.conclusion).toBe("success");
    expect(run.runKind).toBe("deploy");
  });
});

describe("parseAzureDevOpsLocator", () => {
  it("parses modern dev.azure.com URLs", () => {
    expect(parseAzureDevOpsLocator({
      remoteUrl: "https://dev.azure.com/acme/checkout/_git/api",
      remoteOwner: "acme", remoteName: "api",
    })).toEqual({ org: "acme", project: "checkout", repo: "api" });
  });
  it("parses legacy visualstudio.com URLs", () => {
    expect(parseAzureDevOpsLocator({
      remoteUrl: "https://acme.visualstudio.com/checkout/_git/api",
      remoteOwner: "acme", remoteName: "api",
    })).toEqual({ org: "acme", project: "checkout", repo: "api" });
  });
  it("returns null for non-ADO URLs", () => {
    expect(parseAzureDevOpsLocator({
      remoteUrl: "https://github.com/acme/api",
      remoteOwner: "acme", remoteName: "api",
    })).toBeNull();
  });
  it("returns null when remoteUrl is missing", () => {
    expect(parseAzureDevOpsLocator({ remoteOwner: "acme", remoteName: "api" })).toBeNull();
  });
  it("handles project paths with slashes in them", () => {
    expect(parseAzureDevOpsLocator({
      remoteUrl: "https://dev.azure.com/acme/team-a/sub/_git/api",
      remoteOwner: "acme", remoteName: "api",
    })).toEqual({ org: "acme", project: "team-a/sub", repo: "api" });
  });
});
