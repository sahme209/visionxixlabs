/**
 * Approval Packet — typed contract.
 *
 * When remediation/simulation requires human approval, the operator
 * receives a complete, understandable packet rather than a bare
 * "approve / reject" button. Every packet bundles:
 *
 *   - what is being requested (sourceSystem + sourceMode)
 *   - the risk that motivated it
 *   - simulation summary (preview only)
 *   - policy decision (governance gate)
 *   - rollback plan + verification checklist
 *   - evidence refs
 *   - desktop review eligibility
 *   - approval readiness state
 *
 * Pure projection over canonical state. Approving a packet from this
 * view never executes anything — it only flips a status in the
 * approval engine (which the existing route already audits).
 */

export type ApprovalReadiness =
  | "ready_for_review"
  | "missing_evidence"
  | "simulation_required"
  | "policy_blocked"
  | "desktop_review_recommended"
  | "blocked_by_config"
  | "disabled_execution";

export type ApprovalRisk = "low" | "medium" | "high" | "critical";

export interface ApprovalPacketEvidenceRef {
  /** Stable evidence id (e.g. axiomOS:approvalPosture). */
  ref: string;
  /** Human label so the operator knows what the ref is. */
  label: string;
}

export interface ApprovalPacket {
  id: string;
  rank: number;

  /** What is being requested — read-only summary. */
  requestedAction: string;
  /** Where the request originates. */
  sourceSystem: string;
  sourceMode: string;

  /** Honest risk classification (consumes priority severity). */
  risk: ApprovalRisk;
  /** Risk summary — one sentence operator-readable. */
  riskSummary: string;

  /** Simulation summary if available (preview only). */
  simulationSummary?: string;
  /** Policy decision from the governance engine. */
  policyDecision: {
    allowed: boolean;
    requiresApproval: boolean;
    reason: string;
  };
  /** Rollback plan — honest. */
  rollbackPlan: {
    available: boolean;
    summary: string;
  };
  /** Verification checklist — honest. */
  verificationChecklist: {
    available: boolean;
    summary: string;
  };

  /** Systems / resources potentially affected. Empty when unknown. */
  affectedSystems: string[];
  /** Expected impact summary (operator-readable). */
  expectedImpact: string;

  /** Approval readiness — drives the action CTA. */
  readiness: ApprovalReadiness;
  /** Why the readiness is what it is. */
  readinessReason: string;

  /** Desktop review eligibility from canonical state. */
  desktopReviewEligible: boolean;

  /** Evidence refs operator can verify. */
  evidence: ApprovalPacketEvidenceRef[];
  /** Honest limitations the operator should see. */
  limitations: string[];

  /** Click-through route to the actual approval queue. */
  reviewRoute: { label: string; href: string };
  /** Backlinks. */
  linkedPriorityId?: string;
  linkedGraphNodeIds: string[];
}

export interface ApprovalPacketReport {
  generatedAt: string;
  tenantId?: string;
  packets: ApprovalPacket[];
  summary: {
    total: number;
    readyForReview: number;
    simulationRequired: number;
    policyBlocked: number;
    desktopReviewRecommended: number;
    missingEvidence: number;
    blockedByConfig: number;
  };
  /** Hard-literal safety contract — never wired to mutation. */
  safetyContract: "approval_only_no_execution";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

export const READINESS_LABEL: Record<ApprovalReadiness, string> = {
  ready_for_review:           "Ready for review",
  missing_evidence:           "Missing evidence",
  simulation_required:        "Simulation required",
  policy_blocked:             "Policy blocked",
  desktop_review_recommended: "Desktop review recommended",
  blocked_by_config:          "Blocked by config",
  disabled_execution:         "Execution disabled",
};

export const RISK_TONE: Record<ApprovalRisk, string> = {
  low:      "bg-zinc-700/40 text-zinc-300",
  medium:   "bg-cyan-500/15 text-cyan-300",
  high:     "bg-amber-500/15 text-amber-300",
  critical: "bg-rose-500/20 text-rose-200",
};
