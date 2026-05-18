/**
 * Closed-Loop Remediation — typed contract.
 *
 * Completes the AGI cycle. Where the Autonomy Loop declares intent,
 * Closed-Loop Remediation **verifies after-state**: it pairs each
 * approved+executed remediation with a typed verification probe and
 * records whether the change actually solved the original signal.
 *
 * The model is the bridge between every other system:
 *
 *   PriorityReport / RiskQueue   → input candidate
 *   ApprovalPacketReport         → governance + risk classification
 *   AutomationBoundaryReport     → hard-literal safety classification
 *   DesktopIntelligenceReport    → execution handoff state
 *   TelemetryIngestReport        → after-state probe signals
 *   IncidentResponseReport       → after-state pager closure
 *
 * One typed ClosedLoopRecord per remediation cycle: input → simulated
 * → policy decided → approved → executed (on desktop) → verified →
 * audited. Verification is **independent telemetry**, not the same
 * agent that proposed the change.
 *
 * safetyContract literal 'closed_loop_remediation_gated'.
 */

export type ClosedLoopPhase =
  | "input_captured"
  | "simulated"
  | "policy_decided"
  | "approved"
  | "executed"
  | "verifying"
  | "verified_success"
  | "verified_failure"
  | "rolled_back"
  | "audited"
  | "errored";

export type ClosedLoopSourceMode =
  | "live"
  | "partial_live"
  | "preview"
  | "blocked"
  | "disabled"
  | "unknown";

export type VerificationProbeKind =
  | "telemetry_metric"
  | "telemetry_alert_state"
  | "incident_pager_closed"
  | "security_finding_resolved"
  | "operating_loop_pass"
  | "manual_operator_signoff";

export type VerificationOutcome =
  | "success"
  | "failure"
  | "inconclusive"
  | "pending"
  | "skipped"
  | "preview";

export interface VerificationProbe {
  id: string;
  kind: VerificationProbeKind;
  /** Operator-readable description. */
  description: string;
  outcome: VerificationOutcome;
  /** Evidence ref (telemetry signal id, incident id, etc.) */
  evidenceRef: string;
  /** Honest preview / live tag. */
  sourceMode: ClosedLoopSourceMode;
  /** Timestamp when the probe last ran. */
  lastRunAt?: string;
}

export interface ClosedLoopRecord {
  id: string;
  /** Where the input signal came from. */
  inputSource:
    | "priority"
    | "risk_queue"
    | "incident"
    | "telemetry_signal"
    | "billing_anomaly"
    | "operator_initiated";
  /** Originating id (priority id, risk id, etc.) */
  inputId: string;
  title: string;
  /** Honest summary of what's being changed. */
  intentSummary: string;
  /** Current phase the cycle is in. */
  phase: ClosedLoopPhase;
  /** Honest preview / live tag. */
  sourceMode: ClosedLoopSourceMode;
  /** When the cycle started. */
  startedAt: string;
  /** When it finished (if applicable). */
  finishedAt?: string;
  /** Wall-clock duration so the cockpit can flag stuck cycles. */
  durationMs?: number;
  /** Linked ids in adjacent systems. */
  linkedPriorityId?: string;
  linkedApprovalPacketId?: string;
  linkedRiskId?: string;
  linkedAutonomyCandidateId?: string;
  /** Verification probes — independent telemetry, not same-agent. */
  probes: VerificationProbe[];
  /** Aggregated verification outcome derived from probes. */
  verificationOutcome: VerificationOutcome;
  /** Audit event chain emitted on every transition. */
  auditEventIds: string[];
  /** Honest limitations of this record. */
  limitations: string[];
  /** Operator-actionable next step. */
  safeNextAction: { label: string; href: string };
}

export interface ClosedLoopReport {
  generatedAt: string;
  tenantId?: string;
  records: ClosedLoopRecord[];
  summary: {
    total: number;
    byPhase: Record<ClosedLoopPhase, number>;
    verifiedSuccess: number;
    verifiedFailure: number;
    pendingVerification: number;
    rolledBack: number;
    averageDurationMs?: number;
  };
  overallSourceMode: ClosedLoopSourceMode;
  /** Hard literal. */
  safetyContract: "closed_loop_remediation_gated";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

export const PHASE_LABEL: Record<ClosedLoopPhase, string> = {
  input_captured:    "Input captured",
  simulated:         "Simulated",
  policy_decided:    "Policy decided",
  approved:          "Approved",
  executed:          "Executed",
  verifying:         "Verifying",
  verified_success:  "Verified · success",
  verified_failure:  "Verified · failure",
  rolled_back:       "Rolled back",
  audited:           "Audited",
  errored:           "Errored",
};

export const PHASE_TONE: Record<ClosedLoopPhase, "emerald" | "cyan" | "amber" | "rose" | "violet" | "zinc"> = {
  input_captured:    "zinc",
  simulated:         "cyan",
  policy_decided:    "cyan",
  approved:          "violet",
  executed:          "violet",
  verifying:         "cyan",
  verified_success:  "emerald",
  verified_failure:  "rose",
  rolled_back:       "amber",
  audited:           "emerald",
  errored:           "rose",
};

export const VERIFICATION_OUTCOME_TONE: Record<VerificationOutcome, "emerald" | "rose" | "amber" | "cyan" | "zinc" | "violet"> = {
  success:       "emerald",
  failure:       "rose",
  inconclusive:  "amber",
  pending:       "cyan",
  skipped:       "zinc",
  preview:       "violet",
};
