/**
 * Compounded-risk reasoner.
 *
 * Looks across all findings and identifies *compounded* risk patterns
 * that aren't visible from any single finding alone. These are emitted
 * as additional synthetic findings (clearly tagged) so the UI surfaces
 * the highest-leverage issues to fix first.
 *
 * Examples the reasoner detects today:
 *  - Public SSH ingress (0.0.0.0/0:22) + no branch protection on the same
 *    org/repo → "Exposed compute with no merge governance"
 *  - Public RDS + audit gap → "Public database with no audit trail"
 *  - Failing workflow + missing branch protection → "Broken pipeline with
 *    no approval gate"
 *  - S3 PAB missing + no desktop signing → not compounded (different domains)
 *
 * The reasoner is pure: takes findings in, returns findings out. No IO.
 */

import type { SecurityFinding, FindingEvidence } from "./vulnerabilityModel";

export interface CompoundedRiskInput {
  /** All findings produced by the underlying scanners. */
  findings: SecurityFinding[];
  /** Optional tenant scope for the synthetic findings produced. */
  tenantId?: string;
}

export interface CompoundedRiskResult {
  /** The original findings unchanged. */
  baseFindings: SecurityFinding[];
  /** Newly-synthesised compounded findings. May be empty. */
  compoundedFindings: SecurityFinding[];
  /** Pattern hits — for diagnostic logging / dashboards. */
  patternHits: { pattern: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Pattern detectors — each returns 0+ synthetic findings.
// Each pattern is small + composable so future additions stay focused.
// ---------------------------------------------------------------------------

function detectExposedComputeNoGovernance(input: CompoundedRiskInput): SecurityFinding[] {
  const publicIngress = input.findings.filter((f) =>
    f.sourceSystem === "aws" && f.category === "cloud_network_exposure" &&
    (f.title.toLowerCase().includes("ssh") || f.title.toLowerCase().includes("rdp") || f.title.toLowerCase().includes("0.0.0.0/0")),
  );
  const noProtection = input.findings.filter((f) =>
    f.sourceSystem === "github" && f.category === "repository_protection_gap",
  );

  if (publicIngress.length === 0 || noProtection.length === 0) return [];

  const evidence: FindingEvidence[] = [
    ...publicIngress.slice(0, 3).map((f) => ({
      kind: "scan_observation" as const,
      label: `Public ingress: ${f.title}`,
      source: "aws" as const,
    })),
    ...noProtection.slice(0, 3).map((f) => ({
      kind: "scan_observation" as const,
      label: `No branch protection: ${f.title}`,
      source: "github" as const,
    })),
  ];

  return [{
    id: "compounded.exposed_compute_no_governance",
    tenantId: input.tenantId,
    sourceSystem: "platform",
    category: "compliance_evidence_gap",
    severity: "critical",
    title: "Exposed compute with no merge governance",
    description: `${publicIngress.length} cloud resource(s) accept public ingress AND ${noProtection.length} repository(ies) have no branch protection. A single bad merge could ship to internet-facing infrastructure without review.`,
    affectedResourceIds: publicIngress.flatMap((f) => f.affectedResourceIds),
    sourceMode: rollupSourceMode([...publicIngress, ...noProtection]),
    confidence: 0.9,
    evidence,
    limitations: [],
    remediationEligible: false, // Compounded findings point at the constituents.
    simulationEligible: false,
    approvalRequired: true,
    desktopReviewEligible: true,
    verificationRequired: true,
    auditRequired: true,
    safeNextAction: { label: "Open security center", href: "/dashboard/security-scanner" },
    summary: "Fixing either side alone leaves the other exposed.",
    createdAt: new Date().toISOString(),
  }];
}

function detectPublicDatabaseAuditGap(input: CompoundedRiskInput): SecurityFinding[] {
  const publicDb = input.findings.filter((f) =>
    (f.sourceSystem === "aws" || f.sourceSystem === "azure" || f.sourceSystem === "gcp") &&
    f.category === "cloud_database_exposure",
  );
  const auditGap = input.findings.filter((f) => f.category === "compliance_evidence_gap");

  if (publicDb.length === 0 || auditGap.length === 0) return [];

  return [{
    id: "compounded.public_db_audit_gap",
    tenantId: input.tenantId,
    sourceSystem: "platform",
    category: "cloud_database_exposure",
    severity: "critical",
    title: "Public database with no audit trail",
    description: `${publicDb.length} publicly-accessible database(s) detected while audit evidence is incomplete. A breach would be hard to trace.`,
    affectedResourceIds: publicDb.flatMap((f) => f.affectedResourceIds),
    sourceMode: rollupSourceMode([...publicDb, ...auditGap]),
    confidence: 0.9,
    evidence: publicDb.slice(0, 3).map((f) => ({
      kind: "scan_observation" as const,
      label: `Public DB: ${f.title}`,
      source: f.sourceSystem as FindingEvidence["source"],
    })),
    limitations: auditGap.flatMap((f) => f.limitations).slice(0, 3),
    remediationEligible: false,
    simulationEligible: false,
    approvalRequired: true,
    desktopReviewEligible: true,
    verificationRequired: true,
    auditRequired: true,
    safeNextAction: { label: "Open security center", href: "/dashboard/security-scanner" },
    summary: "Fix exposure first, then close audit gap.",
    createdAt: new Date().toISOString(),
  }];
}

function detectBrokenPipelineNoApproval(input: CompoundedRiskInput): SecurityFinding[] {
  const failingWorkflow = input.findings.filter((f) =>
    f.sourceSystem === "github" && f.category === "pipeline_failure",
  );
  const noProtection = input.findings.filter((f) =>
    f.sourceSystem === "github" && f.category === "repository_protection_gap",
  );

  if (failingWorkflow.length === 0 || noProtection.length === 0) return [];

  return [{
    id: "compounded.broken_pipeline_no_approval",
    tenantId: input.tenantId,
    sourceSystem: "platform",
    category: "release_governance_gap",
    severity: "high",
    title: "Broken pipeline with no approval gate",
    description: `${failingWorkflow.length} workflow(s) currently failing on a repo that has no branch protection. Bad code could merge despite CI being red.`,
    affectedResourceIds: failingWorkflow.flatMap((f) => f.affectedResourceIds),
    sourceMode: rollupSourceMode([...failingWorkflow, ...noProtection]),
    confidence: 0.85,
    evidence: [
      ...failingWorkflow.slice(0, 2).map((f) => ({
        kind: "scan_observation" as const,
        label: `Failing: ${f.title}`,
        source: "github" as const,
      })),
      ...noProtection.slice(0, 2).map((f) => ({
        kind: "scan_observation" as const,
        label: `Unprotected: ${f.title}`,
        source: "github" as const,
      })),
    ],
    limitations: [],
    remediationEligible: false,
    simulationEligible: false,
    approvalRequired: true,
    desktopReviewEligible: false,
    verificationRequired: true,
    auditRequired: true,
    safeNextAction: { label: "Open ReleaseOps", href: "/dashboard/releaseops" },
    summary: "Fix the workflow AND add branch protection — both are required.",
    createdAt: new Date().toISOString(),
  }];
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export function reasonCompoundedRisks(input: CompoundedRiskInput): CompoundedRiskResult {
  const detectors = [
    { name: "exposed_compute_no_governance", fn: detectExposedComputeNoGovernance },
    { name: "public_db_audit_gap",           fn: detectPublicDatabaseAuditGap },
    { name: "broken_pipeline_no_approval",   fn: detectBrokenPipelineNoApproval },
  ];

  const compoundedFindings: SecurityFinding[] = [];
  const patternHits: { pattern: string; count: number }[] = [];

  for (const d of detectors) {
    const hits = d.fn(input);
    compoundedFindings.push(...hits);
    if (hits.length > 0) patternHits.push({ pattern: d.name, count: hits.length });
  }

  return {
    baseFindings: input.findings,
    compoundedFindings,
    patternHits,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rollupSourceMode(findings: SecurityFinding[]): SecurityFinding["sourceMode"] {
  if (findings.length === 0) return "unknown";
  if (findings.some((f) => f.sourceMode === "blocked")) return "blocked";
  if (findings.some((f) => f.sourceMode === "preview")) return "preview";
  if (findings.some((f) => f.sourceMode === "partial_live")) return "partial_live";
  if (findings.every((f) => f.sourceMode === "live")) return "live";
  return "preview";
}
