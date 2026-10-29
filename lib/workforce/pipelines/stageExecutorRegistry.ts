/**
 * Stage executor registry — Phase 377.
 *
 * Maps PipelineStageKind → StageExecutorFn. Missing implementations fail
 * explicitly so an unperformed deployment, test or notification cannot
 * make a real pipeline report success. Dry-run output is opt-in only.
 */

import "server-only";

import type { PipelineStageKind } from "./pipelineRegistry";

export interface StageExecutionContext {
  organizationId: string;
  runId: string;
  stageRunId: string;
  pipelineId: string;
  stageId: string;
  stageKind: PipelineStageKind;
  correlationId: string;
  triggeredBy: string;
  /** PipelineRun.metadata at the time the executor fires — operator inputs (e.g., coding-task instruction). */
  runMetadata: Record<string, unknown>;
}

export interface StageExecutorOk {
  ok: true;
  summary: string;
  detail?: Record<string, unknown>;
}
export interface StageExecutorErr {
  ok: false;
  error: string;
  detail?: Record<string, unknown>;
}
export type StageExecutorResult = StageExecutorOk | StageExecutorErr;

export type StageExecutorFn = (ctx: StageExecutionContext) => Promise<StageExecutorResult>;

const STAGE_EXECUTORS = new Map<PipelineStageKind, StageExecutorFn>();
let bootstrapped = false;

export function registerStageExecutor(kind: PipelineStageKind, fn: StageExecutorFn): void {
  STAGE_EXECUTORS.set(kind, fn);
}

export function getStageExecutor(kind: PipelineStageKind): StageExecutorFn | null {
  return STAGE_EXECUTORS.get(kind) ?? null;
}

export function hasStageExecutor(kind: PipelineStageKind): boolean {
  return STAGE_EXECUTORS.has(kind);
}

export const dryRunStageExecutor: StageExecutorFn = async (ctx) => {
  return {
    ok: true,
    summary: `[dry-run] ${ctx.stageKind} would run for stage ${ctx.stageId}`,
    detail: {
      stageKind: ctx.stageKind,
      stageId: ctx.stageId,
      runId: ctx.runId,
      dryRun: true,
      note: "Replace with the real stage executor when the apply path is wired for this stageKind.",
    },
  };
};

const unavailableStageExecutor: StageExecutorFn = async (ctx) => ({
  ok: false,
  error: `The ${ctx.stageKind} stage has no configured execution implementation. No external action was performed.`,
  detail: { stageKind: ctx.stageKind, stageId: ctx.stageId, runId: ctx.runId,
    executorUnavailable: true, externalActionPerformed: false },
});

const ALL_KINDS: readonly PipelineStageKind[] = [
  "build", "unit_test", "integration_test", "security_scan", "lint",
  "schema_plan", "schema_apply", "schema_verify",
  "deploy", "smoke_test", "rollback", "approval_gate", "notify",
  // Phase 379 — AI coding loop.
  "code_read", "code_propose", "code_lint", "code_test", "code_pr_open",
];

export function bootstrapStageExecutorRegistry(): void {
  for (const k of ALL_KINDS) {
    if (!STAGE_EXECUTORS.has(k)) STAGE_EXECUTORS.set(k, unavailableStageExecutor);
  }
  bootstrapped = true;
}

export function isStageExecutorRegistryBootstrapped(): boolean {
  return bootstrapped;
}

export function __resetStageExecutorRegistry(): void {
  STAGE_EXECUTORS.clear();
  bootstrapped = false;
}
