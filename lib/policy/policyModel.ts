/**
 * Policy Governance Engine — typed contract.
 *
 * Single canonical policy registry the platform leans on. Each policy
 * is a declarative rule that pure-function policy evaluators check
 * against operational requests. The registry is intentionally a closed
 * set — adding a policy requires updating the literal union, which TS
 * exhaustiveness enforces across consumers.
 */

export type PolicyCategory =
  | "read_only_enforcement"
  | "approval_required"
  | "no_mutation"
  | "no_desktop_execution"
  | "evidence_required"
  | "sourceMode_required"
  | "trust_boundary"
  | "credential_safety"
  | "export_control"
  | "role_permission"
  | "scheduled_scan_safety";

export type PolicyEnforcement =
  | "enforced_always"      // hard-blocks any violating action
  | "enforced_with_audit"  // allowed, but writes an audit record
  | "advisory"             // surfaces a warning, doesn't block
  | "disabled";            // declared but not active yet

export type PolicySeverity = "critical" | "high" | "medium" | "low";

export interface PolicyRecord {
  id: string;
  category: PolicyCategory;
  enforcement: PolicyEnforcement;
  severity: PolicySeverity;
  /** Operator-readable title. */
  title: string;
  /** What this policy does. */
  description: string;
  /** Why this policy exists. */
  rationale: string;
  /** Which surfaces the policy applies to (e.g. remediation, approvals). */
  appliesTo: string[];
  /** What gets blocked when a request would violate the policy. */
  blockedActions: string[];
  /** Evidence ref the operator can audit (file:identifier). */
  evidenceRef: string;
}

export type PolicyDecisionKind =
  | "allowed"
  | "blocked"
  | "requires_approval"
  | "preview_only"
  | "disabled"
  | "missing_permission"
  | "missing_evidence";

export interface PolicyDecision {
  policyId: string;
  decision: PolicyDecisionKind;
  reason: string;
  sourceMode: string;
  evidenceRefs: string[];
  limitations: string[];
  safeNextAction?: { label: string; href: string };
}

export interface PolicyEvaluationRequest {
  /** What the operator is trying to do — must be from the closed list. */
  action:
    | "remediation_plan_build"
    | "simulation_create"
    | "approval_request_create"
    | "approval_decide"
    | "desktop_handoff_create"
    | "evidence_export"
    | "scheduled_scan_run"
    | "credential_access"
    | "mutation_request";
  /** Where the action is coming from. */
  sourceSystem?: string;
  /** Source mode of the underlying data. */
  sourceMode?: string;
}

export interface PolicyEvaluationResult {
  decisions: PolicyDecision[];
  /** Aggregate verdict: blocked > requires_approval > preview_only > allowed. */
  overallDecision: PolicyDecisionKind;
  /** Honest summary of what the operator can do next. */
  safeNextAction: { label: string; href: string };
}

export interface PolicyReport {
  generatedAt: string;
  policies: PolicyRecord[];
  summary: {
    total: number;
    enforcedAlways: number;
    enforcedWithAudit: number;
    advisory: number;
    disabled: number;
    byCategory: Record<PolicyCategory, number>;
  };
  /** Hard literal — declaring a policy does not enable execution. */
  safetyContract: "policies_declared_no_action_taken";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

export const ENFORCEMENT_LABEL: Record<PolicyEnforcement, string> = {
  enforced_always:     "Enforced always",
  enforced_with_audit: "Enforced · audit",
  advisory:            "Advisory",
  disabled:            "Disabled",
};

export const ENFORCEMENT_TONE: Record<PolicyEnforcement, "emerald" | "cyan" | "amber" | "zinc"> = {
  enforced_always:     "emerald",
  enforced_with_audit: "cyan",
  advisory:            "amber",
  disabled:            "zinc",
};

export const CATEGORY_LABEL: Record<PolicyCategory, string> = {
  read_only_enforcement: "Read-only enforcement",
  approval_required:     "Approval required",
  no_mutation:           "No mutation",
  no_desktop_execution:  "No desktop execution",
  evidence_required:     "Evidence required",
  sourceMode_required:   "Source mode required",
  trust_boundary:        "Trust boundary",
  credential_safety:     "Credential safety",
  export_control:        "Export control",
  role_permission:       "Role permission",
  scheduled_scan_safety: "Scheduled scan safety",
};
