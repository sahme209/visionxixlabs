/**
 * Honest GitHub preview sync — produces a typed repository + workflow +
 * branch-protection inventory when live sync isn't configured.
 *
 * Same shape live sync will produce so consumer code branches only at
 * the boundary.
 */

import "server-only";

export interface GithubRepoPreview {
  id: string;
  organization: string;
  name: string;
  defaultBranch: string;
  visibility: "public" | "private" | "internal";
  pushedAt: string;
  protected: boolean;
  source: "preview";
}

export interface GithubWorkflowPreview {
  id: string;
  repoId: string;
  name: string;
  filename: string;
  state: "active" | "disabled_manually" | "disabled_inactivity";
  trigger: ("push" | "pull_request" | "schedule" | "workflow_dispatch")[];
  lastRunStatus?: "success" | "failure" | "cancelled" | "in_progress";
  lastRunAt?: string;
  source: "preview";
}

export interface GithubBranchProtectionPreview {
  repoId: string;
  branch: string;
  requiredReviewers: number;
  requireSignedCommits: boolean;
  requireStatusChecks: string[];
  enforceAdmins: boolean;
  source: "preview";
}

export interface GithubPreviewSyncOutcome {
  repos: GithubRepoPreview[];
  workflows: GithubWorkflowPreview[];
  protections: GithubBranchProtectionPreview[];
  durationMs: number;
}

export interface GithubPreviewSyncInput {
  organization: string;
}

export async function runPreviewGithubSync(input: GithubPreviewSyncInput): Promise<GithubPreviewSyncOutcome> {
  await new Promise((r) => setTimeout(r, 100));
  const org = input.organization;
  const repos: GithubRepoPreview[] = [
    {
      id: `repo_${org}_payments_api`,
      organization: org,
      name: "payments-api",
      defaultBranch: "main",
      visibility: "private",
      pushedAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      protected: true,
      source: "preview",
    },
    {
      id: `repo_${org}_checkout_frontend`,
      organization: org,
      name: "checkout-frontend",
      defaultBranch: "main",
      visibility: "private",
      pushedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      protected: true,
      source: "preview",
    },
    {
      id: `repo_${org}_infra_terraform`,
      organization: org,
      name: "infra-terraform",
      defaultBranch: "main",
      visibility: "private",
      pushedAt: new Date(Date.now() - 8 * 60 * 60_000).toISOString(),
      protected: true,
      source: "preview",
    },
  ];

  const workflows: GithubWorkflowPreview[] = [
    {
      id: `wf_${repos[0].id}_ci`,
      repoId: repos[0].id,
      name: "CI",
      filename: ".github/workflows/ci.yml",
      state: "active",
      trigger: ["push", "pull_request"],
      lastRunStatus: "success",
      lastRunAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      source: "preview",
    },
    {
      id: `wf_${repos[0].id}_deploy`,
      repoId: repos[0].id,
      name: "Deploy production",
      filename: ".github/workflows/deploy.yml",
      state: "active",
      trigger: ["workflow_dispatch"],
      lastRunStatus: "in_progress",
      lastRunAt: new Date(Date.now() - 4 * 60_000).toISOString(),
      source: "preview",
    },
    {
      id: `wf_${repos[1].id}_ci`,
      repoId: repos[1].id,
      name: "Build + Lint",
      filename: ".github/workflows/build.yml",
      state: "active",
      trigger: ["push", "pull_request"],
      lastRunStatus: "failure",
      lastRunAt: new Date(Date.now() - 12 * 60_000).toISOString(),
      source: "preview",
    },
    {
      id: `wf_${repos[2].id}_tf_plan`,
      repoId: repos[2].id,
      name: "Terraform plan",
      filename: ".github/workflows/terraform.yml",
      state: "active",
      trigger: ["pull_request"],
      lastRunStatus: "success",
      lastRunAt: new Date(Date.now() - 6 * 60 * 60_000).toISOString(),
      source: "preview",
    },
  ];

  const protections: GithubBranchProtectionPreview[] = [
    {
      repoId: repos[0].id,
      branch: "main",
      requiredReviewers: 2,
      requireSignedCommits: true,
      requireStatusChecks: ["CI", "tests"],
      enforceAdmins: true,
      source: "preview",
    },
    {
      repoId: repos[1].id,
      branch: "main",
      requiredReviewers: 1,
      requireSignedCommits: false,
      requireStatusChecks: ["Build + Lint"],
      enforceAdmins: false,
      source: "preview",
    },
    {
      repoId: repos[2].id,
      branch: "main",
      requiredReviewers: 1,
      requireSignedCommits: false,
      requireStatusChecks: ["Terraform plan"],
      enforceAdmins: true,
      source: "preview",
    },
  ];

  return { repos, workflows, protections, durationMs: 100 };
}
