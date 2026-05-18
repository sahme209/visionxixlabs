/**
 * Setup Wizard — typed contract.
 *
 * Canonical 13-step setup checklist. Each step's status is derived
 * from real signals (AxiomOSState providers, RiskQueue, evidence
 * posture). No fabricated completion claims.
 */

export type SetupStepStatus = "complete" | "in_progress" | "pending" | "blocked" | "skipped";

export type SetupStepId =
  | "workspace_created"
  | "role_context_ready"
  | "aws_setup_reviewed"
  | "aws_validate_attempted"
  | "github_setup_reviewed"
  | "github_validate_attempted"
  | "azure_gcp_reviewed"
  | "desktop_review_explained"
  | "trust_center_reviewed"
  | "first_scan_run"
  | "first_risk_reviewed"
  | "first_remediation_simulation"
  | "evidence_export_reviewed";

export interface SetupStep {
  id: SetupStepId;
  /** Human label. */
  label: string;
  /** What this step means operationally. */
  description: string;
  status: SetupStepStatus;
  sourceMode: string;
  /** Why this step has the status it has. */
  reason: string;
  /** Where the operator goes to complete this step. */
  route: { label: string; href: string };
  /** Optional docs link. */
  docsLink?: { label: string; href: string };
  /** Honest blocker when status === "blocked". */
  blocker?: string;
  /** Limitations on this step. */
  limitations: string[];
  /** Evidence ref the operator can verify. */
  evidenceRef: string;
}

export interface SetupWizardReport {
  generatedAt: string;
  tenantId?: string;
  steps: SetupStep[];
  summary: {
    total: number;
    complete: number;
    inProgress: number;
    pending: number;
    blocked: number;
    skipped: number;
    /** 0..1 completion ratio. */
    completionRatio: number;
  };
  /** Hard literal — wizard reviews status, never executes setup itself. */
  safetyContract: "setup_review_only_no_execution";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

export const STATUS_TONE: Record<SetupStepStatus, "emerald" | "cyan" | "amber" | "rose" | "zinc"> = {
  complete:    "emerald",
  in_progress: "cyan",
  pending:     "amber",
  blocked:     "rose",
  skipped:     "zinc",
};

export const STATUS_LABEL: Record<SetupStepStatus, string> = {
  complete:    "Complete",
  in_progress: "In progress",
  pending:     "Pending",
  blocked:     "Blocked",
  skipped:     "Skipped",
};
