/**
 * Evidence Lifecycle V2 — typed contract.
 *
 * The evidence library is the canonical catalog of every evidence
 * record Axiom can surface. Each record is redacted, tenant-scoped,
 * sourceMode-labeled, and linked to a canonical object the operator
 * can drill into.
 *
 * No secrets in any record. No fabricated history.
 */

export type EvidenceType =
  | "source_posture"
  | "scan_result"
  | "security_finding"
  | "risk_signal"
  | "remediation_candidate"
  | "simulation_result"
  | "policy_decision"
  | "approval_decision"
  | "desktop_handoff"
  | "trust_control"
  | "readiness_check"
  | "audit_event"
  | "integration_health";

export type EvidenceRetentionStatus =
  | "retained_default"    // in retention window
  | "retained_extended"   // operator-extended retention
  | "ephemeral_session"   // current-session only (no persistence yet)
  | "pending_persistence" // persistence required to retain
  | "purged";             // intentionally purged (audited)

export type EvidenceSourceMode =
  | "live" | "partial_live" | "preview" | "foundation"
  | "planned" | "blocked" | "disabled" | "unknown";

export interface EvidenceRecord {
  id: string;
  type: EvidenceType;
  /** Title operators see. */
  title: string;
  /** Redacted summary — never contains raw secrets. */
  summary: string;
  /** What this evidence is about. */
  sourceSystem: string;
  sourceMode: EvidenceSourceMode;
  /** When the record was captured (canonical generatedAt). */
  createdAt: string;
  /** Type of operational object this evidence links to. */
  linkedObjectType?: string;
  /** Stable id of the linked object. */
  linkedObjectId?: string;
  /** Honest retention status. */
  retentionStatus: EvidenceRetentionStatus;
  /** Can the operator export this record? */
  exportable: boolean;
  /** Honest limitations on this record. */
  limitations: string[];
  /** Stable evidence ref for downstream audit. */
  evidenceRef: string;
}

export interface EvidenceLibraryReport {
  generatedAt: string;
  tenantId?: string;
  records: EvidenceRecord[];
  summary: {
    total: number;
    byType: Record<EvidenceType, number>;
    exportable: number;
    ephemeral: number;
    retained: number;
    pendingPersistence: number;
  };
  /** Hard literal — view never executes or mutates. */
  safetyContract: "evidence_library_read_only";
  /** Honest list of what the library cannot yet do. */
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

export const EVIDENCE_TYPE_LABEL: Record<EvidenceType, string> = {
  source_posture:         "Source posture",
  scan_result:            "Scan result",
  security_finding:       "Security finding",
  risk_signal:            "Risk signal",
  remediation_candidate:  "Remediation candidate",
  simulation_result:      "Simulation result",
  policy_decision:        "Policy decision",
  approval_decision:      "Approval decision",
  desktop_handoff:        "Desktop handoff",
  trust_control:          "Trust control",
  readiness_check:        "Readiness check",
  audit_event:            "Audit event",
  integration_health:     "Integration health",
};

export const RETENTION_TONE: Record<EvidenceRetentionStatus, "emerald" | "cyan" | "amber" | "rose" | "zinc"> = {
  retained_default:    "emerald",
  retained_extended:   "cyan",
  ephemeral_session:   "amber",
  pending_persistence: "amber",
  purged:              "rose",
};

export const RETENTION_LABEL: Record<EvidenceRetentionStatus, string> = {
  retained_default:    "Retained · default window",
  retained_extended:   "Retained · extended",
  ephemeral_session:   "Ephemeral · session only",
  pending_persistence: "Pending · persistence",
  purged:              "Purged",
};
