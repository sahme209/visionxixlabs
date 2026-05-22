/**
 * Pipeline-stage approval minter — Phase 378.
 *
 * When the pipeline runner hits an approval_gate stage, it mints an
 * EngineerApprovalSnapshot with sourceKind="pipeline_stage" + the
 * stage row id. The existing two-step quorum machinery (Phase 369)
 * applies unchanged. The /decide route resumes the pipeline when
 * the snapshot transitions to a terminal status.
 *
 * Pipeline gates default to:
 *   - effectiveRule = "two_step_approval"
 *   - requiredApprovers = 2
 *   - riskLevel = "critical"
 *
 * Risk floor is intentionally critical — these gates exist precisely
 * to stop production deploys / schema applies / etc.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";

export interface MintPipelineStageApprovalInput {
  organizationId: string;
  pipelineId: string;
  runId: string;
  stageRunId: string;
  stageId: string;
  stageName: string;
  requestedBy: string;
  correlationId: string;
}

export interface MintPipelineStageApprovalResult {
  approvalRequestId: string;
  snapshotId: string;
}

/**
 * Synthetic engineerId used for pipeline-sourced approvals. Not in
 * the workforce registry — surface-aware code (ENGINEER_LOOKUP) skips
 * it and renders pipeline copy instead.
 */
export const PIPELINE_ORCHESTRATOR_ENGINEER_ID = "pipeline_orchestrator";

export async function mintPipelineStageApproval(
  input: MintPipelineStageApprovalInput,
): Promise<MintPipelineStageApprovalResult> {
  // approvalRequestId is the join key the engine + queue + decide route share.
  const approvalRequestId = `apr_pipe_${input.stageRunId}_${Date.now().toString(36)}`;

  const snapshot = await prisma.engineerApprovalSnapshot.create({
    data: {
      organizationId: input.organizationId,
      approvalRequestId,
      engineerId: PIPELINE_ORCHESTRATOR_ENGINEER_ID,
      action: `pipeline_stage:${input.pipelineId}:${input.stageId}`,
      attemptId: null,
      riskLevel: "critical",
      effectiveRule: "two_step_approval",
      requiredApprovers: 2,
      correlationId: input.correlationId,
      status: "pending",
      requestedBy: input.requestedBy,
      sourceKind: "pipeline_stage",
      pipelineStageRunId: input.stageRunId,
    },
  });

  // Audit the mint so the trail shows "pipeline X stage Y opened a gate".
  try {
    await recordAudit({
      organizationId: idFactory.organization(input.organizationId),
      actorUserId: idFactory.user(input.requestedBy),
      actorKind: "user",
      action: "engineer.approval_created",
      outcome: "success",
      entityRef: `approval:${approvalRequestId}`,
      correlationId: idFactory.correlation(input.correlationId),
      source: "live",
      detail: {
        approvalId: approvalRequestId,
        sourceKind: "pipeline_stage",
        pipelineId: input.pipelineId,
        runId: input.runId,
        stageId: input.stageId,
        stageName: input.stageName,
        requiredApprovers: 2,
      },
    });
  } catch { /* best-effort */ }

  return { approvalRequestId, snapshotId: snapshot.id };
}
