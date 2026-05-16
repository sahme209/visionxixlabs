/**
 * Operating loop runner.
 *
 * Walks an `OperatingLoopRun` and progresses it through the safe stages.
 * Refuses to touch anything destructive — apply / mutation / IAM changes
 * always stop the runner at the approval gate.
 *
 * Allowed automatic stages:
 *   setup, validation, scan, snapshot, findings, recommendations,
 *   remediation (planning), simulation (in-memory), policy, audit,
 *   memory, next_action.
 *
 * Halted automatic stages:
 *   approval (requires operator), desktop_review (requires operator),
 *   preflight (runs only inside approved execution), verification (post-apply).
 *
 * Hard rule: the runner never invokes any cloud apply / Terraform apply /
 * CLI mutation / desktop local execution.
 */

import "server-only";

import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";
import {
  buildOperatingLoopRun,
  type BuildLoopInput,
} from "./operatingLoopBuilder";
import {
  CANONICAL_STAGES,
  isHaltingStatus,
  type OperatingLoopProvider,
  type OperatingLoopRun,
  type OperatingLoopStage,
  type OperatingLoopStageId,
} from "./operatingLoopModel";

// ---------------------------------------------------------------------------
// Public runner
// ---------------------------------------------------------------------------

export type StageOutcome =
  | { stageId: OperatingLoopStageId; kind: "advanced"; from: string; to: string }
  | { stageId: OperatingLoopStageId; kind: "halted"; reason: string }
  | { stageId: OperatingLoopStageId; kind: "skipped"; reason: string }
  | { stageId: OperatingLoopStageId; kind: "would_run_unsafe"; reason: string };

export interface RunnerReport {
  run: OperatingLoopRun;
  outcomes: StageOutcome[];
  /** Plain-language stop reason. */
  stopReason: string;
  /** Suggested follow-up workflow. */
  nextRecommendedWorkflow: { label: string; href: string };
  /** Honest summary of what changed in this run. */
  summary: string;
}

export interface RunOptions {
  organizationId: OrganizationId;
  actorUserId?: UserId;
  provider: OperatingLoopProvider;
  correlationId?: CorrelationId;
  /** Cap on stages processed in one call (default: all 16 — safe stages only). */
  maxStages?: number;
}

export async function runOperatingLoop(opts: RunOptions): Promise<RunnerReport> {
  // 1) Build a fresh view of the loop.
  const input: BuildLoopInput = {
    organizationId: opts.organizationId,
    actorUserId: opts.actorUserId,
    provider: opts.provider,
    correlationId: opts.correlationId,
  };
  const run = await buildOperatingLoopRun(input);

  // 2) Walk each stage in canonical order. The runner doesn't *execute*
  //    individual stages here — execution happens inside their own
  //    subsystem (validators, scanners, etc.). The runner records the
  //    outcome and halts on the first stage that needs operator action.
  const outcomes: StageOutcome[] = [];
  const stop = haltConditions(opts.provider);
  let halted: { stageId: OperatingLoopStageId; reason: string } | undefined;

  const maxStages = Math.min(opts.maxStages ?? CANONICAL_STAGES.length, CANONICAL_STAGES.length);

  for (let i = 0; i < maxStages; i++) {
    const stageId = CANONICAL_STAGES[i];
    const stage = run.stages.find((s) => s.id === stageId);
    if (!stage) continue;

    if (stop.unsafeStages.has(stageId)) {
      outcomes.push({ stageId, kind: "would_run_unsafe", reason: stop.unsafeReason });
      halted = { stageId, reason: stop.unsafeReason };
      break;
    }

    if (stage.status === "skipped") {
      outcomes.push({ stageId, kind: "skipped", reason: stage.summary });
      continue;
    }

    if (isHaltingStatus(stage.status)) {
      const reason = stage.blockers[0]?.detail ?? stage.summary;
      outcomes.push({ stageId, kind: "halted", reason });
      halted = { stageId, reason };
      break;
    }

    outcomes.push({
      stageId,
      kind: "advanced",
      from: stage.status,
      to: stage.status, // The runner is a coordinator — actual side-effects already happened in the subsystem.
    });
  }

  // 3) Emit a single audit event summarising the runner pass.
  try {
    await auditRecord({
      organizationId: opts.organizationId,
      actorUserId: opts.actorUserId,
      action: "scan.success",
      outcome: halted ? "failure" : "success",
      entityRef: `loop:${opts.provider}`,
      correlationId: run.correlationId,
      source: "live",
      detail: {
        provider: opts.provider,
        currentStage: run.currentStage,
        runStatus: run.status,
        advanced: outcomes.filter((o) => o.kind === "advanced").length,
        halted: outcomes.filter((o) => o.kind === "halted").length,
        unsafe_refused: outcomes.filter((o) => o.kind === "would_run_unsafe").length,
      },
      errorCode: halted ? `loop.${halted.stageId}_halted` : undefined,
    });
    run.auditEventIds.push(run.correlationId);
  } catch {
    // Audit failures must never break the runner.
  }

  const stopReason = halted
    ? `Loop paused at "${halted.stageId}": ${halted.reason}`
    : "Loop completed safe stages — no destructive actions taken.";

  return {
    run,
    outcomes,
    stopReason,
    nextRecommendedWorkflow:
      run.topSafeNextAction ?? { label: "Open Command Center", href: "/dashboard/command-center" },
    summary: `${opts.provider} loop: ${outcomes.filter((o) => o.kind === "advanced").length} stage(s) advanced, ${outcomes.filter((o) => o.kind === "halted").length} halted, ${outcomes.filter((o) => o.kind === "would_run_unsafe").length} unsafe paths refused.`,
  };
}

// ---------------------------------------------------------------------------
// Per-provider unsafe-stage list — hard guardrail
// ---------------------------------------------------------------------------

function haltConditions(provider: OperatingLoopProvider): { unsafeStages: Set<OperatingLoopStageId>; unsafeReason: string } {
  // No stage in the canonical 16 is "destructive" by name — destructive
  // execution lives outside this model. We list stages where the runner
  // must defer to the operator regardless of subsystem state.
  const unsafeStages = new Set<OperatingLoopStageId>(["approval", "desktop_review", "preflight", "verification"]);
  return {
    unsafeStages,
    unsafeReason:
      provider === "desktop"
        ? "Desktop review requires operator interaction. Local apply remains blocked by default."
        : "Stage requires human approval / review — runner is not allowed to advance autonomously.",
  };
}

// ---------------------------------------------------------------------------
// Convenience: run all six provider loops
// ---------------------------------------------------------------------------

export async function runAllOperatingLoops(opts: Omit<RunOptions, "provider">): Promise<RunnerReport[]> {
  const providers: OperatingLoopProvider[] = ["aws", "azure", "gcp", "github", "security_scanner", "desktop"];
  return await Promise.all(providers.map((provider) => runOperatingLoop({ ...opts, provider })));
}

/**
 * Inspect-only variant: same shape but without writing audit or doing any
 * cross-subsystem walk. Used by the API state route.
 */
export async function inspectOperatingLoop(opts: RunOptions): Promise<OperatingLoopRun> {
  return await buildOperatingLoopRun({
    organizationId: opts.organizationId,
    actorUserId: opts.actorUserId,
    provider: opts.provider,
    correlationId: opts.correlationId,
  });
}
