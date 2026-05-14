/**
 * Compliance evidence bundle — themed exporters for security review.
 *
 * Distinct from `lib/audit/auditBundle.ts` (per-operation audit story).
 * This module produces *thematic* bundles a reviewer asks for:
 *   - Security Review Bundle (full posture across all controls)
 *   - AWS Connection Bundle
 *   - GitHub / ReleaseOps Bundle
 *   - Desktop Security Bundle
 *   - Execution Approval Bundle
 *   - Audit Trail Bundle
 *   - AI Safety Bundle
 *   - Tenant Isolation Bundle
 *   - Release Distribution Bundle
 *
 * Serialised as JSON / NDJSON honestly. PDF intentionally absent — never
 * fake unavailable formats.
 */

import type { CorrelationId, OrganizationId } from "@/lib/domain/ids";
import type { DataSource } from "@/lib/domain/source";
import {
  CONTROL_REGISTRY,
  summarizeControls,
  type ComplianceControl,
  type ControlCategory,
  type ControlSummary,
} from "./controlRegistry";
import {
  collectForControl,
  summarizeEvidence,
  type EvidenceSummary,
} from "./evidenceCollector";
import type { EvidenceSources } from "./evidenceCollector";
import type { EvidenceRecord } from "./evidenceModel";

// ---------------------------------------------------------------------------
// Bundle kinds + scope
// ---------------------------------------------------------------------------

export type ComplianceBundleKind =
  | "security_review"
  | "aws_connection"
  | "github_releaseops"
  | "desktop_security"
  | "execution_approval"
  | "audit_trail"
  | "ai_safety"
  | "tenant_isolation"
  | "release_distribution";

const KIND_CATEGORIES: Record<ComplianceBundleKind, ControlCategory[]> = {
  security_review:    [
    "access_control", "tenant_isolation", "credential_security", "secret_redaction",
    "audit_logging", "approval_enforcement", "policy_enforcement", "ai_safety",
    "desktop_security", "connector_security", "data_classification", "reliability",
    "incident_recovery", "release_security", "supply_chain", "data_export", "revocation",
  ],
  aws_connection:     ["credential_security", "tenant_isolation", "audit_logging", "connector_security", "revocation"],
  github_releaseops:  ["connector_security", "secret_redaction", "audit_logging", "approval_enforcement"],
  desktop_security:   ["desktop_security", "release_security", "approval_enforcement", "audit_logging"],
  execution_approval: ["approval_enforcement", "policy_enforcement", "audit_logging", "incident_recovery"],
  audit_trail:        ["audit_logging", "data_export", "tenant_isolation"],
  ai_safety:          ["ai_safety", "secret_redaction", "data_classification"],
  tenant_isolation:   ["tenant_isolation", "access_control", "audit_logging"],
  release_distribution: ["release_security", "supply_chain", "desktop_security"],
};

export const BUNDLE_KIND_LABEL: Record<ComplianceBundleKind, string> = {
  security_review:      "Security review",
  aws_connection:       "AWS connection",
  github_releaseops:    "GitHub / ReleaseOps",
  desktop_security:     "Desktop security",
  execution_approval:   "Execution approval",
  audit_trail:          "Audit trail",
  ai_safety:            "AI safety",
  tenant_isolation:     "Tenant isolation",
  release_distribution: "Release distribution",
};

// ---------------------------------------------------------------------------
// Bundle record
// ---------------------------------------------------------------------------

export interface ComplianceBundle {
  id: string;
  kind: ComplianceBundleKind;
  organizationId?: OrganizationId;
  correlationId?: CorrelationId;
  generatedAt: string;
  source: DataSource;
  executiveSummary: string;
  controlSummary: ControlSummary;
  evidenceSummary: EvidenceSummary;
  controls: ComplianceControl[];
  evidence: EvidenceRecord[];
  limitations: string[];
  redactionNotice: string;
}

const REDACTION_NOTICE =
  "Every evidence record has passed through the Axiom redaction pipeline. " +
  "No credentials, tokens, private keys, or PII appear in this bundle.";

let _seq = 0;
function newBundleId(): string {
  _seq = (_seq + 1) % 1_000_000;
  return `cbundle_${Date.now().toString(36)}_${_seq.toString(36).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export interface BuildBundleInput {
  kind: ComplianceBundleKind;
  organizationId?: OrganizationId;
  correlationId?: CorrelationId;
  source?: DataSource;
  sources?: EvidenceSources;
}

export async function buildComplianceBundle(input: BuildBundleInput): Promise<ComplianceBundle> {
  const cats = KIND_CATEGORIES[input.kind];
  const controls = CONTROL_REGISTRY.filter((c) => cats.includes(c.category));
  const controlSummary = summarizeControls(controls);

  const evidence: EvidenceRecord[] = [];
  for (const c of controls) {
    evidence.push(
      ...(await collectForControl(c.id, {
        organizationId: input.organizationId,
        correlationId: input.correlationId,
        sources: input.sources,
      })),
    );
  }
  const evidenceSummary = summarizeEvidence(evidence);

  // Honest limitations — surface gaps rather than hiding them.
  const limitations: string[] = [];
  if (evidenceSummary.unverified > 0) {
    limitations.push(
      `${evidenceSummary.unverified} of ${evidenceSummary.total} evidence records are unverified — the runtime check is pending.`,
    );
  }
  if (controlSummary.planned > 0) {
    limitations.push(
      `${controlSummary.planned} control(s) in scope are still planned and have no implementation evidence yet.`,
    );
  }
  if (input.source === "preview") {
    limitations.push(
      "Bundle generated from preview data — values reflect the platform's architectural posture, " +
      "not a live customer environment.",
    );
  }

  const exec = composeExecutiveSummary(input.kind, controlSummary, evidenceSummary);

  return {
    id: newBundleId(),
    kind: input.kind,
    organizationId: input.organizationId,
    correlationId: input.correlationId,
    generatedAt: new Date().toISOString(),
    source: input.source ?? "preview",
    executiveSummary: exec,
    controlSummary,
    evidenceSummary,
    controls,
    evidence,
    limitations,
    redactionNotice: REDACTION_NOTICE,
  };
}

function composeExecutiveSummary(kind: ComplianceBundleKind, controls: ControlSummary, evidence: EvidenceSummary): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return [
    `${BUNDLE_KIND_LABEL[kind]} bundle for Axiom (visionxixlabs).`,
    `${controls.implemented} of ${controls.total} controls implemented, ${controls.partial} partial, ${controls.planned} planned.`,
    `Control coverage: ${pct(controls.score)}.`,
    `Evidence verification: ${evidence.verified} verified, ${evidence.selfAttested} self-attested, ${evidence.manual} manual, ${evidence.unverified} unverified.`,
    `Evidence coverage score: ${pct(evidence.coverageScore)}.`,
  ].join(" ");
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

export type ComplianceBundleFormat = "json" | "ndjson";

export interface SerializedComplianceBundle {
  format: ComplianceBundleFormat;
  contentType: string;
  body: string;
  filename: string;
}

export function serializeComplianceBundle(
  bundle: ComplianceBundle,
  format: ComplianceBundleFormat,
): SerializedComplianceBundle {
  if (format === "json") {
    return {
      format,
      contentType: "application/json",
      body: JSON.stringify(bundle, null, 2),
      filename: `${bundle.id}.json`,
    };
  }
  // ndjson — one record per line for streaming reviewers
  const lines: string[] = [
    JSON.stringify({ section: "summary", id: bundle.id, kind: bundle.kind, source: bundle.source, generatedAt: bundle.generatedAt, executiveSummary: bundle.executiveSummary }),
    JSON.stringify({ section: "controlSummary", ...bundle.controlSummary }),
    JSON.stringify({ section: "evidenceSummary", ...bundle.evidenceSummary }),
    ...bundle.controls.map((c) => JSON.stringify({ section: "control", ...c })),
    ...bundle.evidence.map((e) => JSON.stringify({ section: "evidence", ...e })),
    ...bundle.limitations.map((l, i) => JSON.stringify({ section: "limitation", index: i, text: l })),
    JSON.stringify({ section: "redactionNotice", text: bundle.redactionNotice }),
  ];
  return {
    format,
    contentType: "application/x-ndjson",
    body: lines.join("\n"),
    filename: `${bundle.id}.ndjson`,
  };
}

export const SUPPORTED_COMPLIANCE_FORMATS: ComplianceBundleFormat[] = ["json", "ndjson"];
