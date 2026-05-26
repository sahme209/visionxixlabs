/**
 * Phase 467 — repository sync orchestrator.
 *
 * Fetches a slice of GitHub data for a single repository, projects it
 * through the Phase 452 projectors, and upserts via the Phase 451
 * gitDiscoveryRepo. The DI design lets tests pass an in-memory fetcher
 * + repo stub so the orchestrator is verifiable without a live GitHub
 * token.
 *
 * The first slice covers `pull_requests`. `releases` and
 * `workflow_runs` are sketched at the same shape but no-op until their
 * fetcher implementations land — this keeps the API contract stable
 * while we ship incrementally.
 */

import {
  projectGithubPr,
  projectGithubReleaseTag,
  projectGithubWorkflowRun,
  type GithubPrPayload,
  type GithubReleaseTagPayload,
  type GithubWorkflowRunPayload,
} from "./providers/githubProjectors";
import {
  projectGitlabMergeRequest,
  projectGitlabReleaseTag,
  projectGitlabPipeline,
  type GitlabMergeRequestPayload,
  type GitlabReleaseTagPayload,
  type GitlabPipelinePayload,
} from "./providers/gitlabProjectors";
import {
  upsertPullRequestRecord,
  upsertReleaseTagRecord,
  upsertWorkflowRunRecord,
  type GitDiscoveryRepo,
} from "./gitDiscoveryRepo";
import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Closed-union slice kind.
   ────────────────────────────────────────────────────────────── */

export const ALL_SYNC_KINDS = ["pull_requests", "releases", "workflow_runs"] as const;
export type SyncKind = (typeof ALL_SYNC_KINDS)[number];

/* ──────────────────────────────────────────────────────────────────
   Repository row + fetcher contracts.
   ────────────────────────────────────────────────────────────── */

export interface SyncRepositoryRow {
  id: string;
  organizationId: string;
  provider: string;
  remoteOwner: string;
  remoteName: string;
}

export interface RepositorySyncRepo extends GitDiscoveryRepo {
  repository: {
    findUnique(args: { where: { id: string } }): Promise<SyncRepositoryRow | null>;
  };
}

export interface GitHubFetcher {
  listPullRequests(
    repo: { owner: string; name: string },
    opts: { perPage?: number; state?: "open" | "closed" | "all" },
  ): Promise<GithubPrPayload[]>;
  listReleases(
    repo: { owner: string; name: string },
    opts: { perPage?: number },
  ): Promise<GithubReleaseTagPayload[]>;
  listWorkflowRuns(
    repo: { owner: string; name: string },
    opts: { perPage?: number },
  ): Promise<GithubWorkflowRunPayload[]>;
}

export interface GitLabFetcher {
  listMergeRequests(
    repo: { owner: string; name: string },
    opts: { perPage?: number; state?: "opened" | "closed" | "merged" | "all" },
  ): Promise<GitlabMergeRequestPayload[]>;
  listReleases(
    repo: { owner: string; name: string },
    opts: { perPage?: number },
  ): Promise<GitlabReleaseTagPayload[]>;
  listPipelines(
    repo: { owner: string; name: string },
    opts: { perPage?: number },
  ): Promise<GitlabPipelinePayload[]>;
}

export interface ProviderFetchers {
  github?: GitHubFetcher;
  gitlab?: GitLabFetcher;
}

/* ──────────────────────────────────────────────────────────────────
   Input + output.
   ────────────────────────────────────────────────────────────── */

export interface BuildRepositorySyncInput {
  organizationId: string;
  repositoryId: string;
  kind: SyncKind;
  /** Cap on fetched items. Defaults to 100. */
  perPage?: number;
}

export type RepositorySyncBody =
  | {
      ok: true;
      data: {
        repositoryId: string;
        kind: SyncKind;
        fetched: number;
        upserted: number;
        skipped: number;
        errors: ReadonlyArray<{ identifier: string; reason: string }>;
        completedAtIso: string;
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: RepositorySyncBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildRepositorySyncResponse(
  repo: RepositorySyncRepo,
  fetchers: ProviderFetchers,
  input: BuildRepositorySyncInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const repoRow = await repo.repository.findUnique({ where: { id: input.repositoryId } });
    if (!repoRow) {
      return { status: 404, body: { ok: false, error: "repository_not_found" } };
    }
    if (repoRow.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_repository" } };
    }

    if (repoRow.provider === "github") {
      if (!fetchers.github) {
        return { status: 501, body: { ok: false, error: "fetcher_not_configured", hint: "GitHub fetcher missing — check GITHUB_PAT env." } };
      }
      switch (input.kind) {
        case "pull_requests":
          return await syncPullRequestsGithub(repo, fetchers.github, repoRow, input, opts);
        case "releases":
          return await syncReleasesGithub(repo, fetchers.github, repoRow, input, opts);
        case "workflow_runs":
          return await syncWorkflowRunsGithub(repo, fetchers.github, repoRow, input, opts);
      }
    }
    if (repoRow.provider === "gitlab") {
      if (!fetchers.gitlab) {
        return { status: 501, body: { ok: false, error: "fetcher_not_configured", hint: "GitLab fetcher missing — check GITLAB_TOKEN env." } };
      }
      switch (input.kind) {
        case "pull_requests":
          return await syncPullRequestsGitlab(repo, fetchers.gitlab, repoRow, input, opts);
        case "releases":
          return await syncReleasesGitlab(repo, fetchers.gitlab, repoRow, input, opts);
        case "workflow_runs":
          return await syncWorkflowRunsGitlab(repo, fetchers.gitlab, repoRow, input, opts);
      }
    }
    return {
      status: 400,
      body: { ok: false, error: "unsupported_provider", hint: `Sync supports github and gitlab; this repository is ${repoRow.provider}.` },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Phase 466 migration not yet applied." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Per-slice implementations.
   ────────────────────────────────────────────────────────────── */

async function syncPullRequestsGithub(
  repo: RepositorySyncRepo,
  fetcher: GitHubFetcher,
  repoRow: SyncRepositoryRow,
  input: BuildRepositorySyncInput,
  opts: { now?: Date },
): Promise<ResponderResult> {
  const prs = await fetcher.listPullRequests(
    { owner: repoRow.remoteOwner, name: repoRow.remoteName },
    { perPage: input.perPage ?? 100, state: "all" },
  );
  return await projectAndUpsert(
    prs,
    (p) => `${repoRow.remoteOwner}/${repoRow.remoteName}#${p.number}`,
    (p) => projectGithubPr(p, { organizationId: input.organizationId, repositoryId: repoRow.id }),
    (upsert) => upsertPullRequestRecord(repo, { ...upsert, observedAt: opts.now }),
    { repositoryId: repoRow.id, kind: "pull_requests", now: opts.now ?? new Date() },
  );
}

async function syncReleasesGithub(
  repo: RepositorySyncRepo,
  fetcher: GitHubFetcher,
  repoRow: SyncRepositoryRow,
  input: BuildRepositorySyncInput,
  opts: { now?: Date },
): Promise<ResponderResult> {
  const releases = await fetcher.listReleases(
    { owner: repoRow.remoteOwner, name: repoRow.remoteName },
    { perPage: input.perPage ?? 100 },
  );
  return await projectAndUpsert(
    releases,
    (r) => `${repoRow.remoteOwner}/${repoRow.remoteName}@${r.tag_name}`,
    (r) => projectGithubReleaseTag(r, { organizationId: input.organizationId, repositoryId: repoRow.id }),
    (upsert) => upsertReleaseTagRecord(repo, { ...upsert, observedAt: opts.now }),
    { repositoryId: repoRow.id, kind: "releases", now: opts.now ?? new Date() },
  );
}

async function syncWorkflowRunsGithub(
  repo: RepositorySyncRepo,
  fetcher: GitHubFetcher,
  repoRow: SyncRepositoryRow,
  input: BuildRepositorySyncInput,
  opts: { now?: Date },
): Promise<ResponderResult> {
  const runs = await fetcher.listWorkflowRuns(
    { owner: repoRow.remoteOwner, name: repoRow.remoteName },
    { perPage: input.perPage ?? 100 },
  );
  return await projectAndUpsert(
    runs,
    (r) => `${repoRow.remoteOwner}/${repoRow.remoteName}:run:${r.id}`,
    (r) => projectGithubWorkflowRun(r, { organizationId: input.organizationId, repositoryId: repoRow.id }),
    (upsert) => upsertWorkflowRunRecord(repo, { ...upsert, observedAt: opts.now }),
    { repositoryId: repoRow.id, kind: "workflow_runs", now: opts.now ?? new Date() },
  );
}

/* ──────────────────────────────────────────────────────────────────
   GitLab slices.
   ────────────────────────────────────────────────────────────── */

async function syncPullRequestsGitlab(
  repo: RepositorySyncRepo,
  fetcher: GitLabFetcher,
  repoRow: SyncRepositoryRow,
  input: BuildRepositorySyncInput,
  opts: { now?: Date },
): Promise<ResponderResult> {
  const mrs = await fetcher.listMergeRequests(
    { owner: repoRow.remoteOwner, name: repoRow.remoteName },
    { perPage: input.perPage ?? 100, state: "all" },
  );
  return await projectAndUpsert(
    mrs,
    (m) => `${repoRow.remoteOwner}/${repoRow.remoteName}!${m.iid}`,
    (m) => projectGitlabMergeRequest(m, { organizationId: input.organizationId, repositoryId: repoRow.id }),
    (upsert) => upsertPullRequestRecord(repo, { ...upsert, observedAt: opts.now }),
    { repositoryId: repoRow.id, kind: "pull_requests", now: opts.now ?? new Date() },
  );
}

async function syncReleasesGitlab(
  repo: RepositorySyncRepo,
  fetcher: GitLabFetcher,
  repoRow: SyncRepositoryRow,
  input: BuildRepositorySyncInput,
  opts: { now?: Date },
): Promise<ResponderResult> {
  const releases = await fetcher.listReleases(
    { owner: repoRow.remoteOwner, name: repoRow.remoteName },
    { perPage: input.perPage ?? 100 },
  );
  return await projectAndUpsert(
    releases,
    (r) => `${repoRow.remoteOwner}/${repoRow.remoteName}@${r.tag_name}`,
    (r) => projectGitlabReleaseTag(r, { organizationId: input.organizationId, repositoryId: repoRow.id }),
    (upsert) => upsertReleaseTagRecord(repo, { ...upsert, observedAt: opts.now }),
    { repositoryId: repoRow.id, kind: "releases", now: opts.now ?? new Date() },
  );
}

async function syncWorkflowRunsGitlab(
  repo: RepositorySyncRepo,
  fetcher: GitLabFetcher,
  repoRow: SyncRepositoryRow,
  input: BuildRepositorySyncInput,
  opts: { now?: Date },
): Promise<ResponderResult> {
  const pipelines = await fetcher.listPipelines(
    { owner: repoRow.remoteOwner, name: repoRow.remoteName },
    { perPage: input.perPage ?? 100 },
  );
  return await projectAndUpsert(
    pipelines,
    (p) => `${repoRow.remoteOwner}/${repoRow.remoteName}:pipeline:${p.id}`,
    (p) => projectGitlabPipeline(p, { organizationId: input.organizationId, repositoryId: repoRow.id }),
    (upsert) => upsertWorkflowRunRecord(repo, { ...upsert, observedAt: opts.now }),
    { repositoryId: repoRow.id, kind: "workflow_runs", now: opts.now ?? new Date() },
  );
}

/* ──────────────────────────────────────────────────────────────────
   Project-and-upsert loop, with per-item error capture.
   ────────────────────────────────────────────────────────────── */

async function projectAndUpsert<Raw, Upsert>(
  raws: ReadonlyArray<Raw>,
  identifierOf: (r: Raw) => string,
  projector: (r: Raw) => Upsert,
  upserter: (u: Upsert) => Promise<unknown>,
  ctx: { repositoryId: string; kind: SyncKind; now: Date },
): Promise<ResponderResult> {
  let upserted = 0;
  let skipped = 0;
  const errors: Array<{ identifier: string; reason: string }> = [];

  for (const raw of raws) {
    const ident = identifierOf(raw);
    try {
      const upsert = projector(raw);
      await upserter(upsert);
      upserted += 1;
    } catch (e) {
      errors.push({ identifier: ident, reason: e instanceof Error ? e.message : String(e) });
      skipped += 1;
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      data: {
        repositoryId: ctx.repositoryId,
        kind: ctx.kind,
        fetched: raws.length,
        upserted,
        skipped,
        errors,
        completedAtIso: ctx.now.toISOString(),
      },
    },
  };
}
