/**
 * Desktop Intelligence Workstation — typed contract.
 *
 * The Desktop Intelligence Workstation is the operator's enriched view
 * of every item that ought to be reviewed on the desktop. It joins:
 *
 *   - PriorityReport       → rank, severity, urgency, score breakdown
 *   - ApprovalPacketReport → readiness, packet linkage
 *   - AutomationBoundary   → hard-literal automation classification
 *   - DesktopPosture       → pairing + binary availability state
 *
 * Every record is read-only. Approving / executing never happens from
 * this view — the operator hands the item to the desktop via the
 * existing handoff endpoint, which the runtime audits. The web layer
 * never executes locally; that boundary is enforced both at the type
 * level (`safetyContract: "desktop_review_only_no_local_execution"`)
 * and via the AutomationBoundary detector entry for
 * `desktop_local_execute = unsafe_never_automate`.
 */

import type { ApprovalReadiness } from "@/lib/intelligence/approvalPacketModel";
import type { BoundaryClassification } from "@/lib/safety/automationBoundaryModel";

export type DesktopReviewSourceMode =
  | "live"
  | "partial_live"
  | "preview"
  | "foundation"
  | "planned"
  | "blocked"
  | "disabled"
  | "unknown";

export type DesktopReviewSeverity = "critical" | "high" | "medium" | "low" | "info";

export type DesktopReviewCategory =
  | "approval_packet"
  | "security_finding"
  | "remediation_candidate"
  | "release_blocker"
  | "policy_violation"
  | "integration_blocker"
  | "operational_drift";

export type DesktopReviewStatus =
  | "ready_for_handoff"
  | "awaiting_simulation"
  | "policy_blocked"
  | "missing_evidence"
  | "blocked_by_pairing"
  | "blocked_by_config"
  | "disabled_local_execution";

export interface DesktopReviewItem {
  id: string;
  rank: number;
  title: string;
  summary: string;
  category: DesktopReviewCategory;
  severity: DesktopReviewSeverity;
  sourceSystem: string;
  sourceMode: DesktopReviewSourceMode;

  /** Composite priority score (0..100) from the priority engine. */
  priorityScore: number;
  /** Original priority id this item is enriched from. */
  linkedPriorityId?: string;
  /** Approval packet id when one exists. */
  linkedApprovalPacketId?: string;
  /** Operating graph nodes this item ties back to. */
  linkedGraphNodeIds: string[];

  /** Approval readiness — surfaced even for non-packet items as `null`. */
  approvalReadiness?: ApprovalReadiness;
  /** Automation boundary classification for the action class this item maps to. */
  automationClassification: BoundaryClassification;
  /** Operator-readable status that drives the CTA. */
  status: DesktopReviewStatus;
  /** Why the status is what it is — operator-readable. */
  statusReason: string;

  /** Honest impact / scope summary. */
  expectedImpact: string;
  /** Systems / resources potentially affected. */
  affectedSystems: string[];

  /** Evidence refs the operator can verify before handing off. */
  evidenceRefs: string[];
  /** Honest limitations operator should see. */
  limitations: string[];

  /** Route to open the source view (where the artefact lives). */
  inspectRoute: { label: string; href: string };
  /** Route to start the desktop handoff (pairing required). */
  handoffRoute: { label: string; href: string };
}

export interface DesktopIntelligencePairing {
  /** True when binary is signed/published and a paired session exists. */
  paired: boolean;
  /** True when handoff signing key is configured. */
  signingKeyConfigured: boolean;
  /** Honest binary availability flag. */
  binaryAvailable: boolean;
  /** signed_notarized / signed / unsigned / preview. */
  signingStatus: "signed_notarized" | "signed" | "unsigned" | "preview";
  /** Recommended next step for pairing. */
  safeNextAction: { label: string; href: string };
  /** Honest limitations of the pairing state. */
  limitations: string[];
}

export interface DesktopIntelligenceReport {
  generatedAt: string;
  tenantId?: string;
  pairing: DesktopIntelligencePairing;
  items: DesktopReviewItem[];
  summary: {
    total: number;
    readyForHandoff: number;
    awaitingSimulation: number;
    policyBlocked: number;
    missingEvidence: number;
    blockedByPairing: number;
    blockedByConfig: number;
    disabledLocalExecution: number;
    bySeverity: Record<DesktopReviewSeverity, number>;
    byCategory: Record<DesktopReviewCategory, number>;
  };
  /** Hard-literal safety contract. */
  safetyContract: "desktop_review_only_no_local_execution";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Visual helpers — read by the page so labels never drift from the model
// ---------------------------------------------------------------------------

export const DESKTOP_STATUS_LABEL: Record<DesktopReviewStatus, string> = {
  ready_for_handoff:         "Ready for desktop handoff",
  awaiting_simulation:       "Awaiting simulation",
  policy_blocked:            "Policy blocked",
  missing_evidence:          "Missing evidence",
  blocked_by_pairing:        "Blocked — desktop not paired",
  blocked_by_config:         "Blocked by configuration",
  disabled_local_execution:  "Disabled — local execution off",
};

export const DESKTOP_STATUS_TONE: Record<DesktopReviewStatus, "emerald" | "cyan" | "amber" | "rose" | "violet" | "zinc"> = {
  ready_for_handoff:         "emerald",
  awaiting_simulation:       "cyan",
  policy_blocked:            "amber",
  missing_evidence:          "amber",
  blocked_by_pairing:        "violet",
  blocked_by_config:         "rose",
  disabled_local_execution:  "rose",
};

export const DESKTOP_CATEGORY_LABEL: Record<DesktopReviewCategory, string> = {
  approval_packet:        "Approval packet",
  security_finding:       "Security finding",
  remediation_candidate:  "Remediation candidate",
  release_blocker:        "Release blocker",
  policy_violation:       "Policy violation",
  integration_blocker:    "Integration blocker",
  operational_drift:      "Operational drift",
};
