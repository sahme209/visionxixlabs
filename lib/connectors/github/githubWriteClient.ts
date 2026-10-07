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

export function isSafeRepositoryPath(path: string): boolean {
  if (!path || path.length > 1024 || path.startsWith("/") || path.includes("\0")) return false;
  const segments = path.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

async function gh<T>(
  path: string,
  token: string,
  init: { method?: string; body?: unknown; apiVersion?: string } = {},
): Promise<GithubWriteResult<T>> {
  try {
    const response = await fetch(`${GITHUB_API}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": init.apiVersion ?? "2022-11-28",
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

export interface GetFileInput {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  installationToken: string;
}

/** Reads one UTF-8 text file through the same tenant-scoped installation token. */
export async function getFile(input: GetFileInput): Promise<GithubWriteResult<{ path: string; sha: string; content: string; htmlUrl: string }>> {
  if (!isSafeRepositoryPath(input.path)) return { ok: false, error: "invalid_repository_path" };
  const encodedPath = input.path.split("/").map(encodeURIComponent).join("/");
  const result = await gh<{ type: string; path: string; sha: string; content: string; encoding: string; html_url: string }>(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(input.branch)}`,
    input.installationToken,
  );
  if (!result.ok) return result;
  if (result.data.type !== "file" || result.data.encoding !== "base64") return { ok: false, error: "github_path_is_not_a_text_file" };
  const bytes = Buffer.from(result.data.content.replaceAll("\n", ""), "base64");
  if (bytes.byteLength > 100_000) return { ok: false, error: "github_file_too_large" };
  let content: string;
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, error: "github_file_is_not_utf8_text" };
  }
  return { ok: true, data: { path: result.data.path, sha: result.data.sha, content, htmlUrl: result.data.html_url } };
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
  /** Undefined keeps backwards compatibility; null means the file must not exist. */
  expectedSha?: string | null;
}

/** Creates or updates a single file on `branch` via the Contents API. */
export async function commitFile(input: CommitFileInput): Promise<GithubWriteResult<{ sha: string; htmlUrl: string }>> {
  if (!isSafeRepositoryPath(input.path)) return { ok: false, error: "invalid_repository_path" };
  if (Buffer.byteLength(input.content, "utf8") > 200_000) return { ok: false, error: "github_file_too_large" };
  const encodedPath = input.path.split("/").map(encodeURIComponent).join("/");
  const existing = await gh<{ sha: string }>(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(input.branch)}`,
    input.installationToken,
  );
  if (input.expectedSha !== undefined) {
    if (input.expectedSha === null) {
      if (existing.ok) return { ok: false, error: "github_file_changed_since_proposal" };
      if (!existing.error.startsWith("github_404:")) return { ok: false, error: `github_file_state_unavailable: ${existing.error}` };
    } else if (!existing.ok || existing.data.sha !== input.expectedSha) {
      return { ok: false, error: "github_file_changed_since_proposal" };
    }
  }
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

export type GitReferenceKind = "branch" | "tag";

/** Resolves the exact commit behind a branch or tag using the repo-scoped token. */
export async function resolveGitReference(input: {
  owner: string;
  repo: string;
  ref: string;
  kind: GitReferenceKind;
  installationToken: string;
}): Promise<GithubWriteResult<{ kind: GitReferenceKind; ref: string; commitSha: string }>> {
  const namespace = input.kind === "tag" ? "tags" : "heads";
  const result = await gh<{ object: { type: string; sha: string } }>(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/ref/${namespace}/${encodeURIComponent(input.ref)}`,
    input.installationToken,
  );
  if (!result.ok) return { ok: false, error: `${input.kind}_ref_not_found: ${result.error}` };

  let commitSha = result.data.object.sha;
  if (input.kind === "tag" && result.data.object.type === "tag") {
    const annotated = await gh<{ object: { type: string; sha: string } }>(
      `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/tags/${encodeURIComponent(commitSha)}`,
      input.installationToken,
    );
    if (!annotated.ok || annotated.data.object.type !== "commit") {
      return { ok: false, error: `tag_commit_unavailable: ${annotated.ok ? annotated.data.object.type : annotated.error}` };
    }
    commitSha = annotated.data.object.sha;
  }
  return { ok: true, data: { kind: input.kind, ref: input.ref, commitSha } };
}

export interface PullRequestGovernanceEvidence {
  number: number;
  state: string;
  mergedAt: string | null;
  headRef: string;
  baseRef: string;
  headSha: string;
  mergeCommitSha: string | null;
  approvedReviewCount: number;
  codeOwnerReviewsRequired: boolean;
  linkedChangeTickets: string[];
  htmlUrl: string;
}

/** Fetches live, deployment-critical PR evidence; no cached governance claims. */
export async function getPullRequestGovernanceEvidence(input: {
  owner: string;
  repo: string;
  pullRequestNumber: number;
  requireCodeowners: boolean;
  installationToken: string;
}): Promise<GithubWriteResult<PullRequestGovernanceEvidence>> {
  const path = `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}`;
  const pull = await gh<{
    number: number;
    state: string;
    merged_at: string | null;
    head: { ref: string; sha: string };
    base: { ref: string };
    merge_commit_sha: string | null;
    body: string | null;
    labels?: Array<{ name: string }>;
    html_url: string;
  }>(`${path}/pulls/${input.pullRequestNumber}`, input.installationToken);
  if (!pull.ok) return { ok: false, error: `pull_request_evidence_unavailable: ${pull.error}` };

  let approvedReviewCount = 0;
  let codeOwnerReviewsRequired = false;
  if (input.requireCodeowners) {
    const [reviews, protection] = await Promise.all([
      gh<Array<{ state: string; user?: { login?: string } }>>(
        `${path}/pulls/${input.pullRequestNumber}/reviews?per_page=100`,
        input.installationToken,
      ),
      gh<{ require_code_owner_reviews?: boolean }>(
        `${path}/branches/${encodeURIComponent(pull.data.base.ref)}/protection/required_pull_request_reviews`,
        input.installationToken,
      ),
    ]);
    if (!reviews.ok) return { ok: false, error: `pull_request_reviews_unavailable: ${reviews.error}` };
    if (!protection.ok && !protection.error.startsWith("github_404:")) {
      return { ok: false, error: `branch_protection_unavailable: ${protection.error}` };
    }
    approvedReviewCount = new Set(
      reviews.data
        .filter((review) => review.state.toUpperCase() === "APPROVED")
        .map((review) => review.user?.login)
        .filter((login): login is string => Boolean(login)),
    ).size;
    codeOwnerReviewsRequired = protection.ok && protection.data.require_code_owner_reviews === true;
  }

  const changeTicketPattern = /\b(?:CHG|INC|REQ)\d{4,}\b/g;
  const linkedChangeTickets = new Set<string>();
  for (const match of (pull.data.body ?? "").matchAll(changeTicketPattern)) linkedChangeTickets.add(match[0]);
  for (const label of pull.data.labels ?? []) {
    if (/^(?:CHG|INC|REQ)\d{4,}$/.test(label.name)) linkedChangeTickets.add(label.name);
  }

  return {
    ok: true,
    data: {
      number: pull.data.number,
      state: pull.data.state,
      mergedAt: pull.data.merged_at,
      headRef: pull.data.head.ref,
      baseRef: pull.data.base.ref,
      headSha: pull.data.head.sha,
      mergeCommitSha: pull.data.merge_commit_sha,
      approvedReviewCount,
      codeOwnerReviewsRequired,
      linkedChangeTickets: Array.from(linkedChangeTickets),
      htmlUrl: pull.data.html_url,
    },
  };
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
 * githubAppManifest.ts's GITHUB_APP_MANIFEST_PERMISSIONS. GitHub's
 * 2026-03-10 API returns the exact run identity. `null` fields preserve
 * compatibility with GitHub Enterprise instances that still return 204.
 */
export interface DispatchedWorkflowRun {
  workflowRunId: string | null;
  runUrl: string | null;
  htmlUrl: string | null;
}

export async function dispatchWorkflow(input: DispatchWorkflowInput): Promise<GithubWriteResult<DispatchedWorkflowRun>> {
  const result = await gh<{ workflow_run_id?: number | string; run_url?: string; html_url?: string }>(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/actions/workflows/${encodeURIComponent(input.workflowFile)}/dispatches`,
    input.installationToken,
    { method: "POST", body: { ref: input.ref, inputs: input.inputs }, apiVersion: "2026-03-10" },
  );
  if (!result.ok) return { ok: false, error: `workflow_dispatch_failed: ${result.error}` };
  return {
    ok: true,
    data: {
      workflowRunId: result.data.workflow_run_id === undefined ? null : String(result.data.workflow_run_id),
      runUrl: result.data.run_url ?? null,
      htmlUrl: result.data.html_url ?? null,
    },
  };
}

export interface WorkflowRunObservation {
  workflowRunId: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  rollback: "not_started" | "in_progress" | "succeeded" | "failed" | "unknown";
}

/** Reads one exact run plus its step outcomes so rollback evidence is explicit. */
export async function getWorkflowRun(input: {
  owner: string;
  repo: string;
  workflowRunId: string;
  installationToken: string;
}): Promise<GithubWriteResult<WorkflowRunObservation>> {
  if (!/^\d+$/.test(input.workflowRunId)) return { ok: false, error: "invalid_workflow_run_id" };
  const path = `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/actions/runs/${input.workflowRunId}`;
  const [run, jobs] = await Promise.all([
    gh<{ id: number | string; status: string; conclusion: string | null; html_url: string; created_at: string; run_started_at?: string | null; updated_at: string }>(path, input.installationToken),
    gh<{ jobs?: Array<{ steps?: Array<{ name?: string; status?: string; conclusion?: string | null }> }> }>(`${path}/jobs?per_page=100`, input.installationToken),
  ]);
  if (!run.ok) return run;
  const rollbackStep = jobs.ok
    ? jobs.data.jobs?.flatMap((job) => job.steps ?? []).find((step) => step.name?.startsWith("Roll back"))
    : undefined;
  const rollback: WorkflowRunObservation["rollback"] = !jobs.ok
    ? "unknown"
    : !rollbackStep || rollbackStep.conclusion === "skipped"
      ? "not_started"
      : rollbackStep.status !== "completed"
        ? "in_progress"
        : rollbackStep.conclusion === "success"
          ? "succeeded"
          : "failed";
  return {
    ok: true,
    data: {
      workflowRunId: String(run.data.id),
      status: run.data.status,
      conclusion: run.data.conclusion,
      htmlUrl: run.data.html_url,
      createdAt: run.data.created_at,
      startedAt: run.data.run_started_at ?? null,
      updatedAt: run.data.updated_at,
      rollback,
    },
  };
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
