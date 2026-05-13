/**
 * GitHub connector foundation for ReleaseOps.
 *
 * Typed adapter interface for GitHub-driven release telemetry. The interface
 * is implementation-agnostic so the same surfaces (ReleaseOps Command Center,
 * readiness scoring, event stream) work whether data comes from:
 *
 *   - a real authenticated GitHub App (production path)
 *   - a preview adapter that ingests a static JSON fixture (demo path)
 *   - a desktop-side local Git introspection (future workstation mode)
 *
 * No GitHub API calls happen in this file. Implementations slot in later.
 */

import type {
  Repository,
  Pipeline,
  Release,
  BranchProtection,
  ReadinessSignal,
  ServiceReadiness,
  ReadinessDimensionScore,
  DeploymentEvent,
} from "@/lib/releaseops/releaseModel";

// ---------------------------------------------------------------------------
// Auth + connection state
// ---------------------------------------------------------------------------

export type GitHubAuthMode = "app_installation" | "personal_token" | "preview" | "disconnected";

export interface GitHubConnection {
  organizationId: string;
  /** GitHub login (org or user). */
  login: string;
  authMode: GitHubAuthMode;
  /** App installation ID when authMode === "app_installation". */
  installationId?: number;
  /** Scopes requested. */
  scopes: string[];
  connectedAt?: string;
  lastSyncAt?: string;
  /** Honest status: live data flowing or demo fallback. */
  source: "live" | "demo";
}

// ---------------------------------------------------------------------------
// Connector interface — implementations slot in here
// ---------------------------------------------------------------------------

export interface GitHubConnectorOptions {
  /** Per-call timeout. */
  timeoutMs?: number;
  /** Maximum repos to discover in one call (pagination cap). */
  maxRepos?: number;
}

export interface GitHubConnector {
  readonly connection: GitHubConnection;

  /** Discover repositories visible to this installation. */
  listRepositories(opts?: GitHubConnectorOptions): Promise<Repository[]>;

  /** Discover Actions workflows for a repo. */
  listWorkflows(repoId: string, opts?: GitHubConnectorOptions): Promise<Pipeline[]>;

  /** Branch protection summary for a repo. */
  getBranchProtections(repoId: string, opts?: GitHubConnectorOptions): Promise<BranchProtection[]>;

  /** Recent release / workflow_run events for a repo. */
  listRecentReleases(repoId: string, opts?: GitHubConnectorOptions): Promise<Release[]>;

  /** Stream of deployment events ingested in the last N hours. */
  recentEvents(sinceISO: string, opts?: GitHubConnectorOptions): Promise<DeploymentEvent[]>;

  /** Health check — does the installation still have valid scopes? */
  validate(): Promise<{ valid: boolean; error?: string }>;
}

// ---------------------------------------------------------------------------
// Preview adapter — demo fixture, honestly labelled
// ---------------------------------------------------------------------------

/**
 * Returns a preview-mode connector that reads from in-memory fixtures.
 * Used until a real GitHub App installation is wired up. Every emitted
 * record is tagged source: "demo" so UI surfaces can label it honestly.
 */
export function createPreviewGitHubConnector(organizationId: string): GitHubConnector {
  const connection: GitHubConnection = {
    organizationId,
    login: "axiom-preview",
    authMode: "preview",
    scopes: [],
    source: "demo",
  };

  return {
    connection,
    async listRepositories() {
      return PREVIEW_REPOSITORIES;
    },
    async listWorkflows(repoId) {
      return PREVIEW_PIPELINES.filter((p) => p.repositoryId === repoId);
    },
    async getBranchProtections(repoId) {
      const repo = PREVIEW_REPOSITORIES.find((r) => r.id === repoId);
      return repo?.protections ?? [];
    },
    async listRecentReleases(repoId) {
      return PREVIEW_RELEASES.filter((r) => r.repositoryId === repoId);
    },
    async recentEvents() {
      return PREVIEW_EVENTS;
    },
    async validate() {
      return { valid: true };
    },
  };
}

// ---------------------------------------------------------------------------
// Readiness scoring — signal-driven, deterministic
// ---------------------------------------------------------------------------

export interface ReadinessScoringInput {
  repositories: Repository[];
  pipelines: Pipeline[];
  recentReleases: Release[];
}

/**
 * Compute readiness signals for a service from repo + pipeline + release data.
 * Signals are deterministic, traceable, and feed dimension scores.
 */
export function computeReadinessSignals(input: ReadinessScoringInput): ReadinessSignal[] {
  const signals: ReadinessSignal[] = [];

  // Branch governance signals
  for (const repo of input.repositories) {
    const defaultProtection = repo.protections.find((p) => p.branch === repo.defaultBranch);
    signals.push({
      source: "github",
      name: `repo:${repo.id}:has_branch_protection`,
      value: Boolean(defaultProtection),
      contribution: defaultProtection ? 0.4 : -0.4,
    });
    signals.push({
      source: "github",
      name: `repo:${repo.id}:required_reviewers`,
      value: defaultProtection?.requiredReviewers ?? 0,
      contribution: (defaultProtection?.requiredReviewers ?? 0) >= 1 ? 0.3 : -0.3,
    });
    signals.push({
      source: "github",
      name: `repo:${repo.id}:linear_history`,
      value: Boolean(defaultProtection?.requireLinearHistory),
      contribution: defaultProtection?.requireLinearHistory ? 0.2 : -0.1,
    });
  }

  // Deployment maturity signals
  const succeeded = input.recentReleases.filter((r) => r.status === "succeeded").length;
  const failed = input.recentReleases.filter((r) => r.status === "failed").length;
  const total = input.recentReleases.length;
  if (total > 0) {
    signals.push({
      source: "github",
      name: "release:success_rate",
      value: succeeded / total,
      contribution: (succeeded / total) * 0.5,
    });
    signals.push({
      source: "github",
      name: "release:failure_count",
      value: failed,
      contribution: failed > 2 ? -0.4 : 0.2,
    });
  }

  // Rollback readiness signals
  const verifiedRollbacks = input.recentReleases.filter((r) => r.rollback?.verified).length;
  signals.push({
    source: "github",
    name: "rollback:verified_rate",
    value: total > 0 ? verifiedRollbacks / total : 0,
    contribution: total > 0 ? (verifiedRollbacks / total) * 0.4 : -0.2,
  });

  return signals;
}

/**
 * Combine signals into per-dimension readiness scores.
 * Scoring is bounded in [0, 1] per dimension.
 */
export function scoreDimensions(signals: ReadinessSignal[]): ReadinessDimensionScore[] {
  const dimensionSignals: Record<string, ReadinessSignal[]> = {
    branch_governance: signals.filter((s) => s.name.startsWith("repo:") && !s.name.includes("rollback")),
    rollback_readiness: signals.filter((s) => s.name.startsWith("rollback:")),
    deployment_maturity: signals.filter((s) => s.name.startsWith("release:")),
  };

  const dims: ReadinessDimensionScore[] = [];
  for (const [key, dimSignals] of Object.entries(dimensionSignals)) {
    if (dimSignals.length === 0) continue;
    const total = dimSignals.reduce((s, sig) => s + sig.contribution, 0);
    // Normalize to [0, 1] via a soft sigmoid-like mapping
    const score = Math.max(0, Math.min(1, 0.5 + total / 4));
    dims.push({
      key: key as ReadinessDimensionScore["key"],
      label: key.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "),
      score,
      detail: `Computed from ${dimSignals.length} signal${dimSignals.length === 1 ? "" : "s"}`,
      signals: dimSignals,
    });
  }
  return dims;
}

/**
 * Build a complete ServiceReadiness from connector output.
 */
export function buildServiceReadiness(
  serviceName: string,
  team: string,
  input: ReadinessScoringInput
): ServiceReadiness {
  const signals = computeReadinessSignals(input);
  const dimensions = scoreDimensions(signals);
  const compositeScore = dimensions.length === 0
    ? 0
    : Math.round((dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length) * 100);

  const recent = input.recentReleases;
  const lastDeploy = recent[0]?.startedAt;
  const successStreak = (() => {
    let streak = 0;
    for (const r of recent) {
      if (r.status === "succeeded") streak++;
      else break;
    }
    return streak;
  })();

  return {
    serviceId: `svc_${serviceName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
    serviceName,
    team,
    environment: "production",
    compositeScore,
    trend: "flat",
    dimensions,
    rollbackVerified: recent[0]?.rollback?.verified ?? false,
    lastDeployedAt: lastDeploy,
    successStreak,
  };
}

// ---------------------------------------------------------------------------
// Preview fixtures
// ---------------------------------------------------------------------------

const PREVIEW_REPOSITORIES: Repository[] = [
  {
    id: "repo_payments_api",
    system: "github",
    organization: "axiom-preview",
    name: "payments-api",
    defaultBranch: "main",
    visibility: "private",
    protections: [
      {
        branch: "main",
        requiredReviewers: 2,
        requireCodeOwnerReviews: true,
        requireLinearHistory: true,
        requireSignedCommits: false,
        requireStatusChecks: ["ci", "tests"],
        enforceAdmins: false,
      },
    ],
    observedAt: new Date().toISOString(),
  },
  {
    id: "repo_checkout_frontend",
    system: "github",
    organization: "axiom-preview",
    name: "checkout-frontend",
    defaultBranch: "main",
    visibility: "private",
    protections: [
      {
        branch: "main",
        requiredReviewers: 1,
        requireCodeOwnerReviews: false,
        requireLinearHistory: false,
        requireSignedCommits: false,
        requireStatusChecks: ["ci"],
        enforceAdmins: false,
      },
    ],
    observedAt: new Date().toISOString(),
  },
];

const PREVIEW_PIPELINES: Pipeline[] = [
  { id: "wf_payments_ci",     system: "github", repositoryId: "repo_payments_api",      name: "CI",     trigger: "push",         environment: undefined,    definitionPath: ".github/workflows/ci.yml",     observedAt: new Date().toISOString() },
  { id: "wf_payments_deploy", system: "github", repositoryId: "repo_payments_api",      name: "Deploy", trigger: "manual",       environment: "production", definitionPath: ".github/workflows/deploy.yml", observedAt: new Date().toISOString() },
  { id: "wf_checkout_deploy", system: "github", repositoryId: "repo_checkout_frontend", name: "Deploy", trigger: "tag",          environment: "production", definitionPath: ".github/workflows/deploy.yml", observedAt: new Date().toISOString() },
];

const PREVIEW_RELEASES: Release[] = [
  {
    id: "rel_pay_001",
    service: "payments-api",
    repositoryId: "repo_payments_api",
    pipelineId: "wf_payments_deploy",
    system: "github",
    environment: "production",
    status: "succeeded",
    ref: "release/v4.12.0",
    commit: "8a92f1c3b4d5e6f7",
    author: "ana.r",
    startedAt: new Date(Date.now() - 86_400_000).toISOString(),
    finishedAt: new Date(Date.now() - 86_400_000 + 600_000).toISOString(),
    durationMs: 600_000,
    readinessScore: 91,
    blastRadius: "contained",
    approvals: [{ id: "ap1", source: "github", approver: "marcus.l", approvedAt: new Date(Date.now() - 86_500_000).toISOString(), required: true }],
    rollback: { verified: true, rtoSec: 47, strategy: "redeploy_prior", priorReleaseId: "rel_pay_000" },
  },
];

const PREVIEW_EVENTS: DeploymentEvent[] = [
  {
    id: "evt_001",
    kind: "release.deployed",
    releaseId: "rel_pay_001",
    serviceId: "svc_payments_api",
    message: "payments-api v4.12.0 deployed to production",
    metadata: { duration_ms: 600000, success_rate: 1 },
    timestamp: new Date(Date.now() - 86_400_000).toISOString(),
  },
];
