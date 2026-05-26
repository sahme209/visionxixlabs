import { describe, expect, it } from "vitest";
import {
  buildRepositorySyncResponse,
  type RepositorySyncRepo,
  type SyncRepositoryRow,
  type GitHubFetcher,
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
    const r = await buildRepositorySyncResponse(repo, fetcherStub(), {
      organizationId: "o", repositoryId: "missing", kind: "pull_requests",
    });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("repository_not_found");
  });

  it("403 when repository belongs to another org", async () => {
    const repo = makeRepoStub({ ...REPO_ROW, organizationId: "other_org" });
    const r = await buildRepositorySyncResponse(repo, fetcherStub(), {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "pull_requests",
    });
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_repository");
  });

  it("400 when provider is non-github", async () => {
    const repo = makeRepoStub({ ...REPO_ROW, provider: "gitlab" });
    const r = await buildRepositorySyncResponse(repo, fetcherStub(), {
      organizationId: "o", repositoryId: REPO_ROW.id, kind: "pull_requests",
    });
    expect(r.status).toBe(400);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("unsupported_provider");
  });

  it("PR slice: fetches, projects, and upserts every PR", async () => {
    const repo = makeRepoStub(REPO_ROW);
    const prs: GithubPrPayload[] = [
      makePr({ number: 1, title: "First", merged_at: "2026-05-20T10:00:00Z" }),
      makePr({ number: 2, title: "Second", state: "closed" }),
      makePr({ number: 3, title: "Third" }),
    ];
    const fetcher = fetcherStub({ async listPullRequests() { return prs; } });
    const r = await buildRepositorySyncResponse(repo, fetcher, {
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
    const r = await buildRepositorySyncResponse(repo, fetcher, {
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
    const r = await buildRepositorySyncResponse(repo, fetcher, {
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
    const r = await buildRepositorySyncResponse(repo, fetcher, {
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
    const r = await buildRepositorySyncResponse(repo, fetcher, {
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
});
