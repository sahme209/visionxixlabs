/**
 * Pipeline Repair Engineer — runtime-gated orchestrator.
 *
 * Wraps `repairPipeline()` (pure planning kernel). Applying the
 * proposal back to GitHub is the risky action — it's gated through
 * `recordEngineerActionAttempt` with risk derived from the kernel's
 * own `recommendedGate`.
 */

import "server-only";

import { repairPipeline, type FailedRunSummary, type RepairProposal } from "@/lib/agents/githubPipelineRepairer";
import { recordEngineerActionAttempt } from "@/lib/workforce/engineerActionRecorder";
import type { ActionVerdict, ActionRiskLevel } from "@/lib/workforce/runtimeActionGate";

const ENGINEER_ID = "pipeline_repair_engineer";

export interface PipelineApplyInput {
  workspaceId: string;
  requestedBy: string;
  failedRun: FailedRunSummary;
  correlationId?: string;
}

export interface PipelineApplyResult {
  proposal: RepairProposal;
  verdict: ActionVerdict;
  attemptId: string;
  correlationId: string;
  approvalRequestId?: string;
}

function riskFor(proposal: RepairProposal): ActionRiskLevel {
  switch (proposal.recommendedGate) {
    case "auto_retry":      return "low";
    case "single_approval": return "medium";
    case "dual_approval":   return "high";
  }
}

export async function planAndRequestPipelineFix(input: PipelineApplyInput): Promise<PipelineApplyResult> {
  const proposal = repairPipeline(input.failedRun);
  const risk = riskFor(proposal);

  const recorded = await recordEngineerActionAttempt({
    workspaceId: input.workspaceId,
    engineerId: ENGINEER_ID,
    action: `apply_pipeline_fix:${proposal.category}:${proposal.proposalKind}`,
    riskLevel: risk,
    isReadOnly: false,
    module: "devops",
    connector: "github",
    requestedBy: input.requestedBy,
    correlationId: input.correlationId,
    metadata: {
      proposalId: proposal.id,
      category: proposal.category,
      proposalKind: proposal.proposalKind,
      filePath: proposal.filePath ?? "",
      confidence: proposal.confidence,
    },
  });
  return {
    proposal,
    verdict: recorded.verdict,
    attemptId: recorded.attemptId,
    correlationId: recorded.correlationId,
    approvalRequestId: recorded.approvalRequestId,
  };
}
