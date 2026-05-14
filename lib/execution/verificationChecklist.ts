/**
 * Verification Checklist Generator.
 *
 * Every remediation pairs with a verification checklist so we can prove
 * the change actually landed and didn't break anything. Checklist items
 * are typed and either automated (Axiom re-runs the scanner / probe) or
 * manual (operator confirms via console / dashboard).
 */

import type { RemediationCandidate } from "@/lib/remediation/remediationModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VerificationCheckExecution = "automated" | "manual";

export interface VerificationCheck {
  id: string;
  ordinal: number;
  title: string;
  detail: string;
  execution: VerificationCheckExecution;
  /** Optional URL the operator can hit to confirm. */
  validationAction?: { label: string; href: string };
  /** What "pass" looks like — concrete. */
  expectedState: string;
}

export interface VerificationChecklist {
  id: string;
  remediationCandidateId: string;
  checks: VerificationCheck[];
  provider: string;
  resourceIds: string[];
  validationMethod: "rerun_scanner" | "rerun_check" | "smoke_test" | "manual_review" | "drill";
  manualOrAutomated: "manual" | "automated" | "hybrid";
  evidenceRequired: string[];
  auditRequired: boolean;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Builders per remediation kind
// ---------------------------------------------------------------------------

function buildChecks(candidate: RemediationCandidate): VerificationCheck[] {
  const checks: VerificationCheck[] = [];
  const baseProvider = candidate.provider;
  const resource = candidate.resourceIds[0] ?? "(unspecified)";

  switch (candidate.category) {
    case "security_hardening": {
      if (candidate.connector.includes("network_exposure")) {
        if (candidate.connector.includes("s3")) {
          checks.push({
            id: `${candidate.id}.v1`,
            ordinal: 1,
            title: "Confirm S3 block-public-access flags are true",
            detail: `Inspect the public-access-block configuration on bucket ${resource}.`,
            execution: "automated",
            expectedState: "All four block-public-access flags are true.",
            validationAction: { label: "Re-run security scan", href: "/api/security-scan" },
          });
        } else {
          checks.push({
            id: `${candidate.id}.v1`,
            ordinal: 1,
            title: "Confirm wide 0.0.0.0/0 ingress is removed",
            detail: `Re-scan the security group ${resource} and confirm no rule allows 0.0.0.0/0 on the affected port.`,
            execution: "automated",
            expectedState: "No security group rule allows 0.0.0.0/0 on the affected port.",
            validationAction: { label: "Re-run security scan", href: "/api/security-scan" },
          });
        }
      }
      if (candidate.connector.includes("encryption_at_rest")) {
        checks.push({
          id: `${candidate.id}.v1`,
          ordinal: 1,
          title: "Confirm encryption-at-rest enabled",
          detail: `Verify the resource ${resource} reports default server-side encryption.`,
          execution: "automated",
          expectedState: "Bucket/volume reports SSE enabled with AES256 or KMS.",
        });
      }
      if (candidate.connector.includes("iam_overreach")) {
        checks.push({
          id: `${candidate.id}.v1`,
          ordinal: 1,
          title: "Confirm IAM trust evaluator grade improved",
          detail: `Re-run the IAM trust evaluator on ${resource} and verify the grade improved.`,
          execution: "automated",
          expectedState: "IAM trust grade is B or better.",
        });
      }
      checks.push({
        id: `${candidate.id}.v2`,
        ordinal: checks.length + 1,
        title: "Confirm resource is still reachable from approved networks",
        detail: "Validate that legitimate workloads / consumers still reach the resource.",
        execution: "manual",
        expectedState: "Approved internal callers still succeed end-to-end.",
      });
      break;
    }

    case "configuration_change": {
      checks.push({
        id: `${candidate.id}.v1`,
        ordinal: 1,
        title: "Re-scan resource and confirm finding cleared",
        detail: `Re-run the scanner for ${baseProvider} and confirm the finding for ${resource} is no longer present.`,
        execution: "automated",
        expectedState: "Finding is absent from the next scan output.",
        validationAction: { label: "Re-run scan", href: "/api/security-scan" },
      });
      break;
    }

    case "cost_optimization": {
      checks.push({
        id: `${candidate.id}.v1`,
        ordinal: 1,
        title: "Confirm cost telemetry dropped",
        detail: "Wait one full billing window and confirm the cost line item dropped against forecast.",
        execution: "manual",
        expectedState: "Daily/monthly cost line for the resource decreased as projected.",
      });
      checks.push({
        id: `${candidate.id}.v2`,
        ordinal: 2,
        title: "Confirm workload still meets SLO",
        detail: "Confirm latency / throughput / error rate are within SLO after resize.",
        execution: "manual",
        expectedState: "All SLOs hold post-change.",
      });
      break;
    }

    case "reliability_improvement": {
      checks.push({
        id: `${candidate.id}.v1`,
        ordinal: 1,
        title: "Confirm backup / replica is healthy",
        detail: "Verify the new backup or replica completed at least once and reports a healthy state.",
        execution: "automated",
        expectedState: "Backup / replica state is healthy in the provider console.",
      });
      checks.push({
        id: `${candidate.id}.v2`,
        ordinal: 2,
        title: "Run a rollback drill",
        detail: "Optionally restore from the most recent backup to a side environment.",
        execution: "manual",
        expectedState: "Restore succeeds end-to-end.",
      });
      break;
    }

    case "pipeline_governance": {
      checks.push({
        id: `${candidate.id}.v1`,
        ordinal: 1,
        title: "Confirm branch protection is enabled",
        detail: `Verify GitHub branch protection on ${resource}.`,
        execution: "automated",
        expectedState: "Protection rule shows required reviewers + status checks + signatures.",
        validationAction: { label: "Re-validate GitHub", href: "/api/github/validate" },
      });
      checks.push({
        id: `${candidate.id}.v2`,
        ordinal: 2,
        title: "Confirm release-readiness score improved",
        detail: "Re-score release readiness and confirm the blocker is resolved.",
        execution: "automated",
        expectedState: "Release readiness no longer lists this blocker.",
      });
      break;
    }

    case "desktop_review":
      checks.push({
        id: `${candidate.id}.v1`,
        ordinal: 1,
        title: "Confirm local review opened on desktop",
        detail: "Handoff was opened in the desktop inbox and policy/approval state visible.",
        execution: "manual",
        expectedState: "Desktop inbox shows the handoff with policy + approval state.",
      });
      break;

    case "documentation_only":
    case "manual_external_required":
      checks.push({
        id: `${candidate.id}.v1`,
        ordinal: 1,
        title: "Operator acknowledged + recorded outcome",
        detail: "Operator confirms they read the recommendation and recorded the outcome.",
        execution: "manual",
        expectedState: "Outcome recorded in workspace notes.",
      });
      break;
  }

  return checks;
}

function methodFor(category: RemediationCandidate["category"]): VerificationChecklist["validationMethod"] {
  switch (category) {
    case "security_hardening":       return "rerun_check";
    case "configuration_change":     return "rerun_scanner";
    case "cost_optimization":        return "smoke_test";
    case "reliability_improvement":  return "drill";
    case "pipeline_governance":      return "manual_review";
    case "desktop_review":           return "manual_review";
    case "documentation_only":       return "manual_review";
    case "manual_external_required": return "manual_review";
  }
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export function generateVerificationChecklist(candidate: RemediationCandidate): VerificationChecklist {
  const checks = buildChecks(candidate);
  const allManual = checks.every((c) => c.execution === "manual");
  const allAuto   = checks.every((c) => c.execution === "automated");

  return {
    id: `vc.${candidate.id}`,
    remediationCandidateId: candidate.id,
    checks,
    provider: candidate.provider,
    resourceIds: candidate.resourceIds,
    validationMethod: methodFor(candidate.category),
    manualOrAutomated: allManual ? "manual" : allAuto ? "automated" : "hybrid",
    evidenceRequired: candidate.evidence.map((e) => `${e.label}=${e.ref}`),
    auditRequired: candidate.auditRequirement === "required",
    generatedAt: new Date().toISOString(),
  };
}

export function generateVerificationChecklists(candidates: RemediationCandidate[]): VerificationChecklist[] {
  return candidates.map(generateVerificationChecklist);
}
