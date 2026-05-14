/**
 * Compliance evidence model.
 *
 * The canonical record type the evidence collector produces, the trust
 * center renders, and the evidence-bundle exporter serialises. One shape
 * everywhere — no per-control evidence ad-hoc.
 */

import type { CorrelationId, OrganizationId } from "@/lib/domain/ids";
import type { DataSource } from "@/lib/domain/source";
import type { DataClassification } from "@/lib/security/dataClassification";

export type EvidenceType =
  | "audit_event"
  | "operation_trace"
  | "policy_decision"
  | "approval_record"
  | "security_check"
  | "redaction_check"
  | "tenant_scope_check"
  | "permission_check"
  | "connector_permission_summary"
  | "desktop_handoff_record"
  | "release_artifact_record"
  | "build_check_record"
  | "manual_attestation_placeholder";

export type VerificationStatus =
  | "verified"           // The evidence was directly produced by a code path
  | "self_attested"      // The platform claims it but the runtime check is pending
  | "manual"             // A human operator attested it
  | "unverified";        // Source is missing — surfaced honestly

export interface EvidenceRecord {
  id: string;
  /** The compliance control this evidence supports. */
  controlId: string;
  type: EvidenceType;
  /** Source system that produced the evidence. */
  sourceSystem: string;
  /** Stable id of the source entity (audit row id, trace id, policy id…). */
  sourceEntityId?: string;
  /** Tenant scope if this evidence is tenant-specific. */
  organizationId?: OrganizationId;
  /** What system generated this evidence record. */
  generatedBy: "system" | "operator" | "subscriber";
  /** When the record was produced. */
  generatedAt: string;
  /** One-line summary safe for the Trust Center UI. */
  summary: string;
  /** Redacted structured detail — must pass through redaction before persistence. */
  redactedDetail?: Record<string, string | number | boolean>;
  verificationStatus: VerificationStatus;
  /** Whether this evidence is allowed to leave the platform in an export bundle. */
  exportable: boolean;
  /** Classification governs export/AI/log policy. */
  classification: DataClassification;
  /** Operator-facing note about how long this evidence is retained. */
  retentionNote: string;
  /** Cross-refs into other records — audit events, traces, workflow runs, policy decisions. */
  relatedAuditEventIds?: string[];
  relatedTraceIds?: string[];
  relatedWorkflowRunIds?: string[];
  relatedPolicyDecisionIds?: string[];
  /** Correlation id stitching the evidence into the broader operation. */
  correlationId?: CorrelationId;
  /** Source-data honesty tag — never claim "live" for preview-state evidence. */
  source: DataSource;
}

// ---------------------------------------------------------------------------
// Convenience builder + id generator
// ---------------------------------------------------------------------------

let _seq = 0;
export function newEvidenceId(): string {
  _seq = (_seq + 1) % 1_000_000;
  return `evd_${Date.now().toString(36)}_${_seq.toString(36).padStart(4, "0")}`;
}

export interface EvidenceInit {
  controlId: string;
  type: EvidenceType;
  sourceSystem: string;
  summary: string;
  verificationStatus?: VerificationStatus;
  classification?: DataClassification;
  exportable?: boolean;
  retentionNote?: string;
  source?: DataSource;
  sourceEntityId?: string;
  organizationId?: OrganizationId;
  redactedDetail?: Record<string, string | number | boolean>;
  relatedAuditEventIds?: string[];
  relatedTraceIds?: string[];
  relatedWorkflowRunIds?: string[];
  relatedPolicyDecisionIds?: string[];
  correlationId?: CorrelationId;
  generatedBy?: "system" | "operator" | "subscriber";
}

/** Build a typed record from an init bag. Defaults are conservative. */
export function buildEvidenceRecord(init: EvidenceInit): EvidenceRecord {
  return {
    id: newEvidenceId(),
    controlId: init.controlId,
    type: init.type,
    sourceSystem: init.sourceSystem,
    sourceEntityId: init.sourceEntityId,
    organizationId: init.organizationId,
    generatedBy: init.generatedBy ?? "system",
    generatedAt: new Date().toISOString(),
    summary: init.summary,
    redactedDetail: init.redactedDetail,
    verificationStatus: init.verificationStatus ?? "self_attested",
    exportable: init.exportable ?? true,
    classification: init.classification ?? "tenant_confidential",
    retentionNote: init.retentionNote ?? "Retained for the lifetime of the related operation, then 30 days.",
    relatedAuditEventIds: init.relatedAuditEventIds,
    relatedTraceIds: init.relatedTraceIds,
    relatedWorkflowRunIds: init.relatedWorkflowRunIds,
    relatedPolicyDecisionIds: init.relatedPolicyDecisionIds,
    correlationId: init.correlationId,
    source: init.source ?? "live",
  };
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export const EVIDENCE_TYPE_LABEL: Record<EvidenceType, string> = {
  audit_event:                  "Audit event",
  operation_trace:              "Operation trace",
  policy_decision:              "Policy decision",
  approval_record:              "Approval record",
  security_check:               "Security check",
  redaction_check:              "Redaction check",
  tenant_scope_check:           "Tenant-scope check",
  permission_check:             "Permission check",
  connector_permission_summary: "Connector permission summary",
  desktop_handoff_record:       "Desktop handoff record",
  release_artifact_record:      "Release artifact record",
  build_check_record:           "Build/CI check",
  manual_attestation_placeholder: "Manual attestation",
};

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  verified:      "Verified",
  self_attested: "Self-attested",
  manual:        "Manual",
  unverified:    "Unverified",
};
