/**
 * Native Security Operations — typed model.
 *
 * Unified model for findings produced by native scanners (the agent
 * kernels we already ship) AND mirrored from external connectors
 * (Wiz, Snyk, Prisma Cloud, CrowdStrike). Both feed the same UI tables
 * and the same incident-promotion path.
 *
 * Pure types — persistence lands in a follow-up Prisma migration.
 */

import type { OrganizationId } from "@/lib/domain/ids";

export type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";

export type FindingCategory =
  | "cloud_posture"
  | "iam_risk"
  | "secret_exposure"
  | "public_resource"
  | "missing_encryption"
  | "dependency_vulnerability"
  | "container_vulnerability"
  | "iac_misconfiguration"
  | "endpoint_posture"
  | "network_policy"
  | "compliance_gap"
  | "credential_hygiene";

export interface SecurityFinding {
  organizationId: OrganizationId;
  id: string;
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  /** Source of the finding — native kernel or which connector mirrored it. */
  source: "native_scanner" | "connector_wiz" | "connector_snyk" | "connector_prisma_cloud" | "connector_crowdstrike" | "manual";
  /** The kernel id when source === "native_scanner". */
  scannerKernel?: string;
  /** Affected service id when known. */
  affectedServiceId?: string;
  /** Affected resource external identifier (e.g. `arn:aws:s3:::bucket`). */
  affectedResourceRef?: string;
  /** Evidence references that prove the finding. */
  evidence: ReadonlyArray<{ kind: string; ref: string; label?: string }>;
  /** Plain-English recommendation. */
  recommendation?: string;
  /** Whether remediation requires an operator approval. */
  approvalRequired: boolean;
  /** Whether automation is available to remediate. */
  automationAvailable: boolean;
  /** Finding state machine. */
  status: "open" | "acknowledged" | "in_remediation" | "resolved" | "wont_fix" | "false_positive";
  /** ISO timestamp first detected. */
  detectedAt: string;
  /** ISO timestamp last seen — re-checked on rescan. */
  lastSeenAt: string;
}

export interface VulnerabilityFinding extends SecurityFinding {
  /** CVE id when applicable. */
  cveId?: string;
  /** CVSS score 0..10 when applicable. */
  cvssScore?: number;
  /** Affected package + fixed-in version. */
  affectedPackage?: { name: string; installedVersion: string; fixedInVersion?: string };
}

export interface ComplianceCheck {
  organizationId: OrganizationId;
  id: string;
  /** Framework — SOC2 / ISO27001 / HIPAA / GDPR / PCI / custom. */
  framework: string;
  /** Specific control identifier within the framework. */
  control: string;
  /** Plain-English description of the control. */
  description: string;
  /** Verdict. */
  status: "passing" | "failing" | "not_applicable" | "manual_review";
  /** Evidence proving the verdict. */
  evidence: ReadonlyArray<{ kind: string; ref: string; label?: string }>;
  /** ISO timestamp of last evaluation. */
  evaluatedAt: string;
}

export interface RiskScore {
  organizationId: OrganizationId;
  /** What this score scopes to. */
  scope: { kind: "organization" } | { kind: "service"; serviceId: string } | { kind: "environment"; environmentKind: string };
  /** 0..100 risk score, higher = more risk. */
  score: number;
  /** Closed-union risk band derived from score. */
  band: "low" | "medium" | "high" | "critical";
  /** Top-3 contributing findings by id. */
  topContributingFindingIds: readonly string[];
  /** ISO timestamp of computation. */
  computedAt: string;
}
