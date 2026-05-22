/**
 * Migration Engineer — runtime-gated orchestrator.
 *
 * Wraps the pure `buildRunbook()` kernel from migrationCoordinator with
 * the workforce runtime gate. Any caller that wants to actually APPLY a
 * migration plan goes through here:
 *
 *    1. Build the typed runbook (pure planning — no DB).
 *    2. If the runbook has errors or the overall verdict is "blocked",
 *       refuse immediately — no need to even ask the gate.
 *    3. Call recordEngineerActionAttempt for "apply_migration" with
 *       risk = "critical" (always two-step approval).
 *    4. Return the runbook + the verdict + the approval id so the
 *       caller knows EXACTLY whether to execute, wait for approval, or
 *       refuse.
 *
 * This is the canonical pattern for Phase 364+: pure kernel + thin
 * orchestrator that records the gate. Every engineer in the registry
 * eventually gets one of these.
 */

import "server-only";

import {
  buildRunbook,
  type MigrationDescriptor,
  type MigrationRunbook,
} from "@/lib/agents/migrationCoordinator";
import { recordEngineerActionAttempt } from "@/lib/workforce/engineerActionRecorder";
import type { ActionVerdict } from "@/lib/workforce/runtimeActionGate";

const ENGINEER_ID = "migration_engineer";

export interface PlanAndRequestApplyInput {
  workspaceId: string;
  requestedBy: string;
  descriptor: MigrationDescriptor;
  /** Optional connector this targets — e.g. "postgres", "mysql". */
  connector?: string;
  /** Optional correlation id when this is part of a larger workflow. */
  correlationId?: string;
}

export type PlanAndRequestApplyResult =
  | {
      ok: false;
      reason: "runbook_blocked";
      runbook: MigrationRunbook;
    }
  | {
      ok: true;
      runbook: MigrationRunbook;
      verdict: ActionVerdict;
      attemptId: string;
      correlationId: string;
      approvalRequestId?: string;
    };

/**
 * Plans the migration AND records the gated apply attempt.
 *
 * The caller MUST inspect `result.verdict.decision`:
 *   - "allowed"            → safe to execute (rare — risk floor forces approval)
 *   - "requires_approval"  → wait for approval, then execute using
 *                            result.approvalRequestId as evidence
 *   - "blocked"            → refuse; surface result.verdict.reason to operator
 */
export async function planAndRequestMigrationApply(
  input: PlanAndRequestApplyInput,
): Promise<PlanAndRequestApplyResult> {
  // 1. Pure planning step.
  const runbook = buildRunbook(input.descriptor);

  // 2. Refuse early when the runbook itself is unsafe — saves an audit
  // row + an approval mint.
  if (runbook.overallVerdict === "blocked") {
    return { ok: false, reason: "runbook_blocked", runbook };
  }

  // 3. Gated apply attempt.
  const recorded = await recordEngineerActionAttempt({
    workspaceId: input.workspaceId,
    engineerId: ENGINEER_ID,
    action: `apply_migration:${input.descriptor.kind}:${input.descriptor.target}`,
    riskLevel: "critical",
    isReadOnly: false,
    module: "database",
    connector: input.connector ?? "postgres",
    requestedBy: input.requestedBy,
    correlationId: input.correlationId,
    metadata: {
      migrationId: input.descriptor.id,
      migrationKind: input.descriptor.kind,
      target: input.descriptor.target,
      rowCount: input.descriptor.estimatedRowCount,
      hasReverseScript: input.descriptor.hasReverseScript,
    },
  });

  return {
    ok: true,
    runbook,
    verdict: recorded.verdict,
    attemptId: recorded.attemptId,
    correlationId: recorded.correlationId,
    approvalRequestId: recorded.approvalRequestId,
  };
}
