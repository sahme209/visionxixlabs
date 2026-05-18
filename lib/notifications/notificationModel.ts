/**
 * Notification Center — typed contract.
 *
 * Notifications are derived from real canonical events:
 * integration_failed / recovered, risk_created, approval_required,
 * scan failures, readiness blockers, etc.
 *
 * No fabricated noise. Every notification carries source / sourceMode
 * / evidence / safeNextAction / read-only contract.
 */

export type NotificationType =
  | "integration_failed"
  | "integration_recovered"
  | "scan_completed"
  | "scan_failed"
  | "security_finding_detected"
  | "release_blocker_detected"
  | "risk_created"
  | "remediation_ready"
  | "simulation_ready"
  | "approval_required"
  | "approval_decided"
  | "desktop_handoff_ready"
  | "evidence_export_ready"
  | "readiness_blocker"
  | "policy_violation"
  | "scheduled_scan_failed";

export type NotificationSeverity = "info" | "warning" | "critical";

export type NotificationSourceMode =
  | "live" | "partial_live" | "preview" | "foundation"
  | "planned" | "blocked" | "disabled" | "unknown";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  /** When the notification was synthesized (canonical generatedAt). */
  createdAt: string;
  /** Operator-readable title. */
  title: string;
  /** One-paragraph description. */
  description: string;
  /** Source system that emitted the signal. */
  sourceSystem: string;
  sourceMode: NotificationSourceMode;
  /** Always present — clicking opens the relevant page. */
  route: { label: string; href: string };
  /** Operator's next safe step. */
  safeNextAction?: { label: string; href: string };
  /** Backlinks. */
  linkedObjectType?: string;
  linkedObjectId?: string;
  evidenceRefs: string[];
  limitations: string[];
}

export interface NotificationReport {
  generatedAt: string;
  tenantId?: string;
  notifications: NotificationItem[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    byType: Record<string, number>;
  };
  /** Hard literal — derived notifications never trigger downstream actions. */
  safetyContract: "notifications_review_only_no_action_taken";
  /** Honest "no historical history" disclaimer until persistence is wired. */
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

export const TYPE_LABEL: Record<NotificationType, string> = {
  integration_failed:        "Integration failed",
  integration_recovered:     "Integration recovered",
  scan_completed:            "Scan completed",
  scan_failed:               "Scan failed",
  security_finding_detected: "Security finding detected",
  release_blocker_detected:  "Release blocker detected",
  risk_created:              "Risk created",
  remediation_ready:         "Remediation ready",
  simulation_ready:          "Simulation ready",
  approval_required:         "Approval required",
  approval_decided:          "Approval decided",
  desktop_handoff_ready:     "Desktop handoff ready",
  evidence_export_ready:     "Evidence export ready",
  readiness_blocker:         "Readiness blocker",
  policy_violation:          "Policy violation",
  scheduled_scan_failed:     "Scheduled scan failed",
};
