/**
 * Release readiness scoring engine.
 *
 * Pure function over typed inputs (preview sync output or live GitHub
 * sync). Produces a typed readiness score + a ranked blocker list. Used
 * by the ReleaseOps page + the copilot's "why is this risky?" answer.
 */

import type { GithubBranchProtectionPreview, GithubRepoPreview, GithubWorkflowPreview } from "@/lib/connectors/github/githubPreviewSync";

export type ReadinessGrade = "A" | "B" | "C" | "D" | "F";

export interface ReadinessBlocker {
  id: string;
  repoId: string;
  branch?: string;
  kind:
    | "branch_protection_missing"
    | "branch_protection_weak"
    | "signed_commits_missing"
    | "required_checks_missing"
    | "workflow_failing"
    | "stale_sync"
    | "rollback_unverified"
    | "env_drift"
    | "no_deployment_approval";
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  detail: string;
  safeNextAction?: { label: string; href: string };
}

export interface ReleaseReadiness {
  score: number;                  // 0..100
  grade: ReadinessGrade;
  totalRepos: number;
  totalWorkflows: number;
  failingWorkflows: number;
  weakProtections: number;
  blockers: ReadinessBlocker[];
  /** Honest one-liner for the UI. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface ReleaseReadinessInputs {
  repos: GithubRepoPreview[];
  workflows: GithubWorkflowPreview[];
  protections: GithubBranchProtectionPreview[];
  /** ISO timestamp of the last sync — drives the "stale sync" check. */
  lastSyncAt?: string;
}

export function computeReleaseReadiness(input: ReleaseReadinessInputs): ReleaseReadiness {
  const blockers: ReadinessBlocker[] = [];
  let workflowFails = 0;
  let weakProtections = 0;

  // 1. Workflow failures → blocker
  for (const wf of input.workflows) {
    if (wf.lastRunStatus === "failure") {
      workflowFails++;
      blockers.push({
        id: `blk_wf_${wf.id}`,
        repoId: wf.repoId,
        kind: "workflow_failing",
        severity: "high",
        title: `Workflow failing: ${wf.name}`,
        detail: `Last run of ${wf.filename} failed at ${wf.lastRunAt}.`,
        safeNextAction: { label: "Open ReleaseOps", href: "/dashboard/releaseops" },
      });
    }
  }

  // 2. Protection gates per repo's default branch
  for (const repo of input.repos) {
    const prot = input.protections.find((p) => p.repoId === repo.id && p.branch === repo.defaultBranch);
    if (!prot) {
      weakProtections++;
      blockers.push({
        id: `blk_no_prot_${repo.id}`,
        repoId: repo.id,
        branch: repo.defaultBranch,
        kind: "branch_protection_missing",
        severity: "critical",
        title: `${repo.name}/${repo.defaultBranch} has no branch protection`,
        detail: "Production deploys without protection are unsafe.",
        safeNextAction: { label: "Open governance", href: "/dashboard/governance" },
      });
      continue;
    }
    if (prot.requiredReviewers < 2) {
      weakProtections++;
      blockers.push({
        id: `blk_weak_reviewers_${repo.id}`,
        repoId: repo.id,
        branch: prot.branch,
        kind: "branch_protection_weak",
        severity: "high",
        title: `${repo.name}/${prot.branch} requires only ${prot.requiredReviewers} reviewer(s)`,
        detail: "Production branches should require ≥ 2 reviewers.",
        safeNextAction: { label: "Open governance", href: "/dashboard/governance" },
      });
    }
    if (!prot.requireSignedCommits) {
      weakProtections++;
      blockers.push({
        id: `blk_unsigned_${repo.id}`,
        repoId: repo.id,
        branch: prot.branch,
        kind: "signed_commits_missing",
        severity: "medium",
        title: `${repo.name}/${prot.branch} does not require signed commits`,
        detail: "Signed commits prevent unauthorised merges.",
      });
    }
    if (prot.requireStatusChecks.length === 0) {
      weakProtections++;
      blockers.push({
        id: `blk_no_checks_${repo.id}`,
        repoId: repo.id,
        branch: prot.branch,
        kind: "required_checks_missing",
        severity: "high",
        title: `${repo.name}/${prot.branch} has no required status checks`,
        detail: "Branch protection should require CI to pass.",
      });
    }
  }

  // 3. Stale sync
  if (input.lastSyncAt) {
    const ageMs = Date.now() - Date.parse(input.lastSyncAt);
    if (ageMs > 24 * 60 * 60 * 1000) {
      blockers.push({
        id: "blk_stale_sync",
        repoId: "*",
        kind: "stale_sync",
        severity: "low",
        title: "GitHub sync is stale",
        detail: `Last sync was ${Math.round(ageMs / (60 * 60 * 1000))}h ago. Re-sync to refresh readiness signals.`,
      });
    }
  }

  // Score — start at 100, subtract weighted severity per blocker.
  const SEV_WEIGHT: Record<ReadinessBlocker["severity"], number> = {
    info: 1, low: 3, medium: 8, high: 14, critical: 24,
  };
  let score = 100;
  for (const b of blockers) score -= SEV_WEIGHT[b.severity];
  score = Math.max(0, Math.min(100, score));

  const grade: ReadinessGrade =
    score >= 90 ? "A" :
    score >= 75 ? "B" :
    score >= 60 ? "C" :
    score >= 40 ? "D" :
                  "F";

  // Sort blockers by severity desc
  const SEV_RANK = { info: 0, low: 1, medium: 2, high: 3, critical: 4 } as const;
  blockers.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]);

  const summary =
    blockers.length === 0
      ? `Release-ready · ${grade} · ${score}/100`
      : `${blockers.length} blocker${blockers.length === 1 ? "" : "s"} · ${grade} · ${score}/100`;

  return {
    score,
    grade,
    totalRepos: input.repos.length,
    totalWorkflows: input.workflows.length,
    failingWorkflows: workflowFails,
    weakProtections,
    blockers,
    summary,
  };
}
