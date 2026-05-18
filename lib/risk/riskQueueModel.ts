/**
 * Risk Queue — typed contract.
 *
 * The Risk Queue is the operator-facing aggregation of all actionable
 * operational risks. Each item is derived from canonical signals
 * (security findings, integration blockers, policy violations,
 * readiness blockers) and carries ownership, status, and explicit
 * linked-object refs.
 *
 * No fabricated "resolved" or "applied" state — statuses always
 * reflect canonical reality.
 */

export type RiskStatus =
  | "open"
  | "investigating"
  | "remediation_prepared"
  | "simulation_ready"
  | "approval_required"
  | "accepted_risk"
  | "blocked"
  | "resolved_simulated"   // resolved on the digital twin only
  | "closed";

export type RiskOwnerRole =
  | "security_reviewer"
  | "cloud_engineer"
  | "release_manager"
  | "admin"
  | "owner"
  | "unassigned";

export type RiskCategory =
  | "security_finding"
  | "release_blocker"
  | "integration_blocker"
  | "policy_violation"
  | "readiness_blocker"
  | "desktop_blocker"
  | "scheduled_scan_failure"
  | "operational_drift";

export type RiskSeverity = "critical" | "high" | "medium" | "low" | "info";

export type RiskSourceMode =
  | "live" | "partial_live" | "preview" | "foundation"
  | "planned" | "blocked" | "disabled" | "unknown";

export interface RiskItem {
  id: string;
  rank: number;

  title: string;
  description: string;

  sourceSystem: string;
  sourceMode: RiskSourceMode;

  severity: RiskSeverity;
  category: RiskCategory;
  affectedSystem?: string;

  /** Canonical state-machine status. Cannot be fabricated forward. */
  status: RiskStatus;
  /** Suggested role to own this item — never auto-assigned. */
  ownerRole: RiskOwnerRole;

  evidenceRefs: string[];
  linkedFindingId?: string;
  linkedRemediationId?: string;
  linkedSimulationId?: string;
  linkedApprovalId?: string;
  linkedGraphNodeIds: string[];

  /** Honest first-seen timestamp from canonical generatedAt. */
  firstSeenAt: string;
  /** Honest last-seen timestamp from canonical generatedAt. */
  lastSeenAt: string;

  /** Optional honest "suspected cause" line. Never claimed as proven. */
  suspectedCause?: string;
  /** Operator-readable summary of why this matters. */
  whyItMatters: string;

  safeNextAction: { label: string; href: string };
  /** Where the operator drills in. */
  route?: string;
  /** Honest limitations on the item. */
  limitations: string[];
}

export interface RiskQueueReport {
  generatedAt: string;
  tenantId?: string;
  items: RiskItem[];
  summary: {
    total: number;
    open: number;
    investigating: number;
    remediationPrepared: number;
    simulationReady: number;
    approvalRequired: number;
    blocked: number;
    resolvedSimulated: number;
    closed: number;
    /** Severity rollup. */
    bySeverity: Record<RiskSeverity, number>;
    /** Category rollup. */
    byCategory: Record<RiskCategory, number>;
  };
  overallSourceMode: RiskSourceMode;
  limitations: string[];
  safeNextAction: { label: string; href: string };
  /** Hard-literal — the queue never executes mutations. */
  safetyContract: "risk_review_only_no_execution";
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

export const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  open:                 "Open",
  investigating:        "Investigating",
  remediation_prepared: "Remediation prepared",
  simulation_ready:     "Simulation ready",
  approval_required:    "Approval required",
  accepted_risk:        "Accepted risk",
  blocked:              "Blocked",
  resolved_simulated:   "Resolved · simulated only",
  closed:               "Closed",
};

export const RISK_STATUS_TONE: Record<RiskStatus, "emerald" | "cyan" | "amber" | "violet" | "rose" | "zinc"> = {
  open:                 "amber",
  investigating:        "cyan",
  remediation_prepared: "violet",
  simulation_ready:     "violet",
  approval_required:    "amber",
  accepted_risk:        "zinc",
  blocked:              "rose",
  resolved_simulated:   "emerald",
  closed:               "zinc",
};

export const RISK_CATEGORY_LABEL: Record<RiskCategory, string> = {
  security_finding:        "Security finding",
  release_blocker:         "Release blocker",
  integration_blocker:     "Integration blocker",
  policy_violation:        "Policy violation",
  readiness_blocker:       "Readiness blocker",
  desktop_blocker:         "Desktop blocker",
  scheduled_scan_failure:  "Scheduled scan failure",
  operational_drift:       "Operational drift",
};
