/**
 * GitHub live read-only scanner.
 *
 * Discovers repositories, workflows, recent workflow runs, and branch
 * protection settings via authenticated REST calls. Emits the same
 * `GithubPreviewSyncOutcome` shape as `runPreviewGithubSync` — consumers
 * (ReleaseOps state, readiness scorer, security scanner) never branch on
 * source mode except at the boundary.
 *
 * Hard rules:
 *  - Read-only. The client never POSTs/PATCHes/DELETEs.
 *  - Permission errors are honest: a 403 on branch protection returns
 *    `protected: false` *with* a captured limitation, not a thrown error.
 *  - Pagination cap (DEFAULT_REPO_LIMIT) keeps the call bounded for large
 *    orgs.
 *  - Token never leaves the client module.
 */

import "server-only";

import { createGithubClient, getGithubMode, type GithubClient, type GithubRateLimit } from "./githubLiveClient";
import type {
  GithubBranchProtectionPreview,
  GithubPreviewSyncOutcome,
  GithubRepoPreview,
  GithubWorkflowPreview,
} from "./githubPreviewSync";

const DEFAULT_REPO_LIMIT = 30;
const DEFAULT_WORKFLOWS_PER_REPO = 10;

// ---------------------------------------------------------------------------
// Outcome shape — superset of GithubPreviewSyncOutcome with honest limitations
// ---------------------------------------------------------------------------

export interface GithubLiveSyncOutcome extends GithubPreviewSyncOutcome {
  source: "live" | "partial";
  /** Authenticated identity that made these calls — never the token. */
  authenticatedLogin?: string;
  /** Captured limitations (e.g. permission denied on branch protection). */
  limitations: string[];
  /** Rate-limit snapshot at the end of the sync. */
  rateLimit: GithubRateLimit;
}

export interface GithubLiveScannerInput {
  /** GitHub org or user login to scan. Required. */
  organization: string;
  /** Cap on repositories discovered (default 30). */
  maxRepos?: number;
  /** Cap on workflows fetched per repo (default 10). */
  maxWorkflowsPerRepo?: number;
}

// ---------------------------------------------------------------------------
// REST response types — just the fields we read
// ---------------------------------------------------------------------------

interface ApiRepo {
  id: number;
  name: string;
  full_name: string;
  default_branch: string;
  visibility?: string;
  private?: boolean;
  pushed_at?: string | null;
}

interface ApiWorkflow {
  id: number;
  name: string;
  path: string;
  state: string;
}

interface ApiWorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  event: string;
  created_at: string;
  updated_at: string;
}

interface ApiBranchProtection {
  required_pull_request_reviews?: { required_approving_review_count?: number } | null;
  required_signatures?: { enabled?: boolean } | null;
  required_status_checks?: { contexts?: string[] } | null;
  enforce_admins?: { enabled?: boolean } | null;
}

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

export async function runLiveGithubSync(input: GithubLiveScannerInput): Promise<GithubLiveSyncOutcome> {
  const start = Date.now();
  const mode = getGithubMode();
  if (mode !== "live") {
    return emptyOutcome(start, ["GitHub is not in live mode — no live calls were issued."]);
  }

  const client = createGithubClient();
  if (!client.available) {
    return emptyOutcome(start, ["GitHub credential not configured. Set GITHUB_PAT or GITHUB_APP_ID + GITHUB_PRIVATE_KEY."]);
  }

  const limitations: string[] = [];
  let authenticatedLogin: string | undefined;
  let rateLimit: GithubRateLimit = {};

  // 1) Confirm identity once.
  const who = await client.get<{ login: string }>("/user");
  rateLimit = who.rateLimit;
  if (who.ok && who.data) {
    authenticatedLogin = who.data.login;
  } else if (who.errorKind === "auth_failure") {
    return {
      ...emptyOutcome(start, ["GitHub token did not authenticate (401). Live data unavailable."]),
      rateLimit,
    };
  } else {
    limitations.push(`/user check returned ${who.status}; proceeding without identity.`);
  }

  // 2) List repos for the org. Try /orgs/{org}/repos first; fall back to user repos.
  const maxRepos = Math.min(Math.max(input.maxRepos ?? DEFAULT_REPO_LIMIT, 1), 100);
  const reposResult = await client.get<ApiRepo[]>(`/orgs/${encodeURIComponent(input.organization)}/repos?per_page=${maxRepos}&type=all&sort=pushed`);
  let apiRepos: ApiRepo[] = [];
  if (reposResult.ok && Array.isArray(reposResult.data)) {
    apiRepos = reposResult.data;
    rateLimit = reposResult.rateLimit;
  } else if (reposResult.errorKind === "not_found") {
    // Fall back to user repos.
    const userRepos = await client.get<ApiRepo[]>(`/users/${encodeURIComponent(input.organization)}/repos?per_page=${maxRepos}&type=owner&sort=pushed`);
    if (userRepos.ok && Array.isArray(userRepos.data)) {
      apiRepos = userRepos.data;
      rateLimit = userRepos.rateLimit;
    } else {
      limitations.push(`Could not list repositories for "${input.organization}" — ${userRepos.errorKind ?? "unknown error"}.`);
    }
  } else {
    limitations.push(`Listing org repos failed — ${reposResult.errorKind ?? "unknown error"}.`);
  }

  // Normalize repos.
  const repos: GithubRepoPreview[] = apiRepos.map((r) => ({
    id: `repo_${r.id}`,
    organization: input.organization,
    name: r.name,
    defaultBranch: r.default_branch,
    visibility: normalizeVisibility(r),
    pushedAt: r.pushed_at ?? new Date().toISOString(),
    protected: false, // tentative — set below when we read branch protection
    source: "live",
  }));

  // 3) For each repo, fetch workflows + most recent run, plus branch protection.
  const workflows: GithubWorkflowPreview[] = [];
  const protections: GithubBranchProtectionPreview[] = [];
  const maxWorkflows = Math.min(Math.max(input.maxWorkflowsPerRepo ?? DEFAULT_WORKFLOWS_PER_REPO, 1), 30);

  for (const repo of apiRepos) {
    const owner = input.organization;
    const localRepo = repos.find((r) => r.id === `repo_${repo.id}`);

    // Workflows
    const wfRes = await client.get<{ workflows: ApiWorkflow[] }>(`/repos/${owner}/${repo.name}/actions/workflows?per_page=${maxWorkflows}`);
    rateLimit = wfRes.rateLimit;
    const apiWorkflows = wfRes.ok ? (wfRes.data?.workflows ?? []) : [];

    for (const wf of apiWorkflows) {
      // Most recent run for that workflow.
      const runsRes = await client.get<{ workflow_runs: ApiWorkflowRun[] }>(
        `/repos/${owner}/${repo.name}/actions/workflows/${wf.id}/runs?per_page=1`,
      );
      rateLimit = runsRes.rateLimit;
      const recent = runsRes.ok ? runsRes.data?.workflow_runs?.[0] : undefined;
      workflows.push({
        id: `wf_${wf.id}`,
        repoId: `repo_${repo.id}`,
        name: wf.name,
        filename: wf.path,
        state: normalizeWorkflowState(wf.state),
        trigger: ["push"], // GitHub REST doesn't return trigger list on this endpoint — we leave the common default
        lastRunStatus: normalizeRunStatus(recent),
        lastRunAt: recent?.updated_at,
        source: "live",
      });
    }
    if (!wfRes.ok) {
      limitations.push(`Workflows for ${repo.full_name} unavailable (${wfRes.errorKind}).`);
    }

    // Branch protection on default branch
    const bpRes = await client.get<ApiBranchProtection>(
      `/repos/${owner}/${repo.name}/branches/${encodeURIComponent(repo.default_branch)}/protection`,
    );
    rateLimit = bpRes.rateLimit;
    if (bpRes.ok && bpRes.data) {
      const bp = bpRes.data;
      protections.push({
        repoId: `repo_${repo.id}`,
        branch: repo.default_branch,
        requiredReviewers: bp.required_pull_request_reviews?.required_approving_review_count ?? 0,
        requireSignedCommits: Boolean(bp.required_signatures?.enabled),
        requireStatusChecks: bp.required_status_checks?.contexts ?? [],
        enforceAdmins: Boolean(bp.enforce_admins?.enabled),
        source: "live",
      });
      if (localRepo) localRepo.protected = true;
    } else if (bpRes.errorKind === "not_found") {
      // No protection configured — record an honest "no protection" row so the
      // readiness scorer can flag it.
      protections.push({
        repoId: `repo_${repo.id}`,
        branch: repo.default_branch,
        requiredReviewers: 0,
        requireSignedCommits: false,
        requireStatusChecks: [],
        enforceAdmins: false,
        source: "live",
      });
    } else if (bpRes.errorKind === "permission_denied") {
      limitations.push(`Branch protection unavailable for ${repo.full_name} (token lacks admin:repo scope).`);
    }
  }

  const source: GithubLiveSyncOutcome["source"] = limitations.length === 0 ? "live" : "partial";

  return {
    repos,
    workflows,
    protections,
    durationMs: Date.now() - start,
    source,
    authenticatedLogin,
    limitations,
    rateLimit,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyOutcome(start: number, limitations: string[]): GithubLiveSyncOutcome {
  return {
    repos: [],
    workflows: [],
    protections: [],
    durationMs: Date.now() - start,
    source: "partial",
    limitations,
    rateLimit: {},
  };
}

function normalizeVisibility(r: ApiRepo): GithubRepoPreview["visibility"] {
  const v = (r.visibility ?? "").toLowerCase();
  if (v === "public") return "public";
  if (v === "internal") return "internal";
  return "private";
}

function normalizeWorkflowState(s: string): GithubWorkflowPreview["state"] {
  if (s === "disabled_manually") return "disabled_manually";
  if (s === "disabled_inactivity") return "disabled_inactivity";
  return "active";
}

function normalizeRunStatus(run: ApiWorkflowRun | undefined): GithubWorkflowPreview["lastRunStatus"] | undefined {
  if (!run) return undefined;
  if (run.status === "completed") {
    if (run.conclusion === "success") return "success";
    if (run.conclusion === "failure") return "failure";
    if (run.conclusion === "cancelled") return "cancelled";
    return undefined;
  }
  return "in_progress";
}

/** Convenience helper for callers that want a single quick health signal. */
export function summarizeLiveOutcome(outcome: GithubLiveSyncOutcome): {
  status: "live" | "partial" | "empty";
  repoCount: number;
  workflowCount: number;
  failingWorkflows: number;
} {
  const failingWorkflows = outcome.workflows.filter((w) => w.lastRunStatus === "failure").length;
  let status: "live" | "partial" | "empty" = outcome.source;
  if (outcome.repos.length === 0) status = "empty";
  return {
    status,
    repoCount: outcome.repos.length,
    workflowCount: outcome.workflows.length,
    failingWorkflows,
  };
}

// Suppress TS unused-import warning for `GithubClient` (kept for future App-flow use).
export type _GithubClient = GithubClient;
