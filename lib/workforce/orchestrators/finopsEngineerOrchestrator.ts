/**
 * FinOps Engineer — runtime-gated orchestrator.
 *
 * Wraps `detectIdleResources()`. Applying the finding's recommendation
 * is the risky action — gated through `recordEngineerActionAttempt`
 * with risk derived from the finding's `riskTier`.
 */

import "server-only";

import { detectIdleResources, type IdleResourceInput, type IdleResourceFinding } from "@/lib/agents/idleCloudResourceDetector";
import { recordEngineerActionAttempt } from "@/lib/workforce/engineerActionRecorder";
import type { ActionVerdict, ActionRiskLevel } from "@/lib/workforce/runtimeActionGate";

const ENGINEER_ID = "finops_engineer";

export interface FinopsApplyInput {
  workspaceId: string;
  requestedBy: string;
  /** Caller passes the candidate resources observed in the workspace. */
  resources: readonly IdleResourceInput[];
  /** Caller picks one finding id to apply. */
  findingId: string;
  /** Defaults to "aws" — the connector that surfaced the finding. */
  connector?: "aws" | "azure" | "gcp";
  correlationId?: string;
}

export type FinopsApplyResult =
  | { ok: false; reason: "finding_not_found" }
  | { ok: true; finding: IdleResourceFinding; verdict: ActionVerdict; attemptId: string; correlationId: string; approvalRequestId?: string };

function riskFor(finding: IdleResourceFinding): ActionRiskLevel {
  switch (finding.riskTier) {
    case "low":      return "low";
    case "medium":   return "medium";
    case "high":     return "high";
    case "critical": return "critical";
  }
}

export async function planAndRequestFinopsAction(input: FinopsApplyInput): Promise<FinopsApplyResult> {
  const findings = detectIdleResources(input.resources);
  const finding = findings.find((f) => f.id === input.findingId);
  if (!finding) return { ok: false, reason: "finding_not_found" };

  const recorded = await recordEngineerActionAttempt({
    workspaceId: input.workspaceId,
    engineerId: ENGINEER_ID,
    action: `apply_rightsize_action:${finding.recommendation.kind}:${finding.kind}`,
    riskLevel: riskFor(finding),
    isReadOnly: false,
    module: "finops",
    connector: input.connector ?? "aws",
    requestedBy: input.requestedBy,
    correlationId: input.correlationId,
    metadata: {
      findingId: finding.id,
      resourceId: finding.resourceId,
      kind: finding.kind,
      recommendationKind: finding.recommendation.kind,
      monthlySavingsUsd: finding.monthlySavingsUsd,
    },
  });
  return {
    ok: true,
    finding,
    verdict: recorded.verdict,
    attemptId: recorded.attemptId,
    correlationId: recorded.correlationId,
    approvalRequestId: recorded.approvalRequestId,
  };
}
