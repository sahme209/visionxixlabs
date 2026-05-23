/**
 * Pipeline runner — Phase 377.
 *
 * Orchestrates a single PipelineRun: seeds the stage rows, then loops
 * through `planNextStage` and the stage executor registry until the
 * run reaches a terminal status (succeeded / failed) or pauses at an
 * approval gate.
 *
 * Approval gates aren't fully wired in Phase 377 — the runner marks
 * those stages as `awaiting_approval` and stops. A follow-up phase
 * (377b) hooks them into the engineer approval engine so the run
 * resumes when the snapshot transitions to approved.
 *
 * The runner is best-effort durable: every stage transition is
 * persisted before the next stage runs, so a process restart never
 * silently loses a stage's status.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { findPipelineDefinition, type PipelineDefinition } from "./pipelineRegistry";
import { planNextStage, type StageView } from "./planNextStage";
import {
  bootstrapStageExecutorRegistry,
  getStageExecutor,
} from "./stageExecutorRegistry";
import { mintPipelineStageApproval } from "./mintPipelineStageApproval";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatchWebhookEvent";

export interface StartPipelineInput {
  organizationId: string;
  pipelineId: string;
  triggeredBy: string;
  metadata?: Record<string, unknown>;
}

export type StartPipelineResult =
  | { ok: false; reason: "pipeline_not_found" }
  | { ok: true; runId: string; correlationId: string };

export async function startPipelineRun(input: StartPipelineInput): Promise<StartPipelineResult> {
  const def = findPipelineDefinition(input.pipelineId);
  if (!def) return { ok: false, reason: "pipeline_not_found" };

  bootstrapStageExecutorRegistry();

  const correlationId = `pipe_${input.pipelineId}_${Date.now().toString(36)}`;
  const run = await prisma.pipelineRun.create({
    data: {
      organizationId: input.organizationId,
      pipelineId: input.pipelineId,
      status: "running",
      triggeredBy: input.triggeredBy,
      correlationId,
      metadata: (input.metadata ?? {}) as object,
      stages: {
        create: def.stages.map((s, i) => ({
          stageId: s.id,
          stageKind: s.kind,
          ordering: i,
          status: "queued",
          requiresApproval: s.requiresApproval,
        })),
      },
    },
    include: { stages: true },
  });

  // Audit row for the run kick-off.
  try {
    await recordAudit({
      organizationId: idFactory.organization(input.organizationId),
      actorUserId: idFactory.user(input.triggeredBy),
      actorKind: "user",
      action: "pipeline.run_started",
      outcome: "success",
      entityRef: `pipeline_run:${run.id}`,
      correlationId: idFactory.correlation(correlationId),
      source: "live",
      detail: {
        pipelineId: input.pipelineId,
        pipelineName: def.name,
        runId: run.id,
        stageCount: def.stages.length,
      },
    });
  } catch { /* best-effort */ }

  // Phase 396: fire pipeline.run_started webhook.
  try {
    await dispatchWebhookEvent({
      organizationId: input.organizationId,
      eventKind: "pipeline.run_started",
      data: {
        runId: run.id,
        pipelineId: input.pipelineId,
        pipelineName: def.name,
        correlationId,
        triggeredBy: input.triggeredBy,
        startedAt: run.startedAt.toISOString(),
        stageCount: def.stages.length,
      },
      correlationId,
    });
  } catch { /* best-effort */ }

  // Advance synchronously through dry-run stages until pause / terminal.
  await advancePipelineRun(run.id);

  return { ok: true, runId: run.id, correlationId };
}

/**
 * Advance a run by repeatedly asking the planner what's next and
 * driving the registered executor. Stops on:
 *   - terminal status (succeeded / failed)
 *   - await_approval (paused, run.status stays "running")
 *   - in_flight (defensive — should never happen with sync executors)
 *
 * Safe to call again after a process restart: the durable stage rows
 * are the source of truth.
 */
export async function advancePipelineRun(runId: string): Promise<void> {
  // Safety cap — avoid runaway loops if a stage executor lies about its
  // success status.
  const MAX_STEPS = 50;
  for (let step = 0; step < MAX_STEPS; step++) {
    const run = await prisma.pipelineRun.findUnique({
      where: { id: runId },
      include: { stages: { orderBy: { ordering: "asc" } } },
    });
    if (!run) return;
    if (run.status === "succeeded" || run.status === "failed" || run.status === "cancelled") {
      return;
    }

    const stageViews: StageView[] = run.stages.map((s) => ({
      ordering: s.ordering,
      status: s.status as StageView["status"],
      requiresApproval: s.requiresApproval,
    }));
    const plan = planNextStage(stageViews);

    if (plan.kind === "complete") {
      await prisma.pipelineRun.update({
        where: { id: runId },
        data: { status: "succeeded", completedAt: new Date() },
      });
      await emitRunAudit(run, "pipeline.run_completed", "success", { runId, finalStatus: "succeeded" });
      // Phase 396: fire pipeline.run_completed webhook. Best-effort —
      // a webhook outage never blocks the pipeline's terminal write.
      try {
        await dispatchWebhookEvent({
          organizationId: run.organizationId,
          eventKind: "pipeline.run_completed",
          data: {
            runId,
            pipelineId: run.pipelineId,
            correlationId: run.correlationId,
            triggeredBy: run.triggeredBy,
            startedAt: run.startedAt.toISOString(),
            completedAt: new Date().toISOString(),
            stageCount: run.stages.length,
          },
          correlationId: run.correlationId,
        });
      } catch { /* best-effort */ }
      return;
    }
    if (plan.kind === "failed") {
      const errorSummary = `Stage ordering=${plan.failedOrdering} failed.`;
      await prisma.pipelineRun.update({
        where: { id: runId },
        data: {
          status: "failed",
          completedAt: new Date(),
          errorSummary,
        },
      });
      await emitRunAudit(run, "pipeline.run_failed", "failure", { runId, failedOrdering: plan.failedOrdering });
      try {
        await dispatchWebhookEvent({
          organizationId: run.organizationId,
          eventKind: "pipeline.run_failed",
          data: {
            runId,
            pipelineId: run.pipelineId,
            correlationId: run.correlationId,
            triggeredBy: run.triggeredBy,
            startedAt: run.startedAt.toISOString(),
            completedAt: new Date().toISOString(),
            failedOrdering: plan.failedOrdering,
            errorSummary,
          },
          correlationId: run.correlationId,
        });
      } catch { /* best-effort */ }
      return;
    }
    if (plan.kind === "await_approval") {
      const stage = run.stages.find((s) => s.ordering === plan.ordering);
      if (!stage) return;

      // Idempotent: if the stage already has an approval, just stop.
      if (stage.status === "awaiting_approval" && stage.approvalRequestId) {
        return;
      }

      // Atomic CAS into awaiting_approval so concurrent advances don't
      // double-mint snapshots.
      const claim = await prisma.pipelineStageRun.updateMany({
        where: { id: stage.id, status: "queued", approvalRequestId: null },
        data: { status: "awaiting_approval", startedAt: new Date() },
      });
      if (claim.count === 0) {
        // Another caller already minted; nothing to do.
        return;
      }

      const def = findPipelineDefinition(run.pipelineId);
      const stageDef = def?.stages.find((s) => s.id === stage.stageId);
      const stageName = stageDef?.name ?? stage.stageId;

      const minted = await mintPipelineStageApproval({
        organizationId: run.organizationId,
        pipelineId: run.pipelineId,
        runId: run.id,
        stageRunId: stage.id,
        stageId: stage.stageId,
        stageName,
        requestedBy: run.triggeredBy,
        correlationId: run.correlationId,
      });

      await prisma.pipelineStageRun.update({
        where: { id: stage.id },
        data: { approvalRequestId: minted.approvalRequestId },
      });
      return;
    }
    if (plan.kind === "in_flight") {
      // Defensive — synchronous executors should never leave a stage in
      // "running" between steps. Stop to avoid double-execution.
      return;
    }
    if (plan.kind === "empty") return;

    // plan.kind === "run" → execute the stage.
    const stage = run.stages.find((s) => s.ordering === plan.ordering);
    if (!stage) return;

    // Atomic CAS: claim the stage by moving queued → running.
    const claim = await prisma.pipelineStageRun.updateMany({
      where: { id: stage.id, status: "queued" },
      data: { status: "running", startedAt: new Date() },
    });
    if (claim.count === 0) {
      // Another caller already claimed this stage; stop.
      return;
    }

    const executor = getStageExecutor(stage.stageKind as never);
    if (!executor) {
      await prisma.pipelineStageRun.update({
        where: { id: stage.id },
        data: {
          status: "failed",
          completedAt: new Date(),
          errorMessage: `No executor registered for stageKind=${stage.stageKind}.`,
        },
      });
      await emitStageAudit(run, stage, "pipeline.stage_failed", "failure", {
        error: "no_executor_registered",
      });
      continue;
    }

    await emitStageAudit(run, stage, "pipeline.stage_started", "success", {});

    let result: Awaited<ReturnType<typeof executor>>;
    try {
      result = await executor({
        organizationId: run.organizationId,
        runId: run.id,
        stageRunId: stage.id,
        pipelineId: run.pipelineId,
        stageId: stage.stageId,
        stageKind: stage.stageKind as never,
        correlationId: run.correlationId,
        triggeredBy: run.triggeredBy,
        runMetadata: (run.metadata && typeof run.metadata === "object" ? run.metadata as Record<string, unknown> : {}),
      });
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message : "unknown executor error" };
    }

    if (result.ok) {
      await prisma.pipelineStageRun.update({
        where: { id: stage.id },
        data: {
          status: "succeeded",
          completedAt: new Date(),
          outputSummary: result.summary,
          outputDetail: (result.detail ?? {}) as object,
        },
      });
      await emitStageAudit(run, stage, "pipeline.stage_completed", "success", { summary: result.summary });
    } else {
      await prisma.pipelineStageRun.update({
        where: { id: stage.id },
        data: {
          status: "failed",
          completedAt: new Date(),
          errorMessage: result.error,
          outputDetail: (result.detail ?? {}) as object,
        },
      });
      await emitStageAudit(run, stage, "pipeline.stage_failed", "failure", { error: result.error });
    }
  }
}

type RunRow = { id: string; organizationId: string; pipelineId: string; correlationId: string; triggeredBy: string };
type StageRow = { id: string; stageId: string; stageKind: string; ordering: number };

async function emitRunAudit(
  run: RunRow,
  action: "pipeline.run_completed" | "pipeline.run_failed",
  outcome: "success" | "failure",
  detail: Record<string, unknown>,
): Promise<void> {
  try {
    await recordAudit({
      organizationId: idFactory.organization(run.organizationId),
      actorUserId: idFactory.user(run.triggeredBy),
      actorKind: "user",
      action,
      outcome,
      entityRef: `pipeline_run:${run.id}`,
      correlationId: idFactory.correlation(run.correlationId),
      source: "live",
      detail: { pipelineId: run.pipelineId, ...detail },
    });
  } catch { /* best-effort */ }
}

async function emitStageAudit(
  run: RunRow,
  stage: StageRow,
  action: "pipeline.stage_started" | "pipeline.stage_completed" | "pipeline.stage_failed",
  outcome: "success" | "failure",
  detail: Record<string, unknown>,
): Promise<void> {
  try {
    await recordAudit({
      organizationId: idFactory.organization(run.organizationId),
      actorUserId: idFactory.user(run.triggeredBy),
      actorKind: "user",
      action,
      outcome,
      entityRef: `pipeline_stage_run:${stage.id}`,
      correlationId: idFactory.correlation(run.correlationId),
      source: "live",
      detail: {
        pipelineId: run.pipelineId,
        runId: run.id,
        stageId: stage.stageId,
        stageKind: stage.stageKind,
        ordering: stage.ordering,
        ...detail,
      },
    });
  } catch { /* best-effort */ }
}
