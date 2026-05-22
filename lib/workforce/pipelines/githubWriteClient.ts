/**
 * GitHub write client — Phase 388.
 *
 * Uses the GitHub Git Data API to:
 *   1. Fetch the base commit's tree (so we can layer changes on top).
 *   2. For each changed file, fetch the existing blob content (so the
 *      patch applier has a base to work against).
 *   3. PUT blobs for each new file content.
 *   4. POST a tree referencing the new blobs.
 *   5. POST a commit pointing at the tree, with the base commit as
 *      its parent.
 *   6. PATCH a new branch ref to point at the commit (creates the
 *      branch on GitHub).
 *   7. POST a pull request from the new branch to the base branch.
 *
 * Requires GITHUB_TOKEN with `contents: write` + `pull_requests: write`
 * scope on the target repo. Missing token → returns
 * `forbidden_no_token` so the executor falls back cleanly.
 *
 * Closed-union failure reasons. Never throws out of the module.
 */

import "server-only";

const GH_API = "https://api.github.com";
const FETCH_TIMEOUT_MS = 15_000;

interface GhHeaders {
  Accept: string;
  "User-Agent": string;
  Authorization?: string;
  "X-GitHub-Api-Version": string;
  "Content-Type"?: string;
}

function buildHeaders(json = false): GhHeaders {
  const h: GhHeaders = {
    Accept: "application/vnd.github+json",
    "User-Agent": "visionxixlabs-ai-coding-loop",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function ghFetch(path: string, init?: { method?: string; body?: unknown }): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${GH_API}${path}`, {
      method: init?.method ?? "GET",
      headers: buildHeaders(init?.body !== undefined) as unknown as Record<string, string>,
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

export interface FileChange {
  path: string;
  /** New content. null = file deleted. */
  content: string | null;
}

export type OpenPRFailReason =
  | "no_token"
  | "branch_not_found"
  | "blob_fetch_failed"
  | "blob_write_failed"
  | "tree_write_failed"
  | "commit_write_failed"
  | "branch_create_failed"
  | "pull_request_create_failed"
  | "network_error";

export interface OpenPRInput {
  owner: string;
  repo: string;
  baseBranch: string;
  newBranch: string;
  files: ReadonlyArray<FileChange>;
  commitMessage: string;
  prTitle: string;
  prBody: string;
}

export type OpenPRResult =
  | { ok: true; prUrl: string; prNumber: number; headSha: string }
  | { ok: false; reason: OpenPRFailReason; detail: string };

/**
 * Fetch the raw text content of a file at the given ref. Returns null
 * when the file doesn't exist (404). Returns "<binary>" when the file
 * is not UTF-8 — the patch applier can't handle binaries today; the
 * executor refuses such patches upstream.
 */
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<{ ok: true; content: string | null } | { ok: false; reason: "fetch_failed" | "binary"; detail: string }> {
  try {
    const r = await ghFetch(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`);
    if (r.status === 404) return { ok: true, content: null };
    if (!r.ok) return { ok: false, reason: "fetch_failed", detail: `contents GET ${r.status}` };
    const body = await r.json() as { content?: string; encoding?: string };
    if (body.encoding !== "base64" || typeof body.content !== "string") {
      return { ok: false, reason: "binary", detail: "non-base64 encoding" };
    }
    const decoded = Buffer.from(body.content.replace(/\n/g, ""), "base64").toString("utf-8");
    return { ok: true, content: decoded };
  } catch {
    return { ok: false, reason: "fetch_failed", detail: "network" };
  }
}

export async function openPullRequest(input: OpenPRInput): Promise<OpenPRResult> {
  if (!process.env.GITHUB_TOKEN) {
    return { ok: false, reason: "no_token", detail: "GITHUB_TOKEN not set." };
  }

  // 1. Resolve base branch HEAD.
  let baseSha: string;
  try {
    const r = await ghFetch(`/repos/${input.owner}/${input.repo}/git/ref/heads/${encodeURIComponent(input.baseBranch)}`);
    if (r.status === 404) return { ok: false, reason: "branch_not_found", detail: `base branch ${input.baseBranch} not found` };
    if (!r.ok) return { ok: false, reason: "branch_not_found", detail: `base ref GET ${r.status}` };
    const body = await r.json() as { object?: { sha?: string } };
    if (typeof body.object?.sha !== "string") return { ok: false, reason: "branch_not_found", detail: "no sha on base ref" };
    baseSha = body.object.sha;
  } catch {
    return { ok: false, reason: "network_error", detail: "could not resolve base branch" };
  }

  // 2. Resolve base tree sha.
  let baseTreeSha: string;
  try {
    const r = await ghFetch(`/repos/${input.owner}/${input.repo}/git/commits/${baseSha}`);
    if (!r.ok) return { ok: false, reason: "branch_not_found", detail: `base commit GET ${r.status}` };
    const body = await r.json() as { tree?: { sha?: string } };
    if (typeof body.tree?.sha !== "string") return { ok: false, reason: "branch_not_found", detail: "no tree sha on base commit" };
    baseTreeSha = body.tree.sha;
  } catch {
    return { ok: false, reason: "network_error", detail: "could not resolve base tree" };
  }

  // 3. Build tree entries — POST blobs for each non-null content; for
  //    deleted files use { sha: null } in the tree entry which tells
  //    GitHub to remove the path.
  type TreeEntry =
    | { path: string; mode: "100644"; type: "blob"; sha: string }
    | { path: string; mode: "100644"; type: "blob"; sha: null };
  const treeEntries: TreeEntry[] = [];

  for (const f of input.files) {
    if (f.content === null) {
      treeEntries.push({ path: f.path, mode: "100644", type: "blob", sha: null });
      continue;
    }
    try {
      const r = await ghFetch(`/repos/${input.owner}/${input.repo}/git/blobs`, {
        method: "POST",
        body: {
          content: Buffer.from(f.content, "utf-8").toString("base64"),
          encoding: "base64",
        },
      });
      if (!r.ok) return { ok: false, reason: "blob_write_failed", detail: `blob POST ${r.status} for ${f.path}` };
      const body = await r.json() as { sha?: string };
      if (typeof body.sha !== "string") return { ok: false, reason: "blob_write_failed", detail: `no sha on blob response for ${f.path}` };
      treeEntries.push({ path: f.path, mode: "100644", type: "blob", sha: body.sha });
    } catch {
      return { ok: false, reason: "network_error", detail: `blob POST network for ${f.path}` };
    }
  }

  // 4. POST tree referencing the new blobs on top of the base tree.
  let newTreeSha: string;
  try {
    const r = await ghFetch(`/repos/${input.owner}/${input.repo}/git/trees`, {
      method: "POST",
      body: {
        base_tree: baseTreeSha,
        tree: treeEntries,
      },
    });
    if (!r.ok) return { ok: false, reason: "tree_write_failed", detail: `tree POST ${r.status}` };
    const body = await r.json() as { sha?: string };
    if (typeof body.sha !== "string") return { ok: false, reason: "tree_write_failed", detail: "no sha on tree response" };
    newTreeSha = body.sha;
  } catch {
    return { ok: false, reason: "network_error", detail: "tree POST network" };
  }

  // 5. POST commit pointing at the new tree.
  let newCommitSha: string;
  try {
    const r = await ghFetch(`/repos/${input.owner}/${input.repo}/git/commits`, {
      method: "POST",
      body: {
        message: input.commitMessage,
        tree: newTreeSha,
        parents: [baseSha],
      },
    });
    if (!r.ok) return { ok: false, reason: "commit_write_failed", detail: `commit POST ${r.status}` };
    const body = await r.json() as { sha?: string };
    if (typeof body.sha !== "string") return { ok: false, reason: "commit_write_failed", detail: "no sha on commit response" };
    newCommitSha = body.sha;
  } catch {
    return { ok: false, reason: "network_error", detail: "commit POST network" };
  }

  // 6. POST new branch ref pointing at the commit.
  try {
    const r = await ghFetch(`/repos/${input.owner}/${input.repo}/git/refs`, {
      method: "POST",
      body: {
        ref: `refs/heads/${input.newBranch}`,
        sha: newCommitSha,
      },
    });
    if (!r.ok) return { ok: false, reason: "branch_create_failed", detail: `ref POST ${r.status}` };
  } catch {
    return { ok: false, reason: "network_error", detail: "branch ref POST network" };
  }

  // 7. POST pull request.
  try {
    const r = await ghFetch(`/repos/${input.owner}/${input.repo}/pulls`, {
      method: "POST",
      body: {
        title: input.prTitle,
        body: input.prBody,
        head: input.newBranch,
        base: input.baseBranch,
      },
    });
    if (!r.ok) return { ok: false, reason: "pull_request_create_failed", detail: `pulls POST ${r.status}` };
    const body = await r.json() as { html_url?: string; number?: number };
    if (typeof body.html_url !== "string" || typeof body.number !== "number") {
      return { ok: false, reason: "pull_request_create_failed", detail: "no html_url or number on PR response" };
    }
    return { ok: true, prUrl: body.html_url, prNumber: body.number, headSha: newCommitSha };
  } catch {
    return { ok: false, reason: "network_error", detail: "pulls POST network" };
  }
}
