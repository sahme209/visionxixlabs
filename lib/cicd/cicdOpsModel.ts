/**
 * CI/CD Live Operations — typed contract.
 *
 * Canonical model for every pipeline operation Axiom can perform
 * across CI/CD providers (GitHub Actions, GitLab CI, AWS CodePipeline,
 * GCP Cloud Build, Azure DevOps). Operations are typed at three
 * levels:
 *
 *   - status read    (always allowed — purely observational)
 *   - policy-gated   (trigger workflow, gate deploy, rerun) — every
 *                      mutation routes through approval + boundary
 *   - hard-blocked   (force-merge, delete tag, push to protected
 *                      ref) — never automatable
 *
 * No SDK calls execute from this model — the operation is declared,
 * the policy decides, the autonomy loop hands intent to the desktop
 * runtime. safetyContract literal 'cicd_ops_gated_no_unsafe_execution'.
 */

export type CicdProvider =
  | "github_actions"
  | "gitlab_ci"
  | "aws_codepipeline"
  | "gcp_cloud_build"
  | "azure_devops"
  | "circleci"
  | "jenkins";

export type CicdSourceMode =
  | "live"
  | "partial_live"
  | "preview"
  | "blocked"
  | "disabled"
  | "unknown";

export type PipelineStatus =
  | "running"
  | "success"
  | "failed"
  | "canceled"
  | "timed_out"
  | "queued"
  | "blocked_by_policy"
  | "preview"
  | "unknown";

export type CicdOperationKind =
  // Read-only
  | "list_pipelines"
  | "describe_run"
  | "fetch_logs"
  | "fetch_artifact_manifest"
  // Policy-gated
  | "trigger_workflow"
  | "rerun_workflow"
  | "cancel_run"
  | "approve_environment"
  | "gate_deploy"
  | "rollback_deploy"
  | "promote_artifact"
  // Hard-blocked (declared, never automated)
  | "force_merge"
  | "delete_tag"
  | "push_protected_ref"
  | "rotate_signing_key"
  | "modify_workflow_yaml";

export type CicdOperationClassification =
  | "readonly_allowed"
  | "policy_gated"
  | "approval_required"
  | "desktop_review_required"
  | "unsafe_never_automate"
  | "disabled_until_policy"
  | "disabled_until_credentials";

export interface CicdOperation {
  kind: CicdOperationKind;
  classification: CicdOperationClassification;
  label: string;
  description: string;
  /** When classification is policy_gated, the required policy id. */
  requiredPolicyId?: string;
  /** Audit event kind emitted on every attempt (allowed or refused). */
  auditEventKind: string;
  /** Operator-readable rationale. */
  rationale: string;
  /** Evidence ref proving the gate. */
  evidenceRef: string;
}

export interface PipelineRun {
  id: string;
  provider: CicdProvider;
  /** Repo / project / pipeline slug. */
  repo: string;
  workflow: string;
  branch: string;
  commit: string;
  status: PipelineStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  triggeredBy?: string;
  /** Honest preview literal when not actually live. */
  sourceMode: CicdSourceMode;
  /** External console / dashboard link. */
  externalRunHref?: string;
}

export interface CicdProviderPosture {
  provider: CicdProvider;
  mode: CicdSourceMode;
  configured: boolean;
  headline: string;
  /** Operator-readable list of what still needs to land for live. */
  missingRequirements: string[];
  recentRuns: PipelineRun[];
  /** Operator-actionable next-step route. */
  safeNextAction: { label: string; href: string };
}

export interface CicdOpsReport {
  generatedAt: string;
  tenantId?: string;
  providers: CicdProviderPosture[];
  operations: CicdOperation[];
  summary: {
    providerCount: number;
    liveProviderCount: number;
    runsTotal: number;
    runsRunning: number;
    runsFailed: number;
    runsSuccess: number;
    operationsTotal: number;
    operationsReadonly: number;
    operationsPolicyGated: number;
    operationsApprovalRequired: number;
    operationsDesktopReview: number;
    operationsHardBlocked: number;
  };
  overallSourceMode: CicdSourceMode;
  /** Hard-literal contract. */
  safetyContract: "cicd_ops_gated_no_unsafe_execution";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

export const CICD_PROVIDER_LABEL: Record<CicdProvider, string> = {
  github_actions:   "GitHub Actions",
  gitlab_ci:        "GitLab CI",
  aws_codepipeline: "AWS CodePipeline",
  gcp_cloud_build:  "GCP Cloud Build",
  azure_devops:     "Azure DevOps",
  circleci:         "CircleCI",
  jenkins:          "Jenkins",
};

export const PIPELINE_STATUS_LABEL: Record<PipelineStatus, string> = {
  running:           "Running",
  success:           "Success",
  failed:            "Failed",
  canceled:          "Canceled",
  timed_out:         "Timed out",
  queued:            "Queued",
  blocked_by_policy: "Blocked · policy",
  preview:           "Preview",
  unknown:           "Unknown",
};

export const PIPELINE_STATUS_TONE: Record<PipelineStatus, "emerald" | "rose" | "cyan" | "amber" | "violet" | "zinc"> = {
  running:           "cyan",
  success:           "emerald",
  failed:            "rose",
  canceled:          "zinc",
  timed_out:         "rose",
  queued:            "cyan",
  blocked_by_policy: "amber",
  preview:           "violet",
  unknown:           "zinc",
};

export const CICD_CLASSIFICATION_LABEL: Record<CicdOperationClassification, string> = {
  readonly_allowed:            "Read-only · allowed",
  policy_gated:                "Policy-gated",
  approval_required:           "Approval required",
  desktop_review_required:     "Desktop review required",
  unsafe_never_automate:       "Unsafe · never automate",
  disabled_until_policy:       "Disabled · until policy",
  disabled_until_credentials:  "Disabled · until credentials",
};

export const CICD_CLASSIFICATION_TONE: Record<CicdOperationClassification, "emerald" | "cyan" | "amber" | "violet" | "rose" | "zinc"> = {
  readonly_allowed:            "emerald",
  policy_gated:                "cyan",
  approval_required:           "amber",
  desktop_review_required:     "violet",
  unsafe_never_automate:       "rose",
  disabled_until_policy:       "amber",
  disabled_until_credentials:  "amber",
};
