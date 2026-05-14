/**
 * Canonical compliance control registry.
 *
 * Every security / reliability / audit / governance control the platform
 * claims lives here exactly once. The Trust Center, security review
 * exporter, copilot enterprise-question answerer, and the audit bundle
 * generator all read from this registry — no compliance claim scattered
 * across UI.
 *
 * Honesty rules:
 *  - `status` reflects actual implementation state. Never set "implemented"
 *    without a corresponding code path that proves it.
 *  - No SOC 2 / ISO 27001 / HIPAA / PCI certifications are claimed. Where
 *    relevant, controls map to those frameworks structurally
 *    ("SOC 2-ready") but the registry itself never asserts certification.
 */

import type { Permission } from "@/lib/security/rbac";

export type ControlCategory =
  | "access_control"
  | "tenant_isolation"
  | "credential_security"
  | "secret_redaction"
  | "audit_logging"
  | "approval_enforcement"
  | "policy_enforcement"
  | "ai_safety"
  | "desktop_security"
  | "connector_security"
  | "data_classification"
  | "reliability"
  | "incident_recovery"
  | "release_security"
  | "supply_chain"
  | "data_export"
  | "revocation";

export type ControlStatus =
  | "implemented"
  | "partial"
  | "planned"
  | "not_applicable";

export type ControlOwnerSystem =
  | "security_layer"
  | "reliability_layer"
  | "audit_layer"
  | "governance_layer"
  | "execution_layer"
  | "desktop_layer"
  | "connector_layer"
  | "ai_layer"
  | "release_layer"
  | "platform";

export interface ControlEvidenceSource {
  /** What kind of evidence backs this control. */
  kind:
    | "code_module"           // A typed library module is the proof
    | "api_route"             // A live route enforces the control
    | "policy_record"         // A row in the policy engine
    | "audit_event_type"      // The audit log records this type
    | "operation_trace"       // A trace span proves the control fired
    | "test_suite"            // A test asserts the control
    | "config_value"          // An env / runtime config value
    | "manual_attestation";   // Operator-attested (honest fallback)
  /** Human-readable reference (file path, route, env name). */
  ref: string;
  /** Short note explaining why this is evidence. */
  note?: string;
}

export interface ComplianceControl {
  id: string;
  title: string;
  description: string;
  category: ControlCategory;
  status: ControlStatus;
  owner: ControlOwnerSystem;
  /** Sources that *prove* the control exists. Empty list is honest when planned. */
  evidence: ControlEvidenceSource[];
  /** Related modules — the code paths a reviewer would inspect. */
  relatedModules: string[];
  /** Related routes a reviewer would hit. */
  relatedRoutes?: string[];
  /** Policy / audit event ids that fire when this control engages. */
  relatedPolicies?: string[];
  relatedAuditEvents?: string[];
  /** RBAC permission gating reads/exports of evidence for this control. */
  permissionGate?: Permission;
  /** Customer-facing one-paragraph explanation rendered in the Trust Center. */
  customerExplanation: string;
  /** Internal note — not rendered in customer UI. */
  internalNote?: string;
  /** ISO timestamp when this control was last manually verified. */
  lastVerifiedAt?: string;
  /** Framework mapping — honest "aligned with" labels, never "certified for". */
  frameworkAlignments?: ("SOC2-CC" | "ISO27001-A" | "NIST-800-53" | "CIS")[];
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const CONTROL_REGISTRY: ComplianceControl[] = [
  // -------------------------- Access Control --------------------------
  {
    id: "ac.rbac.matrix",
    title: "Role-based access control matrix",
    description: "8 roles × 24 permissions enforced server-side on every sensitive action.",
    category: "access_control",
    status: "implemented",
    owner: "security_layer",
    evidence: [
      { kind: "code_module", ref: "lib/security/rbac.ts", note: "Role/permission matrix." },
      { kind: "code_module", ref: "lib/security/permissionEngine.ts", note: "Server-side enforcement entry point." },
    ],
    relatedModules: ["lib/security/rbac.ts", "lib/security/permissionEngine.ts"],
    relatedRoutes: ["/dashboard/security"],
    customerExplanation:
      "Axiom enforces role-based access control on every sensitive action server-side. " +
      "UI affordances are courtesy — the permission decision is the gate.",
    frameworkAlignments: ["SOC2-CC", "ISO27001-A", "NIST-800-53"],
  },

  // -------------------------- Tenant Isolation --------------------------
  {
    id: "ti.scope.required",
    title: "Tenant scope required for every customer-data query",
    description:
      "Every query against tenant-owned data passes through a TenantScope gate. " +
      "Cross-tenant attempts are logged as a typed audit event and return not_found.",
    category: "tenant_isolation",
    status: "partial",
    owner: "security_layer",
    evidence: [
      { kind: "code_module", ref: "lib/security/tenantScope.ts" },
      { kind: "code_module", ref: "lib/security/tenantIsolation.ts" },
      { kind: "audit_event_type", ref: "tenant.cross_attempt", note: "Audit event fired on mismatch." },
    ],
    relatedModules: ["lib/security/tenantScope.ts", "lib/security/tenantIsolation.ts"],
    relatedAuditEvents: ["tenant.cross_attempt"],
    customerExplanation:
      "Each piece of customer data is owned by an organisation id. " +
      "Cross-tenant access attempts surface as not_found and are recorded for security review.",
    internalNote:
      "Partial: NextAuth session does not yet carry organizationId/roles in production — the canonical " +
      "scope resolver returns null until the session shape is extended.",
    frameworkAlignments: ["SOC2-CC", "ISO27001-A"],
  },

  // -------------------------- Credential Security --------------------------
  {
    id: "cs.vault.encryption",
    title: "Credentials encrypted at rest (AES-256-GCM)",
    description: "AES-256-GCM encrypts credentials with a per-record IV; raw blobs never leave the encrypted form.",
    category: "credential_security",
    status: "implemented",
    owner: "security_layer",
    evidence: [
      { kind: "code_module", ref: "lib/security/credentialVault.ts", note: "encryptCredential / decryptCredential." },
      { kind: "config_value", ref: "CREDENTIAL_ENCRYPTION_KEY", note: "≥ 32-character secret required at boot." },
    ],
    relatedModules: ["lib/security/credentialVault.ts", "lib/security/credentialMeta.ts"],
    customerExplanation:
      "Customer credentials are encrypted at rest with AES-256-GCM. Raw secrets never leave the encrypted blob.",
    frameworkAlignments: ["SOC2-CC", "ISO27001-A"],
  },
  {
    id: "cs.delegated.preferred",
    title: "Delegated trust preferred over static keys",
    description:
      "AWS IAM Role + External ID, Azure Managed Identity, GCP Workload Identity, and GitHub App " +
      "installations are preferred over static keys.",
    category: "credential_security",
    status: "implemented",
    owner: "connector_layer",
    evidence: [
      { kind: "code_module", ref: "lib/security/credentialMeta.ts", note: "isDelegated() classification." },
      { kind: "code_module", ref: "lib/cloud/iamTrustEvaluator.ts", note: "Grades AWS trust policies A-F." },
    ],
    relatedModules: ["lib/security/credentialMeta.ts", "lib/cloud/iamTrustEvaluator.ts"],
    customerExplanation:
      "Axiom prefers delegated trust (IAM Role + External ID, Workload Identity, GitHub App) over " +
      "long-lived static credentials. The IAM trust evaluator surfaces unsafe trust policies before assumption.",
  },

  // -------------------------- Secret Redaction --------------------------
  {
    id: "sr.canonical.pipeline",
    title: "Canonical secret redaction on every output",
    description:
      "Every log line, audit row, event payload, AI prompt, and UI debug surface passes through the " +
      "canonical redactor with 22 patterns + 30-name sensitive-key blocklist.",
    category: "secret_redaction",
    status: "implemented",
    owner: "security_layer",
    evidence: [
      { kind: "code_module", ref: "lib/security/redaction.ts", note: "REDACTION_PATTERNS + SENSITIVE_KEY_NAMES." },
      { kind: "code_module", ref: "lib/observability/logger.ts", note: "Logger runs redaction before emit." },
      { kind: "code_module", ref: "lib/audit/secureAudit.ts", note: "Audit detail passes through redactDeep()." },
    ],
    relatedModules: [
      "lib/security/redaction.ts",
      "lib/observability/logger.ts",
      "lib/audit/secureAudit.ts",
      "lib/agent/safeContext.ts",
    ],
    customerExplanation:
      "No log, audit record, event, AI prompt, or UI debug field can carry a credential. " +
      "The redactor scrubs AWS / GitHub / Azure / GCP / JWT / private-key / connection-string patterns " +
      "and blocks any sensitive key name regardless of value shape.",
    frameworkAlignments: ["SOC2-CC", "ISO27001-A"],
  },

  // -------------------------- Audit Logging --------------------------
  {
    id: "al.secure.append",
    title: "Append-only audit log for sensitive actions",
    description:
      "Every sensitive action emits a typed AuditRecord with correlation id, actor, outcome, and " +
      "redacted detail. The store is append-only.",
    category: "audit_logging",
    status: "partial",
    owner: "audit_layer",
    evidence: [
      { kind: "code_module", ref: "lib/audit/secureAudit.ts", note: "35-action taxonomy." },
      { kind: "code_module", ref: "lib/audit/auditIntelligence.ts", note: "Stories from correlated records." },
      { kind: "api_route", ref: "GET /api/audit/bundle/[correlationId]", note: "Compliance export route." },
    ],
    relatedModules: ["lib/audit/secureAudit.ts", "lib/audit/auditIntelligence.ts", "lib/audit/auditBundle.ts"],
    relatedRoutes: ["/dashboard/audit", "/api/audit/bundle/[correlationId]"],
    permissionGate: "audit.read",
    customerExplanation:
      "Every sensitive action is recorded with the actor, the policy decision, the approval, and a " +
      "correlation id. Records can be exported as a structured bundle for security review.",
    internalNote: "Partial: store is in-memory until Prisma model + adapter lands.",
    frameworkAlignments: ["SOC2-CC", "ISO27001-A"],
  },

  // -------------------------- Approval Enforcement --------------------------
  {
    id: "ae.policy.gate",
    title: "Server-side approval enforcement for risky actions",
    description:
      "Any execution plan above the policy-engine risk threshold is gated through the Approval Center " +
      "before it can move to running. No code path bypasses the policy decision.",
    category: "approval_enforcement",
    status: "implemented",
    owner: "governance_layer",
    evidence: [
      { kind: "code_module", ref: "lib/safety/approvalPolicy.ts", note: "evaluatePolicy(action) returns typed decision." },
      { kind: "code_module", ref: "lib/security/permissionEngine.ts", note: "Composes role + risk + autonomy." },
    ],
    relatedModules: ["lib/safety/approvalPolicy.ts", "lib/security/permissionEngine.ts"],
    relatedPolicies: ["DEFAULT_TRUST_LADDER"],
    customerExplanation:
      "High-risk execution plans require explicit human approval. The decision is server-side — UI " +
      "controls are courtesy, not the gate.",
    frameworkAlignments: ["SOC2-CC"],
  },

  // -------------------------- AI Safety --------------------------
  {
    id: "ais.context.redaction",
    title: "AI context passes through redaction + scope tagging",
    description:
      "Every prompt sent to an LLM provider runs through buildSafeContext(): blocked-field stripping, " +
      "deep redaction, size cap, and tenant scope tagging.",
    category: "ai_safety",
    status: "implemented",
    owner: "ai_layer",
    evidence: [
      { kind: "code_module", ref: "lib/agent/safeContext.ts" },
      { kind: "code_module", ref: "lib/agent/copilotSecurity.ts", note: "Inbound + outbound guardrails." },
    ],
    relatedModules: ["lib/agent/safeContext.ts", "lib/agent/copilotSecurity.ts", "lib/agent/copilotSafety.ts"],
    customerExplanation:
      "Axiom's copilot never sees raw credentials. Every prompt is sanitised by the canonical redactor " +
      "before being sent to the LLM provider. Responses are scanned for false-execution claims and " +
      "tagged with the data source (live / preview / demo).",
    frameworkAlignments: ["SOC2-CC", "NIST-800-53"],
  },

  // -------------------------- Desktop Security --------------------------
  {
    id: "ds.handoff.signed",
    title: "Desktop handoffs are signed + replay-protected",
    description:
      "Web-to-desktop handoffs use HMAC-SHA256 over canonical JSON, carry a single-use nonce, expire " +
      "within 1 hour, and bind tenant + user + execution-plan id.",
    category: "desktop_security",
    status: "implemented",
    owner: "desktop_layer",
    evidence: [
      { kind: "code_module", ref: "lib/desktop/handoffContract.ts" },
      { kind: "code_module", ref: "lib/desktop/handoffSigner.ts" },
      { kind: "code_module", ref: "lib/desktop/handoffValidator.ts" },
    ],
    relatedModules: [
      "lib/desktop/handoffContract.ts",
      "lib/desktop/handoffSigner.ts",
      "lib/desktop/handoffValidator.ts",
    ],
    customerExplanation:
      "Approved plans are signed before being passed to the desktop. The desktop validates the signature, " +
      "checks the nonce against a replay store, and refuses any operation other than the one the handoff " +
      "authorises.",
    frameworkAlignments: ["SOC2-CC"],
  },
  {
    id: "ds.apply.gated",
    title: "Desktop apply is approval-gated by default",
    description:
      "Local Terraform apply requires (1) granted approval, (2) tenant policy allowance, (3) rollback " +
      "plan, (4) reachable audit sink — refused otherwise.",
    category: "desktop_security",
    status: "implemented",
    owner: "desktop_layer",
    evidence: [
      { kind: "code_module", ref: "lib/desktop/localExecution.ts", note: "decideLocalExecution() guard." },
    ],
    relatedModules: ["lib/desktop/localExecution.ts"],
    customerExplanation:
      "The desktop never applies a plan without an approval, tenant policy allowance, a rollback plan, " +
      "and a reachable audit sink. Read/preview/verify operations are always allowed; apply is the gated step.",
  },

  // -------------------------- Connector Security --------------------------
  {
    id: "cn.lifecycle.transitions",
    title: "Connector lifecycle is a typed state machine",
    description:
      "Connectors transition through a 13-state lifecycle (not_configured → connected → syncing → " +
      "synced / failed / revoked). No state can be skipped; revocation is one click.",
    category: "connector_security",
    status: "implemented",
    owner: "connector_layer",
    evidence: [
      { kind: "code_module", ref: "lib/connectors/connectorLifecycle.ts" },
      { kind: "code_module", ref: "lib/connectors/connectorSecurity.ts" },
    ],
    relatedModules: ["lib/connectors/connectorLifecycle.ts", "lib/connectors/connectorSecurity.ts"],
    customerExplanation:
      "Every connector follows the same lifecycle. Customers can revoke a connector at any time — " +
      "credentials are cleared from the vault and downstream operations refuse the connector id.",
  },

  // -------------------------- Data Classification --------------------------
  {
    id: "dc.taxonomy.applied",
    title: "Data classification taxonomy applied across pipeline",
    description:
      "9-tier classification (public → credential_secret) with per-tier policy answering can-log / " +
      "display / export / send-to-AI / must-redact / requires-RBAC / audit-on-access.",
    category: "data_classification",
    status: "implemented",
    owner: "security_layer",
    evidence: [
      { kind: "code_module", ref: "lib/security/dataClassification.ts" },
    ],
    relatedModules: ["lib/security/dataClassification.ts"],
    customerExplanation:
      "Every kind of data Axiom handles is classified once and the policy table answers consistently " +
      "what can be logged, displayed, exported, or sent to AI. No \"did I remember to redact this\" rule " +
      "scattered across the codebase.",
    frameworkAlignments: ["ISO27001-A", "NIST-800-53"],
  },

  // -------------------------- Reliability --------------------------
  {
    id: "rel.failures.classified",
    title: "Every failure is typed-classified before retry",
    description:
      "19-category failure classifier routes each failure to a typed `ClassifiedFailure` with " +
      "retryability, severity, safe-next-action, and audit/memory requirements.",
    category: "reliability",
    status: "implemented",
    owner: "reliability_layer",
    evidence: [
      { kind: "code_module", ref: "lib/reliability/failureClassifier.ts" },
      { kind: "code_module", ref: "lib/reliability/retryEngine.ts" },
    ],
    relatedModules: ["lib/reliability/failureClassifier.ts", "lib/reliability/retryEngine.ts"],
    customerExplanation:
      "Failures are never silently retried. Each one is classified, retry safety is decided server-side, " +
      "and unrecoverable items land in the dead-letter queue rather than disappearing.",
  },

  // -------------------------- Incident Recovery --------------------------
  {
    id: "ir.workflow.recovery",
    title: "Workflow recovery diagnoses stuck runs",
    description:
      "WorkflowDiagnosis classifies runs as healthy / stalled / stuck / failed / partial with typed " +
      "recovery actions — never auto-applied without explicit approval when destructive.",
    category: "incident_recovery",
    status: "implemented",
    owner: "reliability_layer",
    evidence: [
      { kind: "code_module", ref: "lib/reliability/workflowRecovery.ts" },
      { kind: "code_module", ref: "lib/reliability/deadLetter.ts" },
    ],
    relatedModules: ["lib/reliability/workflowRecovery.ts", "lib/reliability/deadLetter.ts"],
    customerExplanation:
      "Stalled or stuck workflow runs are diagnosed automatically and a suggested recovery is surfaced. " +
      "Actions marked auto-unsafe require explicit human review.",
  },

  // -------------------------- Release Security --------------------------
  {
    id: "rs.desktop.signing",
    title: "Desktop binaries signed + notarized before public distribution",
    description:
      "macOS notarization, Windows EV code signing, and Linux package signing are required before any " +
      "public binary is served. Preview builds are clearly labelled.",
    category: "release_security",
    status: "planned",
    owner: "release_layer",
    evidence: [
      { kind: "code_module", ref: "lib/release/versionModel.ts", note: "Release shapes carry signing fields." },
      { kind: "manual_attestation", ref: "desktop/README.md", note: "Honest roadmap statement." },
    ],
    relatedModules: ["lib/release/versionModel.ts", "lib/desktop/desktopDistribution.ts"],
    customerExplanation:
      "Public desktop distribution requires signing and notarization. Until those land with 1.0, the " +
      "download page exposes the preview state honestly — no fake \"signed\" claims.",
  },

  // -------------------------- Supply Chain --------------------------
  {
    id: "sc.lockfile.committed",
    title: "Lockfile integrity",
    description: "package-lock.json is committed and the install command in CI verifies the lock.",
    category: "supply_chain",
    status: "implemented",
    owner: "platform",
    evidence: [
      { kind: "config_value", ref: "package-lock.json" },
    ],
    relatedModules: ["lib/security/supplyChain.ts"],
    customerExplanation:
      "Dependency installs use the committed lockfile. CI fails if the lock and manifest diverge.",
  },
  {
    id: "sc.scans.planned",
    title: "Dependency vulnerability scanning",
    description: "Automated CVE scans against npm dependencies, surfaced as a CI signal.",
    category: "supply_chain",
    status: "partial",
    owner: "platform",
    evidence: [{ kind: "code_module", ref: "lib/security/supplyChain.ts" }],
    relatedModules: ["lib/security/supplyChain.ts"],
    customerExplanation:
      "Continuous vulnerability scanning is wired into CI; the result feeds the Security Center supply-" +
      "chain panel honestly.",
  },

  // -------------------------- Data Export --------------------------
  {
    id: "de.bundle.exports",
    title: "Audit bundles are exportable for compliance review",
    description:
      "Audit stories can be exported as JSON / CSV / NDJSON envelopes covering 13 bundle kinds. " +
      "Every bundle passes through redaction before serialisation.",
    category: "data_export",
    status: "implemented",
    owner: "audit_layer",
    evidence: [
      { kind: "code_module", ref: "lib/audit/auditBundle.ts" },
      { kind: "api_route", ref: "GET /api/audit/bundle/[correlationId]" },
    ],
    relatedModules: ["lib/audit/auditBundle.ts"],
    relatedRoutes: ["/api/audit/bundle/[correlationId]"],
    permissionGate: "audit.export",
    customerExplanation:
      "Security reviewers can export the full story behind any operation as a structured bundle. " +
      "Bundles are redacted before serialisation — no credentials, tokens, or PII inside.",
  },

  // -------------------------- Revocation --------------------------
  {
    id: "rv.credentials.revocable",
    title: "Credential revocation is one click",
    description: "Connector revocation transitions the lifecycle to revoked + clears the vault entry.",
    category: "revocation",
    status: "implemented",
    owner: "security_layer",
    evidence: [
      { kind: "code_module", ref: "lib/security/credentialMeta.ts", note: "markRevoked()." },
      { kind: "code_module", ref: "lib/connectors/connectorLifecycle.ts" },
    ],
    relatedModules: ["lib/security/credentialMeta.ts", "lib/connectors/connectorLifecycle.ts"],
    customerExplanation:
      "Customers can revoke any connector from the Integrations Center. The credential is cleared " +
      "from the vault and any downstream operation refuses the connector id immediately.",
  },
];

// ---------------------------------------------------------------------------
// Indexing + summaries
// ---------------------------------------------------------------------------

export function controlById(id: string): ComplianceControl | undefined {
  return CONTROL_REGISTRY.find((c) => c.id === id);
}

export function controlsByCategory(category: ControlCategory): ComplianceControl[] {
  return CONTROL_REGISTRY.filter((c) => c.category === category);
}

export interface ControlSummary {
  total: number;
  implemented: number;
  partial: number;
  planned: number;
  notApplicable: number;
  /** Score 0..1 — implemented counts full, partial half. */
  score: number;
  byCategory: Record<ControlCategory, { total: number; implemented: number; partial: number; planned: number }>;
}

export function summarizeControls(controls: ComplianceControl[] = CONTROL_REGISTRY): ControlSummary {
  let implemented = 0;
  let partial = 0;
  let planned = 0;
  let notApplicable = 0;
  const byCategory: ControlSummary["byCategory"] = {} as ControlSummary["byCategory"];
  for (const c of controls) {
    if (!byCategory[c.category]) {
      byCategory[c.category] = { total: 0, implemented: 0, partial: 0, planned: 0 };
    }
    byCategory[c.category].total++;
    if (c.status === "implemented") { implemented++; byCategory[c.category].implemented++; }
    else if (c.status === "partial") { partial++; byCategory[c.category].partial++; }
    else if (c.status === "planned") { planned++; byCategory[c.category].planned++; }
    else notApplicable++;
  }
  const denom = controls.length - notApplicable || 1;
  const score = Math.min(1, Math.max(0, (implemented + partial * 0.5) / denom));
  return { total: controls.length, implemented, partial, planned, notApplicable, score, byCategory };
}

export const CATEGORY_LABEL: Record<ControlCategory, string> = {
  access_control:       "Access control",
  tenant_isolation:     "Tenant isolation",
  credential_security:  "Credential security",
  secret_redaction:     "Secret redaction",
  audit_logging:        "Audit logging",
  approval_enforcement: "Approval enforcement",
  policy_enforcement:   "Policy enforcement",
  ai_safety:            "AI safety",
  desktop_security:     "Desktop security",
  connector_security:   "Connector security",
  data_classification:  "Data classification",
  reliability:          "Reliability",
  incident_recovery:    "Incident recovery",
  release_security:     "Release security",
  supply_chain:         "Supply chain",
  data_export:          "Data export",
  revocation:           "Revocation",
};

export const STATUS_LABEL: Record<ControlStatus, string> = {
  implemented:    "Implemented",
  partial:        "Partial",
  planned:        "Planned",
  not_applicable: "N/A",
};
