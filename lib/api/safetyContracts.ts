/**
 * Canonical API safety contracts.
 *
 * Every typed read-only report on the platform carries a hard-literal
 * `safetyContract` field. This module is the closed enumeration of
 * every legitimate contract — anything outside this union is a type
 * error.
 *
 * Why a closed union: it prevents drift. Adding a new contract is a
 * deliberate edit; renaming an old one breaks every consumer in TS
 * exhaustiveness check, which is exactly what we want.
 */

export type ApiSafetyContract =
  | "axiom_os_state_read_only"
  | "operating_graph_read_only"
  | "integration_health_read_only"
  | "priority_engine_read_only"
  | "next_action_read_only"
  | "executive_summary_read_only"
  | "risk_queue_read_only"
  | "notification_read_only"
  | "scheduled_scan_read_only"
  | "policy_governance_read_only"
  | "approval_only_no_execution"
  | "evidence_library_read_only"
  | "finops_summary_read_only"
  | "root_cause_read_only"
  | "boundaries_declared_no_action_taken"
  | "desktop_review_only_no_local_execution"
  | "setup_review_only_no_execution"
  | "release_review_only_no_publish"
  | "trust_center_read_only"
  | "command_center_read_only"
  | "rbac_never_enables_mutation"
  | "readiness_review_only_no_execution"
  | "audit_read_only"
  | "trace_read_only"
  | "autonomy_gated_no_unsafe_execution";

export const SAFETY_CONTRACT_LABEL: Record<ApiSafetyContract, string> = {
  axiom_os_state_read_only:                "Axiom OS state · read-only",
  operating_graph_read_only:               "Operating Graph · read-only",
  integration_health_read_only:            "Integration health · read-only",
  priority_engine_read_only:               "Priority engine · read-only",
  next_action_read_only:                   "Next-best-action · read-only",
  executive_summary_read_only:             "Executive summary · read-only",
  risk_queue_read_only:                    "Risk queue · read-only",
  notification_read_only:                  "Notifications · read-only",
  scheduled_scan_read_only:                "Scheduled scans · read-only",
  policy_governance_read_only:             "Policy governance · read-only",
  approval_only_no_execution:              "Approval · packet view only",
  evidence_library_read_only:              "Evidence library · read-only",
  finops_summary_read_only:                "FinOps summary · read-only",
  root_cause_read_only:                    "Root causes · read-only",
  boundaries_declared_no_action_taken:     "Automation boundaries · declared only",
  desktop_review_only_no_local_execution:  "Desktop intelligence · review only",
  setup_review_only_no_execution:          "Setup wizard · review only",
  release_review_only_no_publish:          "Desktop releases · review only",
  trust_center_read_only:                  "Trust Center · read-only",
  command_center_read_only:                "Command Center · read-only",
  rbac_never_enables_mutation:             "RBAC · never enables mutation",
  readiness_review_only_no_execution:      "Readiness · review only",
  audit_read_only:                         "Audit log · read-only",
  trace_read_only:                         "Traces · read-only",
  autonomy_gated_no_unsafe_execution:      "Autonomy loop · gated, no unsafe execution",
};

/**
 * Type-safe assertion that a value is a valid ApiSafetyContract. Useful
 * for narrowing arbitrary strings into the union at the API boundary.
 */
export function isApiSafetyContract(value: string): value is ApiSafetyContract {
  return value in SAFETY_CONTRACT_LABEL;
}
