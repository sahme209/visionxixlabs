/**
 * Enterprise data handling summary.
 *
 * The Trust Center, security review bundle, and docs all need one
 * authoritative answer to "what data does Axiom touch and what does it
 * not?". This module composes that answer from the canonical
 * `dataClassification` taxonomy plus a small set of typed `DataAssertion`
 * records.
 *
 * Honest by design — every assertion is grouped under one of three
 * confidence states (`enforced` / `attested` / `aspirational`) so the
 * reviewer can see which lines are guaranteed by code and which depend on
 * deployment configuration.
 */

import type { DataSubject } from "./dataClassification";
import { classify, policyForSubject, CLASSIFICATION_LABEL } from "./dataClassification";

export type AssertionConfidence = "enforced" | "attested" | "aspirational";

export interface DataAssertion {
  /** Stable id for rendering + audit. */
  id: string;
  /** Plain-language statement the customer sees. */
  statement: string;
  /** How the platform backs the statement. */
  confidence: AssertionConfidence;
  /** Subjects (from the classification taxonomy) this assertion concerns. */
  subjects: DataSubject[];
  /** Modules / docs a reviewer can read to verify. */
  evidence: string[];
}

export interface DataHandlingSummary {
  whatWeCollect: DataAssertion[];
  whatWeDoNotCollect: DataAssertion[];
  whatWeStore: DataAssertion[];
  whatIsTransient: DataAssertion[];
  whatCanGoToAI: DataAssertion[];
  whatNeverGoesToAI: DataAssertion[];
  redaction: DataAssertion[];
  export: DataAssertion[];
  deletion: DataAssertion[];
  adminAccess: DataAssertion[];
}

export function buildDataHandlingSummary(): DataHandlingSummary {
  return {
    whatWeCollect: [
      {
        id: "collect.cloud_inventory",
        statement: "Resource metadata from the cloud accounts you connect (names, tags, configuration).",
        confidence: "enforced",
        subjects: ["cloud.snapshot", "cloud.account_id", "cloud.resource_id"],
        evidence: ["lib/cloud/snapshotModel.ts"],
      },
      {
        id: "collect.findings",
        statement: "Findings + recommendations the reasoner produces against your inventory.",
        confidence: "enforced",
        subjects: ["cloud.finding", "cloud.recommendation"],
        evidence: ["lib/agent/snapshotReasoner.ts"],
      },
      {
        id: "collect.identity",
        statement: "Your user email + name from the sign-in provider (Google / GitHub / email).",
        confidence: "enforced",
        subjects: ["identity.user_email", "identity.user_name"],
        evidence: ["lib/auth.ts"],
      },
    ],
    whatWeDoNotCollect: [
      {
        id: "no_collect.s3_objects",
        statement: "S3 object contents, RDS row data, BigQuery row data, Key Vault secrets.",
        confidence: "enforced",
        subjects: ["cloud.snapshot"],
        evidence: ["lib/connectors/permissionEvidence.ts"],
      },
      {
        id: "no_collect.log_bodies",
        statement: "CloudWatch / GCP / Azure log line bodies (we read counts + metadata, not text).",
        confidence: "enforced",
        subjects: ["cloud.snapshot"],
        evidence: ["lib/connectors/permissionEvidence.ts"],
      },
      {
        id: "no_collect.foreign_tenants",
        statement: "Anything from cloud accounts or repos you haven't explicitly connected.",
        confidence: "enforced",
        subjects: ["identity.organization_id"],
        evidence: ["lib/security/tenantIsolation.ts"],
      },
    ],
    whatWeStore: [
      {
        id: "store.audit",
        statement: "Audit records for every sensitive action, with actor, outcome, correlation id.",
        confidence: "attested",
        subjects: ["audit.record"],
        evidence: ["lib/audit/secureAudit.ts"],
      },
      {
        id: "store.credentials_encrypted",
        statement: "Credentials encrypted at rest with AES-256-GCM in the credential vault.",
        confidence: "enforced",
        subjects: ["connector.credential_blob"],
        evidence: ["lib/security/credentialVault.ts"],
      },
      {
        id: "store.plans",
        statement: "Execution plan candidates with policy decisions, approvals, and Terraform outputs.",
        confidence: "enforced",
        subjects: ["execution.plan"],
        evidence: ["lib/execution/executionPlanBuilder.ts"],
      },
    ],
    whatIsTransient: [
      {
        id: "transient.copilot_query",
        statement: "Copilot user queries — not stored unless an audit record was required.",
        confidence: "enforced",
        subjects: ["copilot.user_query"],
        evidence: ["lib/agent/operationsCopilot.ts"],
      },
      {
        id: "transient.scan_responses",
        statement: "Raw provider API responses are normalised + discarded; only the snapshot is stored.",
        confidence: "enforced",
        subjects: ["cloud.snapshot"],
        evidence: ["lib/cloud/scanOrchestrator.ts"],
      },
    ],
    whatCanGoToAI: [
      {
        id: "ai.allowed.user_query",
        statement: "The user's question (after intent classification).",
        confidence: "enforced",
        subjects: ["copilot.user_query"],
        evidence: ["lib/agent/safeContext.ts"],
      },
      {
        id: "ai.allowed.redacted_state",
        statement: "Redacted operational state — workflow diagnoses, policy decisions, classified failures.",
        confidence: "enforced",
        subjects: ["copilot.context_payload"],
        evidence: ["lib/agent/safeContext.ts", "lib/security/redaction.ts"],
      },
    ],
    whatNeverGoesToAI: [
      {
        id: "ai.never.credentials",
        statement: "Credentials (encrypted or otherwise) — blocked structurally before any prompt builds.",
        confidence: "enforced",
        subjects: ["connector.credential_blob", "connector.external_id"],
        evidence: ["lib/agent/safeContext.ts"],
      },
      {
        id: "ai.never.audit_bodies",
        statement: "Raw audit row bodies — only summary statistics may surface via the typed copilot path.",
        confidence: "enforced",
        subjects: ["audit.record"],
        evidence: ["lib/security/dataClassification.ts"],
      },
      {
        id: "ai.never.pii",
        statement: "Personal identifying information — emails / names of other users.",
        confidence: "enforced",
        subjects: ["identity.user_email", "identity.user_name"],
        evidence: ["lib/security/dataClassification.ts"],
      },
    ],
    redaction: [
      {
        id: "redact.canonical",
        statement: "Every log, event, audit row, and AI prompt passes through the canonical redactor first.",
        confidence: "enforced",
        subjects: ["log.structured", "audit.record", "copilot.context_payload"],
        evidence: ["lib/security/redaction.ts"],
      },
    ],
    export: [
      {
        id: "export.audit_bundle",
        statement: "Audit stories can be exported as JSON / CSV / NDJSON via /api/audit/bundle/[correlationId].",
        confidence: "enforced",
        subjects: ["audit.bundle"],
        evidence: ["lib/audit/auditBundle.ts", "app/api/audit/bundle/[correlationId]/route.ts"],
      },
      {
        id: "export.compliance_bundle",
        statement: "Compliance evidence bundles (security review, AWS connection, etc.) export honestly.",
        confidence: "enforced",
        subjects: ["audit.bundle"],
        evidence: ["lib/compliance/evidenceBundle.ts"],
      },
    ],
    deletion: [
      {
        id: "delete.revocation",
        statement: "Revoking a connector clears its credential blob from the vault immediately.",
        confidence: "enforced",
        subjects: ["connector.credential_blob"],
        evidence: ["lib/security/credentialMeta.ts"],
      },
      {
        id: "delete.tenant",
        statement: "Tenant deletion (admin) cascades to all tenant-scoped records.",
        confidence: "aspirational",
        subjects: ["audit.record", "execution.plan"],
        evidence: ["prisma/schema.prisma"],
      },
    ],
    adminAccess: [
      {
        id: "admin.rbac_owner",
        statement: "Only the workspace owner can change billing, ownership, or revoke other admins.",
        confidence: "enforced",
        subjects: ["identity.organization_id"],
        evidence: ["lib/security/rbac.ts"],
      },
    ],
  };
}

export interface DataHandlingPosture {
  totalAssertions: number;
  enforced: number;
  attested: number;
  aspirational: number;
}

export function summarizeDataHandling(summary: DataHandlingSummary): DataHandlingPosture {
  const all = [
    ...summary.whatWeCollect,
    ...summary.whatWeDoNotCollect,
    ...summary.whatWeStore,
    ...summary.whatIsTransient,
    ...summary.whatCanGoToAI,
    ...summary.whatNeverGoesToAI,
    ...summary.redaction,
    ...summary.export,
    ...summary.deletion,
    ...summary.adminAccess,
  ];
  let enforced = 0, attested = 0, aspirational = 0;
  for (const a of all) {
    if (a.confidence === "enforced") enforced++;
    else if (a.confidence === "attested") attested++;
    else aspirational++;
  }
  return { totalAssertions: all.length, enforced, attested, aspirational };
}

// ---------------------------------------------------------------------------
// Per-subject one-liner — useful for the Integrations Center
// ---------------------------------------------------------------------------

export function explainSubject(subject: DataSubject): { classification: string; policy: ReturnType<typeof policyForSubject> } {
  return {
    classification: CLASSIFICATION_LABEL[classify(subject)],
    policy: policyForSubject(subject),
  };
}
