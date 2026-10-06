/**
 * GitHub write client — branch creation, file commits, pull requests.
 *
 * Mirrors lib/releaseops/githubFetcher.ts's shape: a thin fetch() wrapper,
 * no retry, no pagination — these are single-shot write calls, not sync
 * jobs. Every function takes an already-resolved installation token
 * (lib/connectors/github/githubAppAuth.ts's resolveGithubInstallationToken,
 * scoped to exactly the one repository being written to); this module
 * does no token resolution or tenant/repo-scope checks itself — callers
 * (the API routes) own that.
 *
 * Server-only.
 */

import "server-only";

const GITHUB_API = "https://api.github.com";

export type GithubWriteResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function gh<T>(
  path: string,
  token: string,
  init: { method?: string; body?: unknown } = {},
): Promise<GithubWriteResult<T>> {
  try {
    const response = await fetch(`${GITHUB_API}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, error: `github_${response.status}: ${text.slice(0, 300)}` };
    }
    const data = (await response.json().catch(() => ({}))) as T;
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "network_error" };
  }
}

export interface CreateBranchInput {
  owner: string;
  repo: string;
  baseBranch: string;
  newBranchName: string;
  installationToken: string;
}

/** Creates a new branch ref pointing at the current tip of `baseBranch`. */
export async function createBranch(input: CreateBranchInput): Promise<GithubWriteResult<{ ref: string; sha: string }>> {
  const base = await gh<{ object: { sha: string } }>(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/ref/heads/${encodeURIComponent(input.baseBranch)}`,
    input.installationToken,
  );
  if (!base.ok) return { ok: false, error: `base_branch_not_found: ${base.error}` };

  const created = await gh<{ ref: string; object: { sha: string } }>(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/refs`,
    input.installationToken,
    { method: "POST", body: { ref: `refs/heads/${input.newBranchName}`, sha: base.data.object.sha } },
  );
  if (!created.ok) return { ok: false, error: created.error };
  return { ok: true, data: { ref: created.data.ref, sha: created.data.object.sha } };
}

export interface CommitFileInput {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  content: string;
  message: string;
  installationToken: string;
}

/** Creates or updates a single file on `branch` via the Contents API. */
export async function commitFile(input: CommitFileInput): Promise<GithubWriteResult<{ sha: string; htmlUrl: string }>> {
  const encodedPath = input.path.split("/").map(encodeURIComponent).join("/");
  const existing = await gh<{ sha: string }>(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(input.branch)}`,
    input.installationToken,
  );
  const body: { message: string; content: string; branch: string; sha?: string } = {
    message: input.message,
    content: Buffer.from(input.content, "utf8").toString("base64"),
    branch: input.branch,
  };
  // existing.ok means the file is already there — the Contents API requires
  // its current blob sha to update it, otherwise it refuses with a conflict.
  if (existing.ok) body.sha = existing.data.sha;

  const result = await gh<{ content: { sha: string; html_url: string } }>(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/contents/${encodedPath}`,
    input.installationToken,
    { method: "PUT", body },
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: { sha: result.data.content.sha, htmlUrl: result.data.content.html_url } };
}

export interface CreatePullRequestInput {
  owner: string;
  repo: string;
  head: string;
  base: string;
  title: string;
  body?: string;
  installationToken: string;
}

export async function createPullRequest(
  input: CreatePullRequestInput,
): Promise<GithubWriteResult<{ number: number; htmlUrl: string }>> {
  const result = await gh<{ number: number; html_url: string }>(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls`,
    input.installationToken,
    { method: "POST", body: { title: input.title, head: input.head, base: input.base, body: input.body ?? "" } },
  );
  if (!result.ok) return { ok: false, error: `pull_request_create_failed: ${result.error}` };
  return { ok: true, data: { number: result.data.number, htmlUrl: result.data.html_url } };
}

export interface DispatchWorkflowInput {
  owner: string;
  repo: string;
  /** Workflow filename, e.g. "axiom-deploy-aws-ecs.yml" — not a numeric ID. */
  workflowFile: string;
  /** Branch or tag to run the workflow on. */
  ref: string;
  /** workflow_dispatch inputs — GitHub requires every value to be a string. */
  inputs: Record<string, string>;
  installationToken: string;
}

/**
 * Triggers a workflow_dispatch run on the tenant's own repo. Requires the
 * installation token to carry `actions: write` — see
 * githubAppManifest.ts's GITHUB_APP_MANIFEST_PERMISSIONS. GitHub returns
 * 204 No Content on success and gives back no run ID synchronously; the
 * caller has no handle to poll beyond listing recent runs for this
 * workflow file.
 */
export async function dispatchWorkflow(input: DispatchWorkflowInput): Promise<GithubWriteResult<Record<string, never>>> {
  const result = await gh<Record<string, never>>(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/actions/workflows/${encodeURIComponent(input.workflowFile)}/dispatches`,
    input.installationToken,
    { method: "POST", body: { ref: input.ref, inputs: input.inputs } },
  );
  if (!result.ok) return { ok: false, error: `workflow_dispatch_failed: ${result.error}` };
  return result;
}

export interface LatestWorkflowRunInput {
  owner: string;
  repo: string;
  workflowFile: string;
  installationToken: string;
}

export interface LatestWorkflowRun {
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string;
}

/** Read-only — the newest run for a workflow file, or null if none exist yet. */
export async function getLatestWorkflowRun(input: LatestWorkflowRunInput): Promise<GithubWriteResult<LatestWorkflowRun | null>> {
  const result = await gh<{ workflow_runs: Array<{ status: string; conclusion: string | null; html_url: string; created_at: string }> }>(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/actions/workflows/${encodeURIComponent(input.workflowFile)}/runs?per_page=1`,
    input.installationToken,
  );
  if (!result.ok) return { ok: false, error: result.error };
  const run = result.data.workflow_runs[0];
  if (!run) return { ok: true, data: null };
  return { ok: true, data: { status: run.status, conclusion: run.conclusion, htmlUrl: run.html_url, createdAt: run.created_at } };
}
