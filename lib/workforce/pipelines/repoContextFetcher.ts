/**
 * GitHub REST repo context fetcher — Phase 387.
 *
 * Pulls the minimum information the AI coding loop needs to write
 * useful code:
 *   1. The branch's HEAD commit + default branch (repo metadata).
 *   2. A bounded file tree (recursive, capped at 200 entries).
 *   3. The N most recent commits on the branch.
 *   4. A heuristic-selected set of "key files" (README, package.json,
 *      tsconfig.json, top-level src/index.* — bounded content).
 *
 * Uses raw fetch + the GitHub REST API. No SDK to keep the surface
 * minimal. Authenticates with GITHUB_TOKEN when present — public
 * repos work without it (unauthenticated rate limit is 60 req/h
 * per IP, plenty for a single coding task).
 *
 * Every error path returns a result with ok=false + a reason so the
 * caller (the code_read executor) can fall back to a dry-run with
 * the operator told why. Network errors never throw out of this
 * module.
 */

import "server-only";

import type { RepoSnapshot, RepoTreeEntry, RepoCommit, RepoFileContent } from "./summarizeRepoContext";
import { parseRepoRef } from "./parseRepoRef";

const GH_API = "https://api.github.com";
const MAX_TREE_ENTRIES = 200;
const MAX_KEY_FILE_BYTES = 12_000;
const MAX_RECENT_COMMITS = 10;
const FETCH_TIMEOUT_MS = 12_000;

/** Files we always try to grab when present (highest signal per byte). */
const KEY_FILE_CANDIDATES: ReadonlyArray<string> = [
  "README.md",
  "README",
  "package.json",
  "tsconfig.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "CONTRIBUTING.md",
];

export type FetchRepoContextResult =
  | { ok: true; snapshot: RepoSnapshot }
  | { ok: false; reason: FetchRepoContextFailReason; detail: string };

export type FetchRepoContextFailReason =
  | "invalid_repo_ref"
  | "repo_not_found"
  | "forbidden"            // private repo + no token, or rate-limited
  | "network_error"
  | "branch_not_found"
  | "unexpected_response";

interface GhHeaders {
  Accept: string;
  "User-Agent": string;
  Authorization?: string;
  "X-GitHub-Api-Version": string;
}

function buildHeaders(): GhHeaders {
  const headers: GhHeaders = {
    Accept: "application/vnd.github+json",
    "User-Agent": "visionxixlabs-ai-coding-loop",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function ghFetch(path: string): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${GH_API}${path}`, {
      headers: buildHeaders() as unknown as Record<string, string>,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

export async function fetchRepoContext(
  repoRef: string,
  branchHint: string | null,
): Promise<FetchRepoContextResult> {
  const coords = parseRepoRef(repoRef);
  if (!coords) {
    return { ok: false, reason: "invalid_repo_ref", detail: `Could not parse repoRef "${repoRef}".` };
  }
  const { owner, repo } = coords;

  // 1. Repo metadata (gives us the default branch).
  let defaultBranch: string;
  try {
    const r = await ghFetch(`/repos/${owner}/${repo}`);
    if (r.status === 404) return { ok: false, reason: "repo_not_found", detail: `${owner}/${repo} not found or private without token.` };
    if (r.status === 403 || r.status === 401) return { ok: false, reason: "forbidden", detail: "Auth/rate-limit — set GITHUB_TOKEN or wait." };
    if (!r.ok) return { ok: false, reason: "unexpected_response", detail: `repo GET ${r.status}` };
    const body = await r.json() as { default_branch?: string };
    defaultBranch = typeof body.default_branch === "string" ? body.default_branch : "main";
  } catch {
    return { ok: false, reason: "network_error", detail: "Could not reach api.github.com." };
  }

  const branch = branchHint && branchHint.trim().length > 0 ? branchHint.trim() : defaultBranch;

  // 2. Branch HEAD commit.
  let headSha: string | null = null;
  try {
    const r = await ghFetch(`/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`);
    if (r.status === 404) return { ok: false, reason: "branch_not_found", detail: `Branch ${branch} not found.` };
    if (!r.ok) return { ok: false, reason: "unexpected_response", detail: `branch GET ${r.status}` };
    const body = await r.json() as { commit?: { sha?: string } };
    headSha = body.commit?.sha ?? null;
  } catch {
    return { ok: false, reason: "network_error", detail: "Could not fetch branch HEAD." };
  }

  if (!headSha) return { ok: false, reason: "unexpected_response", detail: "Branch HEAD had no sha." };

  // 3. Recursive tree.
  const tree: RepoTreeEntry[] = [];
  let treeTruncated = false;
  try {
    const r = await ghFetch(`/repos/${owner}/${repo}/git/trees/${headSha}?recursive=1`);
    if (!r.ok) return { ok: false, reason: "unexpected_response", detail: `tree GET ${r.status}` };
    const body = await r.json() as {
      tree?: ReadonlyArray<{ path?: string; type?: string; size?: number }>;
      truncated?: boolean;
    };
    treeTruncated = Boolean(body.truncated);
    for (const e of body.tree ?? []) {
      if (typeof e.path !== "string" || (e.type !== "blob" && e.type !== "tree")) continue;
      tree.push({ path: e.path, type: e.type, size: typeof e.size === "number" ? e.size : undefined });
      if (tree.length >= MAX_TREE_ENTRIES) {
        treeTruncated = true;
        break;
      }
    }
  } catch {
    return { ok: false, reason: "network_error", detail: "Could not fetch tree." };
  }

  // 4. Recent commits (parallel with tree would be nicer; serialize for now).
  const recentCommits: RepoCommit[] = [];
  try {
    const r = await ghFetch(`/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=${MAX_RECENT_COMMITS}`);
    if (r.ok) {
      const body = await r.json() as ReadonlyArray<{
        sha?: string;
        commit?: {
          message?: string;
          author?: { name?: string; date?: string };
        };
      }>;
      for (const c of body) {
        const sha = c.sha;
        const message = c.commit?.message ?? "";
        const authorName = c.commit?.author?.name ?? "unknown";
        const authoredAt = c.commit?.author?.date ?? "";
        if (typeof sha === "string") {
          recentCommits.push({ sha, message, authorName, authoredAt });
        }
      }
    }
    // Non-fatal on commits — proceed without them.
  } catch {
    // Non-fatal.
  }

  // 5. Key files (bounded content).
  const keyFiles: RepoFileContent[] = [];
  for (const filename of KEY_FILE_CANDIDATES) {
    // Skip if the tree doesn't include the file (avoids 404 spam).
    const inTree = tree.some((t) => t.path === filename && t.type === "blob");
    if (!inTree) continue;
    try {
      const r = await ghFetch(`/repos/${owner}/${repo}/contents/${encodeURIComponent(filename)}?ref=${encodeURIComponent(branch)}`);
      if (!r.ok) continue;
      const body = await r.json() as { content?: string; encoding?: string; size?: number };
      if (body.encoding !== "base64" || typeof body.content !== "string") continue;
      const decoded = Buffer.from(body.content.replace(/\n/g, ""), "base64").toString("utf-8");
      const truncated = decoded.length > MAX_KEY_FILE_BYTES;
      const content = truncated ? decoded.slice(0, MAX_KEY_FILE_BYTES) : decoded;
      keyFiles.push({ path: filename, content, truncated });
    } catch {
      // Skip individual file failures.
    }
  }

  return {
    ok: true,
    snapshot: {
      owner,
      repo,
      defaultBranch,
      branch,
      headSha,
      tree,
      treeTruncated,
      recentCommits,
      keyFiles,
    },
  };
}
