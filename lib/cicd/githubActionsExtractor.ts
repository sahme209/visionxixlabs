/**
 * GitHub Actions live workflow runs extractor.
 *
 * Pure read-only GitHub REST traversal. Uses the existing canonical
 * GitHub client (App-or-PAT auth path). Lists recent workflow runs
 * across one or more repos and maps each into the typed PipelineRun
 * shape.
 *
 * Endpoints:
 *   GET /repos/{owner}/{repo}/actions/runs?per_page=20
 *
 * Hard rules:
 *   - Only runs when GitHub mode = live + GITHUB_ACTIONS_EXTRACT_ENABLED.
 *   - Repository allowlist via GITHUB_ACTIONS_REPOS env (comma
 *     separated "owner/repo" entries). Without the allowlist, the
 *     extractor refuses — never scans an entire org silently.
 *   - Per-call timeout 8s. Run cap 20 per repo.
 *   - The extractor never triggers / cancels / re-runs anything.
 */

import "server-only";

import { createGithubClient } from "@/lib/connectors/github/githubLiveClient";
import { loadAppEnv } from "@/lib/config/env";
import type { PipelineRun, PipelineStatus } from "./cicdOpsModel";

export interface GithubActionsExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  runs: PipelineRun[];
  durationMs: number;
  limitations: string[];
}

interface GhRunPayload {
  id: number;
  name?: string;
  status?: string;
  conclusion?: string | null;
  head_branch?: string;
  head_sha?: string;
  created_at?: string;
  updated_at?: string;
  run_started_at?: string;
  html_url?: string;
  triggering_actor?: { login?: string };
  repository?: { full_name?: string };
}

interface GhRunsResponse {
  workflow_runs?: GhRunPayload[];
}

export async function extractGithubActionsRuns(): Promise<GithubActionsExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.githubActionsExtractEnabled) {
    return blocked(start, "GITHUB_ACTIONS_EXTRACT_ENABLED is not set — extractor skipped.");
  }
  if (env.githubSyncMode !== "live") {
    return preview(start, "GitHub mode is not live — extractor returned honest preview.");
  }
  const repos = resolveRepoAllowlist();
  if (repos.length === 0) {
    return blocked(start, "GITHUB_ACTIONS_REPOS allowlist is empty — set comma-separated 'owner/repo' entries.");
  }

  const client = createGithubClient();
  if (!client.available) {
    return blocked(start, "GitHub client unavailable — neither GITHUB_PAT nor GITHUB_APP_* configured.");
  }

  const runs: PipelineRun[] = [];
  const limitations: string[] = [];

  for (const slug of repos) {
    const [owner, repo] = slug.split("/");
    if (!owner || !repo) {
      limitations.push(`Skipped invalid repo slug: ${slug}`);
      continue;
    }
    const res = await client.get<GhRunsResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?per_page=20`);
    if (!res.ok) {
      limitations.push(`${slug}: ${res.errorKind} ${res.errorMessage ?? ""}`.trim());
      continue;
    }
    for (const r of res.data?.workflow_runs ?? []) {
      runs.push(mapRun(r, slug));
    }
  }

  return {
    mode: "live",
    runs,
    durationMs: Date.now() - start,
    limitations,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapRun(r: GhRunPayload, slug: string): PipelineRun {
  const started = r.run_started_at ?? r.created_at ?? new Date().toISOString();
  const finished = r.status === "completed" ? r.updated_at : undefined;
  const durationMs = finished ? Math.max(0, new Date(finished).getTime() - new Date(started).getTime()) : undefined;
  return {
    id: String(r.id),
    provider: "github_actions",
    repo: r.repository?.full_name ?? slug,
    workflow: r.name ?? "workflow",
    branch: r.head_branch ?? "unknown",
    commit: r.head_sha?.slice(0, 12) ?? "unknown",
    status: mapStatus(r.status, r.conclusion),
    startedAt: started,
    finishedAt: finished,
    durationMs,
    triggeredBy: r.triggering_actor?.login,
    sourceMode: "live",
    externalRunHref: r.html_url,
  };
}

function mapStatus(status: string | undefined, conclusion: string | null | undefined): PipelineStatus {
  if (status === "queued") return "queued";
  if (status === "in_progress") return "running";
  if (status === "completed") {
    switch ((conclusion ?? "").toLowerCase()) {
      case "success":       return "success";
      case "failure":       return "failed";
      case "cancelled":     return "canceled";
      case "timed_out":     return "timed_out";
      case "action_required": return "blocked_by_policy";
      case "skipped":       return "canceled";
      case "neutral":       return "success";
      default:              return "unknown";
    }
  }
  return "unknown";
}

function resolveRepoAllowlist(): string[] {
  const raw = process.env.GITHUB_ACTIONS_REPOS?.trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function preview(start: number, note: string): GithubActionsExtraction {
  return { mode: "preview", runs: [], durationMs: Date.now() - start, limitations: [note] };
}

function blocked(start: number, note: string): GithubActionsExtraction {
  return { mode: "blocked", runs: [], durationMs: Date.now() - start, limitations: [note] };
}
