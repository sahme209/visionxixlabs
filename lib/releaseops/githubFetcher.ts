/**
 * Phase 467 — minimal GitHub REST fetcher.
 *
 * Implements the GitHubFetcher contract that repositorySyncResponder
 * accepts. Uses fetch() against api.github.com with bearer-token auth
 * (Vercel GITHUB_PAT env var by default). The fetcher is intentionally
 * thin — no retry, no rate-limit awareness, no pagination beyond
 * one page. Future phases layer on resilience.
 */

import type {
  GithubPrPayload,
  GithubReleaseTagPayload,
  GithubWorkflowRunPayload,
} from "./providers/githubProjectors";
import type { GitHubFetcher } from "./repositorySyncResponder";

const GITHUB_API = "https://api.github.com";

export interface CreateGitHubFetcherOptions {
  /** Personal access token. Falls back to process.env.GITHUB_PAT at call time. */
  token?: string;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
}

export function createGitHubFetcher(opts: CreateGitHubFetcherOptions = {}): GitHubFetcher {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  async function ghGet<T>(path: string): Promise<T> {
    const token = opts.token ?? process.env.GITHUB_PAT;
    if (!token) throw new Error("GITHUB_PAT not configured");
    const r = await fetchImpl(`${GITHUB_API}${path}`, {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`GitHub ${r.status} ${path}: ${text.slice(0, 200)}`);
    }
    return (await r.json()) as T;
  }

  return {
    async listPullRequests(repo, listOpts) {
      const perPage = listOpts.perPage ?? 100;
      const state = listOpts.state ?? "all";
      const items = await ghGet<RawPrRow[]>(
        `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/pulls?state=${state}&per_page=${perPage}&sort=updated&direction=desc`,
      );
      return items.map(mapRawPr);
    },
    async listReleases(repo, listOpts) {
      const perPage = listOpts.perPage ?? 100;
      const items = await ghGet<RawReleaseRow[]>(
        `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/releases?per_page=${perPage}`,
      );
      return items.map(mapRawRelease);
    },
    async listWorkflowRuns(repo, listOpts) {
      const perPage = listOpts.perPage ?? 100;
      const resp = await ghGet<{ workflow_runs: RawWorkflowRunRow[] }>(
        `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/actions/runs?per_page=${perPage}`,
      );
      return resp.workflow_runs.map(mapRawWorkflowRun);
    },
  };
}

/* ──────────────────────────────────────────────────────────────────
   Raw row shapes — narrow projections of the GitHub REST responses.
   ────────────────────────────────────────────────────────────── */

interface RawPrRow {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  merged_at: string | null;
  merged_by: { login: string } | null;
  head: { ref: string; sha: string };
  base: { ref: string };
  user: { login: string };
  html_url: string;
  labels?: ReadonlyArray<{ name: string }>;
}

function mapRawPr(r: RawPrRow): GithubPrPayload {
  return {
    number: r.number,
    title: r.title,
    body: r.body,
    state: r.state,
    merged_at: r.merged_at,
    merged_by: r.merged_by,
    head: r.head,
    base: r.base,
    user: r.user,
    html_url: r.html_url,
    labels: r.labels ?? [],
    // ciCombinedState + approval counts + codeowners require extra
    // API calls (combined-status, reviews, codeowners) — wire those
    // in a follow-on phase. Projector falls back to safe defaults.
  };
}

interface RawReleaseRow {
  tag_name: string;
  name: string | null;
  target_commitish: string;
  created_at: string;
  body: string | null;
  author: { login: string } | null;
}

function mapRawRelease(r: RawReleaseRow): GithubReleaseTagPayload {
  return {
    tag_name: r.tag_name,
    name: r.name,
    target_commitish: r.target_commitish,
    // Without a /git/refs/tags lookup we use target_commitish as a
    // best-effort SHA. For lightweight tags pointing directly at a
    // commit this is correct; for annotated tags this is a branch
    // name and we'd need a second hop. Acceptable for the first
    // sync slice.
    resolvedCommitSha: r.target_commitish,
    created_at: r.created_at,
    body: r.body,
    author: r.author,
  };
}

interface RawWorkflowRunRow {
  id: number;
  name: string | null;
  path: string;
  status: GithubWorkflowRunPayload["status"];
  conclusion: GithubWorkflowRunPayload["conclusion"];
  head_sha: string;
  head_branch: string | null;
  display_title?: string;
  run_started_at: string | null;
  updated_at: string | null;
  html_url: string;
}

function mapRawWorkflowRun(r: RawWorkflowRunRow): GithubWorkflowRunPayload {
  return {
    id: r.id,
    name: r.name,
    path: r.path,
    status: r.status,
    conclusion: r.conclusion,
    head_sha: r.head_sha,
    head_branch: r.head_branch,
    display_title: r.display_title,
    run_started_at: r.run_started_at,
    updated_at: r.updated_at,
    html_url: r.html_url,
  };
}
