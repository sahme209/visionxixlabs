/**
 * ReleaseOps data model — typed contracts for deployment intelligence.
 *
 * Repository → pipeline → environment → release flow lives here. Connector
 * adapters (GitHub, GitLab, Azure DevOps, Jenkins, ArgoCD, ServiceNow) emit
 * data conforming to this shape; UI components consume it.
 */

import type { ResourceRef } from "@/lib/cloud/snapshotModel";

export type ReleaseSystemId = "github" | "gitlab" | "azure_devops" | "jenkins" | "argocd" | "servicenow";

export type EnvironmentName = "production" | "staging" | "development" | "qa";

// ---------------------------------------------------------------------------
// Repository + pipeline inventory
// ---------------------------------------------------------------------------

export interface Repository {
  id: string;                       // System-specific repo identifier
  system: ReleaseSystemId;
  organization: string;             // GitHub org / GitLab group / ADO project
  name: string;
  defaultBranch: string;
  visibility: "public" | "private" | "internal";
  /** Branch protection rules. */
  protections: BranchProtection[];
  /** When this repo was discovered/refreshed. */
  observedAt: string;
}

export interface BranchProtection {
  branch: string;                   // Branch glob (main, release/*, etc.)
  requiredReviewers: number;
  requireCodeOwnerReviews: boolean;
  requireLinearHistory: boolean;
  requireSignedCommits: boolean;
  requireStatusChecks: string[];
  enforceAdmins: boolean;
}

export interface Pipeline {
  id: string;
  system: ReleaseSystemId;
  repositoryId: string;
  name: string;                     // Workflow name / pipeline name
  trigger: "push" | "pull_request" | "manual" | "schedule" | "tag" | "release";
  /** Target environment this pipeline deploys to (if any). */
  environment?: EnvironmentName;
  /** File path where the pipeline is defined (.github/workflows/x.yml, etc.) */
  definitionPath?: string;
  observedAt: string;
}

// ---------------------------------------------------------------------------
// Releases + deployments
// ---------------------------------------------------------------------------

export type ReleaseStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "blocked"
  | "awaiting_approval"
  | "rolled_back"
  | "cancelled";

export interface Release {
  id: string;
  service: string;                  // Logical service name
  repositoryId: string;
  pipelineId: string;
  system: ReleaseSystemId;
  environment: EnvironmentName;
  status: ReleaseStatus;
  ref: string;                      // Branch / tag
  commit: string;                   // SHA
  author: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  /** Composite readiness score at time of release (0–100). */
  readinessScore?: number;
  /** Risk classification at the time of release. */
  blastRadius?: "contained" | "moderate" | "broad";
  /** Approvals attached to this release (across systems — ServiceNow CR, GitHub review, etc.). */
  approvals: ReleaseApproval[];
  /** Cloud resources affected (cross-reference into the cloud topology). */
  affectedCloudResources?: ResourceRef[];
  /** Rollback strategy for this release. */
  rollback?: ReleaseRollback;
}

export interface ReleaseApproval {
  id: string;
  source: ReleaseSystemId;
  approver: string;
  approvedAt?: string;
  required: boolean;
  /** Free-text note from approver. */
  note?: string;
}

export interface ReleaseRollback {
  /** Is a rollback path verified before release? */
  verified: boolean;
  /** Measured time-to-restore in seconds. */
  rtoSec?: number;
  /** Strategy: revert commit, redeploy prior tag, restore snapshot, etc. */
  strategy: "revert_commit" | "redeploy_prior" | "snapshot_restore" | "manual" | "none";
  /** ID of the prior known-good release to roll back to. */
  priorReleaseId?: string;
}

// ---------------------------------------------------------------------------
// Readiness scoring
// ---------------------------------------------------------------------------

export type ReadinessDimensionKey =
  | "branch_governance"
  | "rollback_readiness"
  | "observability"
  | "deployment_maturity"
  | "operational_coordination"
  | "release_auditability"
  | "terraform_governance"
  | "infrastructure_drift"
  | "release_communication";

export interface ReadinessDimensionScore {
  key: ReadinessDimensionKey;
  label: string;
  score: number;                    // 0–1
  detail: string;
  /** Signals that drove this score. Audit-traceable. */
  signals?: ReadinessSignal[];
}

export interface ReadinessSignal {
  source: ReleaseSystemId;
  name: string;
  value: string | number | boolean;
  contribution: number;             // [-1, 1] — how much this signal moved the score
}

export interface ServiceReadiness {
  serviceId: string;
  serviceName: string;
  team: string;
  environment: EnvironmentName;
  compositeScore: number;           // 0–100
  trend: "up" | "down" | "flat";
  trendDelta?: string;              // "+4 pts this month"
  dimensions: ReadinessDimensionScore[];
  rollbackVerified: boolean;
  lastDeployedAt?: string;
  lastIncidentAt?: string;
  /** Number of consecutive successful deploys. Drives auto-apply eligibility. */
  successStreak?: number;
}

// ---------------------------------------------------------------------------
// Deployment governance + events
// ---------------------------------------------------------------------------

export type DeploymentEventKind =
  | "release.queued"
  | "release.started"
  | "release.approval_pending"
  | "release.approved"
  | "release.blocked"               // Blocked at governance gate
  | "release.deployed"
  | "release.failed"
  | "release.rolled_back"
  | "release.verified"
  | "release.drift_detected"
  | "release.terraform_plan"
  | "release.servicenow_synced"
  | "release.readiness_updated"
  | "release.dependency_conflict";

export interface DeploymentEvent {
  id: string;
  kind: DeploymentEventKind;
  releaseId?: string;
  serviceId?: string;
  message: string;
  metadata: Record<string, string | number | boolean>;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DIMENSION_LABELS: Record<ReadinessDimensionKey, string> = {
  branch_governance: "Branch governance",
  rollback_readiness: "Rollback readiness",
  observability: "Observability",
  deployment_maturity: "Deployment maturity",
  operational_coordination: "Operational coordination",
  release_auditability: "Release auditability",
  terraform_governance: "Terraform governance",
  infrastructure_drift: "Infrastructure drift",
  release_communication: "Release communication",
};

/** Convert a dimension key into a human label. */
export function dimensionLabel(key: ReadinessDimensionKey): string {
  return DIMENSION_LABELS[key];
}

/** Compute composite readiness score from dimensions (equal-weighted average × 100). */
export function computeCompositeScore(dimensions: ReadinessDimensionScore[]): number {
  if (dimensions.length === 0) return 0;
  const avg = dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length;
  return Math.round(avg * 100);
}

/** Filter releases by environment. */
export function filterByEnvironment(releases: Release[], env: EnvironmentName): Release[] {
  return releases.filter((r) => r.environment === env);
}

/** Group releases by service. */
export function groupByService(releases: Release[]): Record<string, Release[]> {
  return releases.reduce(
    (acc, r) => {
      (acc[r.service] ??= []).push(r);
      return acc;
    },
    {} as Record<string, Release[]>
  );
}
