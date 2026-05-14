/**
 * Enterprise data classification.
 *
 * Every piece of data Axiom handles falls into one of nine classification
 * tiers. Each tier maps to a typed policy table that answers seven
 * questions consistently:
 *  - Can this be logged?
 *  - Can this appear in the UI?
 *  - Can this be exported?
 *  - Can this be sent to an AI provider?
 *  - Must this be redacted before display?
 *  - Does this require RBAC for read?
 *  - Must this be audited on access?
 *
 * The redaction pipeline, audit bundle exporter, copilot context builder,
 * and apiGuard all read from this same table — one source of truth, no
 * "did I remember to redact this" rule scattered across the codebase.
 */

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

export type DataClassification =
  | "public"                  // Marketing copy, docs — safe everywhere
  | "internal"                // Non-sensitive operational data
  | "tenant_confidential"     // Customer-owned data — RBAC required
  | "security_sensitive"      // Findings, policy decisions, audit
  | "credential_secret"       // Tokens, keys, role ARNs — never logged or shown
  | "audit_sensitive"         // Audit rows — append-only, export-gated
  | "ai_context_allowed"      // Safe to include in LLM prompts
  | "ai_context_restricted"   // Operational facts that need redaction first
  | "pii";                    // Personal information — never to AI, RBAC + audit

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

export interface ClassificationPolicy {
  /** Can this data appear in structured logs? */
  loggable: boolean;
  /** Can this data appear in the UI without explicit unmasking? */
  displayable: boolean;
  /** Can this data be exported as part of an audit bundle? */
  exportable: boolean;
  /** Can this data be included in a prompt to an AI provider? */
  aiContextSafe: boolean;
  /** Must this data pass through redaction before display/log/export? */
  mustRedact: boolean;
  /** Must the reader have a specific RBAC permission to see this? */
  requiresRbac: boolean;
  /** Must access to this data produce an audit record? */
  auditOnAccess: boolean;
}

const POLICY: Record<DataClassification, ClassificationPolicy> = {
  public: {
    loggable: true,
    displayable: true,
    exportable: true,
    aiContextSafe: true,
    mustRedact: false,
    requiresRbac: false,
    auditOnAccess: false,
  },
  internal: {
    loggable: true,
    displayable: true,
    exportable: true,
    aiContextSafe: true,
    mustRedact: false,
    requiresRbac: false,
    auditOnAccess: false,
  },
  tenant_confidential: {
    loggable: true,
    displayable: true,
    exportable: true,
    aiContextSafe: true,
    mustRedact: true,
    requiresRbac: true,
    auditOnAccess: false,
  },
  security_sensitive: {
    loggable: true,
    displayable: true,
    exportable: true,
    aiContextSafe: false,
    mustRedact: true,
    requiresRbac: true,
    auditOnAccess: true,
  },
  credential_secret: {
    loggable: false,
    displayable: false,
    exportable: false,
    aiContextSafe: false,
    mustRedact: true,
    requiresRbac: true,
    auditOnAccess: true,
  },
  audit_sensitive: {
    loggable: true,
    displayable: true,
    exportable: true,
    aiContextSafe: false,
    mustRedact: true,
    requiresRbac: true,
    auditOnAccess: true,
  },
  ai_context_allowed: {
    loggable: true,
    displayable: true,
    exportable: true,
    aiContextSafe: true,
    mustRedact: false,
    requiresRbac: false,
    auditOnAccess: false,
  },
  ai_context_restricted: {
    loggable: true,
    displayable: true,
    exportable: true,
    aiContextSafe: false,
    mustRedact: true,
    requiresRbac: false,
    auditOnAccess: false,
  },
  pii: {
    loggable: false,
    displayable: true,
    exportable: true,
    aiContextSafe: false,
    mustRedact: true,
    requiresRbac: true,
    auditOnAccess: true,
  },
};

export function policyFor(classification: DataClassification): ClassificationPolicy {
  return POLICY[classification];
}

// ---------------------------------------------------------------------------
// Subject taxonomy — the typed list of things the platform classifies
// ---------------------------------------------------------------------------

export type DataSubject =
  // Cloud
  | "cloud.snapshot"
  | "cloud.finding"
  | "cloud.recommendation"
  | "cloud.provider_metadata"
  | "cloud.resource_id"
  | "cloud.account_id"
  // Connectors
  | "connector.metadata"
  | "connector.lifecycle_state"
  | "connector.credential_blob"
  | "connector.role_arn"
  | "connector.external_id"
  // Execution
  | "execution.plan"
  | "execution.terraform_output"
  | "execution.cli_output"
  | "execution.rollback_plan"
  // Audit / logs
  | "audit.record"
  | "audit.bundle"
  | "log.structured"
  | "log.error_stack"
  // Copilot
  | "copilot.user_query"
  | "copilot.context_payload"
  | "copilot.response"
  // Desktop
  | "desktop.handoff_payload"
  | "desktop.local_audit"
  // Identity
  | "identity.user_email"
  | "identity.user_name"
  | "identity.organization_id";

const SUBJECT_CLASSIFICATION: Record<DataSubject, DataClassification> = {
  // Cloud
  "cloud.snapshot":           "tenant_confidential",
  "cloud.finding":            "security_sensitive",
  "cloud.recommendation":     "tenant_confidential",
  "cloud.provider_metadata":  "internal",
  "cloud.resource_id":        "tenant_confidential",
  "cloud.account_id":         "tenant_confidential",
  // Connectors
  "connector.metadata":       "internal",
  "connector.lifecycle_state":"internal",
  "connector.credential_blob":"credential_secret",
  "connector.role_arn":       "tenant_confidential",
  "connector.external_id":    "credential_secret",
  // Execution
  "execution.plan":           "security_sensitive",
  "execution.terraform_output":"ai_context_restricted",
  "execution.cli_output":     "ai_context_restricted",
  "execution.rollback_plan":  "security_sensitive",
  // Audit / logs
  "audit.record":             "audit_sensitive",
  "audit.bundle":             "audit_sensitive",
  "log.structured":           "ai_context_restricted",
  "log.error_stack":          "ai_context_restricted",
  // Copilot
  "copilot.user_query":       "ai_context_allowed",
  "copilot.context_payload":  "ai_context_restricted",
  "copilot.response":         "tenant_confidential",
  // Desktop
  "desktop.handoff_payload":  "security_sensitive",
  "desktop.local_audit":      "audit_sensitive",
  // Identity
  "identity.user_email":      "pii",
  "identity.user_name":       "pii",
  "identity.organization_id": "tenant_confidential",
};

export function classify(subject: DataSubject): DataClassification {
  return SUBJECT_CLASSIFICATION[subject];
}

export function policyForSubject(subject: DataSubject): ClassificationPolicy {
  return POLICY[SUBJECT_CLASSIFICATION[subject]];
}

// ---------------------------------------------------------------------------
// Convenience predicates — read like English at the call site
// ---------------------------------------------------------------------------

export function canSendToAI(subject: DataSubject): boolean {
  return policyForSubject(subject).aiContextSafe;
}

export function canLog(subject: DataSubject): boolean {
  return policyForSubject(subject).loggable;
}

export function canExport(subject: DataSubject): boolean {
  return policyForSubject(subject).exportable;
}

export function mustRedact(subject: DataSubject): boolean {
  return policyForSubject(subject).mustRedact;
}

export function requiresRbac(subject: DataSubject): boolean {
  return policyForSubject(subject).requiresRbac;
}

export function auditOnAccess(subject: DataSubject): boolean {
  return policyForSubject(subject).auditOnAccess;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export const CLASSIFICATION_LABEL: Record<DataClassification, string> = {
  public:                "Public",
  internal:              "Internal",
  tenant_confidential:   "Tenant confidential",
  security_sensitive:    "Security sensitive",
  credential_secret:     "Credential / secret",
  audit_sensitive:       "Audit sensitive",
  ai_context_allowed:    "AI context allowed",
  ai_context_restricted: "AI context restricted",
  pii:                   "PII",
};
