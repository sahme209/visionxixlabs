/**
 * Vitest unit tests for the compounded-risk reasoner.
 *
 * Verifies the three patterns:
 *   - exposed_compute_no_governance (AWS public ingress + no branch protection)
 *   - public_db_audit_gap (public DB + audit compliance gap)
 *   - broken_pipeline_no_approval (failing workflow + no branch protection)
 *
 * Pure-function tests — no IO.
 */

import { describe, it, expect } from "vitest";
import { reasonCompoundedRisks } from "../compoundedRiskReasoner";
import type { SecurityFinding } from "../vulnerabilityModel";

function mk(overrides: Partial<SecurityFinding>): SecurityFinding {
  return {
    id: `f.${Math.random().toString(36).slice(2, 7)}`,
    sourceSystem: "platform",
    category: "unknown_or_unverified",
    severity: "low",
    title: "test",
    description: "test",
    affectedResourceIds: [],
    sourceMode: "live",
    confidence: 0.9,
    evidence: [],
    limitations: [],
    remediationEligible: false,
    simulationEligible: false,
    approvalRequired: false,
    desktopReviewEligible: false,
    verificationRequired: false,
    auditRequired: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("compounded-risk reasoner", () => {
  it("detects exposed_compute_no_governance when AWS public SSH + GitHub no branch protection coexist", () => {
    const findings: SecurityFinding[] = [
      mk({ sourceSystem: "aws", category: "cloud_network_exposure", title: "Security group sg-123 open SSH 0.0.0.0/0" }),
      mk({ sourceSystem: "github", category: "repository_protection_gap", title: "Branch protection missing on payments-api:main" }),
    ];
    const result = reasonCompoundedRisks({ findings });
    expect(result.compoundedFindings.find((f) => f.id === "compounded.exposed_compute_no_governance")).toBeDefined();
    expect(result.patternHits.find((p) => p.pattern === "exposed_compute_no_governance")?.count).toBeGreaterThan(0);
  });

  it("does NOT fire exposed_compute_no_governance when only one side is present", () => {
    const onlyPublic = reasonCompoundedRisks({ findings: [
      mk({ sourceSystem: "aws", category: "cloud_network_exposure", title: "SSH 0.0.0.0/0" }),
    ] });
    expect(onlyPublic.compoundedFindings.find((f) => f.id === "compounded.exposed_compute_no_governance")).toBeUndefined();

    const onlyProtection = reasonCompoundedRisks({ findings: [
      mk({ sourceSystem: "github", category: "repository_protection_gap", title: "Branch unprotected" }),
    ] });
    expect(onlyProtection.compoundedFindings.find((f) => f.id === "compounded.exposed_compute_no_governance")).toBeUndefined();
  });

  it("detects public_db_audit_gap when public RDS + audit compliance gap coexist", () => {
    const findings: SecurityFinding[] = [
      mk({ sourceSystem: "aws", category: "cloud_database_exposure", title: "RDS payments-prod publicly accessible" }),
      mk({ sourceSystem: "app", category: "compliance_evidence_gap", title: "Audit store missing" }),
    ];
    const result = reasonCompoundedRisks({ findings });
    expect(result.compoundedFindings.find((f) => f.id === "compounded.public_db_audit_gap")).toBeDefined();
  });

  it("detects broken_pipeline_no_approval when failing workflow + no branch protection coexist", () => {
    const findings: SecurityFinding[] = [
      mk({ sourceSystem: "github", category: "pipeline_failure", title: "CI failing on main" }),
      mk({ sourceSystem: "github", category: "repository_protection_gap", title: "Branch unprotected" }),
    ];
    const result = reasonCompoundedRisks({ findings });
    expect(result.compoundedFindings.find((f) => f.id === "compounded.broken_pipeline_no_approval")).toBeDefined();
  });

  it("returns empty compoundedFindings when no patterns match", () => {
    const result = reasonCompoundedRisks({ findings: [
      mk({ sourceSystem: "desktop", category: "desktop_security_risk", title: "Unsigned" }),
    ] });
    expect(result.compoundedFindings).toHaveLength(0);
    expect(result.patternHits).toHaveLength(0);
  });

  it("rolls up sourceMode honestly (any preview drags the result down)", () => {
    const findings: SecurityFinding[] = [
      mk({ sourceSystem: "aws", category: "cloud_network_exposure", sourceMode: "live", title: "SSH live" }),
      mk({ sourceSystem: "github", category: "repository_protection_gap", sourceMode: "preview", title: "Preview" }),
    ];
    const result = reasonCompoundedRisks({ findings });
    const compounded = result.compoundedFindings.find((f) => f.id === "compounded.exposed_compute_no_governance");
    expect(compounded?.sourceMode).toBe("preview");
  });
});
