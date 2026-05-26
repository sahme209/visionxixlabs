/**
 * Phase 473 — minimal GitLab REST fetcher.
 *
 * Single-page pull against gitlab.com (or self-hosted via GITLAB_BASE_URL).
 * Project paths are URL-encoded as "owner/name" → "owner%2Fname".
 * Authenticates via the PRIVATE-TOKEN header.
 */

import type {
  GitlabMergeRequestPayload,
  GitlabReleaseTagPayload,
  GitlabPipelinePayload,
} from "./providers/gitlabProjectors";
import type { GitLabFetcher } from "./repositorySyncResponder";

export interface CreateGitLabFetcherOptions {
  /** Personal/group access token. Falls back to process.env.GITLAB_TOKEN. */
  token?: string;
  /** Base URL (no trailing slash). Defaults to https://gitlab.com or
   *  process.env.GITLAB_BASE_URL for self-hosted instances. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function createGitLabFetcher(opts: CreateGitLabFetcherOptions = {}): GitLabFetcher {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  async function glGet<T>(projectPath: string): Promise<T> {
    const token = opts.token ?? process.env.GITLAB_TOKEN;
    if (!token) throw new Error("GITLAB_TOKEN not configured");
    const base = (opts.baseUrl ?? process.env.GITLAB_BASE_URL ?? "https://gitlab.com").replace(/\/$/, "");
    const r = await fetchImpl(`${base}${projectPath}`, {
      headers: {
        "Accept": "application/json",
        "PRIVATE-TOKEN": token,
      },
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`GitLab ${r.status} ${projectPath}: ${text.slice(0, 200)}`);
    }
    return (await r.json()) as T;
  }

  function projectId(repo: { owner: string; name: string }): string {
    // GitLab accepts URL-encoded "owner/name" as the project id.
    return encodeURIComponent(`${repo.owner}/${repo.name}`);
  }

  return {
    async listMergeRequests(repo, listOpts) {
      const perPage = listOpts.perPage ?? 100;
      const state = listOpts.state ?? "all";
      const items = await glGet<RawMrRow[]>(
        `/api/v4/projects/${projectId(repo)}/merge_requests?state=${state}&per_page=${perPage}&order_by=updated_at&sort=desc`,
      );
      return items.map(mapRawMr);
    },
    async listReleases(repo, listOpts) {
      const perPage = listOpts.perPage ?? 100;
      const items = await glGet<RawReleaseRow[]>(
        `/api/v4/projects/${projectId(repo)}/releases?per_page=${perPage}`,
      );
      return items.map(mapRawRelease);
    },
    async listPipelines(repo, listOpts) {
      const perPage = listOpts.perPage ?? 100;
      const items = await glGet<RawPipelineRow[]>(
        `/api/v4/projects/${projectId(repo)}/pipelines?per_page=${perPage}&order_by=updated_at&sort=desc`,
      );
      return items.map(mapRawPipeline);
    },
  };
}

/* ──────────────────────────────────────────────────────────────────
   Raw row shapes — narrow projections of the GitLab REST responses.
   ────────────────────────────────────────────────────────────── */

interface RawMrRow {
  iid: number;
  title: string;
  description: string | null;
  state: "opened" | "closed" | "merged" | "locked";
  source_branch: string;
  target_branch: string;
  sha: string;
  merged_at: string | null;
  merged_by: { username: string } | null;
  author: { username: string };
  web_url: string;
  labels?: ReadonlyArray<string>;
  head_pipeline?: { status: GitlabMergeRequestPayload["headPipelineStatus"] } | null;
}

function mapRawMr(r: RawMrRow): GitlabMergeRequestPayload {
  return {
    iid: r.iid,
    title: r.title,
    description: r.description,
    state: r.state,
    source_branch: r.source_branch,
    target_branch: r.target_branch,
    sha: r.sha,
    merged_at: r.merged_at,
    merged_by: r.merged_by,
    author: r.author,
    web_url: r.web_url,
    labels: r.labels ?? [],
    headPipelineStatus: r.head_pipeline?.status ?? null,
    // approvalsRequiredCount / approvalsObservedCount / codeownersApproved
    // need /approvals or /approval_rules round-trips — left as defaults
    // for now (the projector falls back gracefully).
  };
}

interface RawReleaseRow {
  tag_name: string;
  commit?: { id: string };
  released_at: string | null;
  created_at?: string;
  description: string | null;
  author?: { username: string } | null;
}

function mapRawRelease(r: RawReleaseRow): GitlabReleaseTagPayload {
  return {
    tag_name: r.tag_name,
    // Without /repository/tags/<tag_name> we may not have a commit SHA;
    // in practice GitLab's release object includes commit.id. Default
    // to empty string so the projector still upserts (the row carries
    // the tag name as the primary identifier).
    commit: { id: r.commit?.id ?? "" },
    released_at: r.released_at,
    ...(r.created_at !== undefined ? { created_at: r.created_at } : {}),
    description: r.description,
    author: r.author ?? null,
  };
}

interface RawPipelineRow {
  id: number;
  ref: string | null;
  sha: string;
  status: GitlabPipelinePayload["status"];
  name?: string;
  source?: string;
  created_at: string | null;
  started_at: string | null;
  updated_at: string | null;
  finished_at?: string | null;
  web_url: string;
}

function mapRawPipeline(r: RawPipelineRow): GitlabPipelinePayload {
  return {
    id: r.id,
    ref: r.ref,
    sha: r.sha,
    status: r.status,
    ...(r.name !== undefined ? { pipelineName: r.name } : {}),
    ...(r.created_at !== null ? { created_at: r.created_at } : {}),
    started_at: r.started_at,
    finished_at: r.finished_at ?? null,
    web_url: r.web_url,
  };
}
