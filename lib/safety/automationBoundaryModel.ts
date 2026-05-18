/**
 * Automation Boundary Detector — typed contract.
 *
 * Single canonical model of every operational action class and its
 * hard-literal safety classification. This is the spine the entire
 * platform leans on to refuse unsafe automation.
 *
 * The union is closed: adding a new action class requires updating the
 * boundary explicitly. There is no "default to unsafe" path because
 * unknown classes simply do not exist in the type system.
 */

export type AutomationActionClass =
  // ----- READ-ONLY -----
  | "axiom_os_state_fetch"
  | "operating_graph_fetch"
  | "integration_health_fetch"
  | "priority_fetch"
  | "next_action_fetch"
  | "executive_summary_fetch"
  | "trust_summary_fetch"
  | "audit_event_list"
  | "evidence_list"
  // ----- READ-ONLY EXTERNAL (scans / syncs) -----
  | "aws_validate"
  | "aws_readonly_scan"
  | "github_validate"
  | "github_readonly_sync"
  | "azure_validate"
  | "gcp_validate"
  | "security_scan_run"
  // ----- PREVIEW / SIMULATION (no real-world side effects) -----
  | "remediation_plan_build"
  | "simulation_create"
  | "terraform_plan_generate"
  | "cli_preview_generate"
  | "rollback_plan_generate"
  | "verification_checklist_generate"
  // ----- DESKTOP REVIEW -----
  | "desktop_pair_session"
  | "desktop_receive_handoff"
  | "desktop_review_item"
  | "desktop_local_execute" // hard-blocked
  // ----- APPROVAL FLOW -----
  | "approval_request_create"
  | "approval_decide_in_engine"
  | "approval_packet_view"
  // ----- AUDIT / EVIDENCE -----
  | "audit_event_emit"
  | "evidence_record_create"
  | "evidence_export_bundle"
  // ----- BLOCKED MUTATION CLASSES -----
  | "terraform_apply"           // hard-blocked
  | "cli_apply"                 // hard-blocked
  | "aws_resource_mutation"     // hard-blocked
  | "azure_resource_mutation"   // hard-blocked
  | "gcp_resource_mutation"     // hard-blocked
  | "github_repo_mutation"      // hard-blocked
  | "github_workflow_mutation"  // hard-blocked
  | "credential_export"         // hard-blocked
  | "privilege_escalation"      // hard-blocked
  | "autonomy_self_escalation"; // hard-blocked

export type BoundaryClassification =
  | "readonly_allowed"
  | "preview_allowed"
  | "simulation_allowed"
  | "desktop_review_allowed"
  | "approval_required"
  | "disabled_until_policy"
  | "disabled_until_credentials"
  | "unsafe_never_automate";

export interface AutomationBoundaryEntry {
  actionClass: AutomationActionClass;
  classification: BoundaryClassification;
  /** Human-readable label. */
  label: string;
  /** What this action class does. */
  description: string;
  /** Why this classification — operator-readable. */
  reason: string;
  /** Implementation surface — file path / route. */
  surface: string;
  /** Evidence ref proving the boundary is enforced (e.g. file:line). */
  evidenceRef: string;
}

export interface AutomationBoundaryReport {
  generatedAt: string;
  entries: AutomationBoundaryEntry[];
  summary: {
    total: number;
    readonly: number;
    preview: number;
    simulation: number;
    desktopReview: number;
    approvalRequired: number;
    disabledUntilPolicy: number;
    disabledUntilCredentials: number;
    unsafeNeverAutomate: number;
  };
  /** Hard-literal: this engine never returns "execute_allowed". */
  safetyContract: "boundaries_declared_no_action_taken";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

export const CLASSIFICATION_LABEL: Record<BoundaryClassification, string> = {
  readonly_allowed:            "Read-only · allowed",
  preview_allowed:             "Preview · allowed",
  simulation_allowed:          "Simulation · allowed",
  desktop_review_allowed:      "Desktop review · allowed",
  approval_required:           "Approval · required",
  disabled_until_policy:       "Disabled · until policy",
  disabled_until_credentials:  "Disabled · until credentials",
  unsafe_never_automate:       "Unsafe · never automate",
};

export const CLASSIFICATION_TONE: Record<BoundaryClassification, "emerald" | "cyan" | "violet" | "amber" | "rose" | "zinc"> = {
  readonly_allowed:            "emerald",
  preview_allowed:             "cyan",
  simulation_allowed:          "cyan",
  desktop_review_allowed:      "violet",
  approval_required:           "amber",
  disabled_until_policy:       "amber",
  disabled_until_credentials:  "amber",
  unsafe_never_automate:       "rose",
};
