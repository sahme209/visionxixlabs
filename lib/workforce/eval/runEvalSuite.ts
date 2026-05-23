/**
 * AI coding loop eval orchestrator — Phase 389.
 *
 * Walks the EVAL_TASK_CORPUS, fires each synthetic task against the
 * ai_coding pipeline, scores the result, and persists an EvalRun
 * with one EvalCase per task.
 *
 * Skips the real pipeline call when the platform isn't configured
 * for it (no ANTHROPIC_API_KEY, no GITHUB_TOKEN, no internal admin
 * workspace) — in that case each case lands as "skipped" with a
 * note explaining why. This keeps the eval surface live in dev
 * without burning real tokens.
 *
 * Lives separate from the cron + admin route so the same code path
 * is reachable from a manual trigger + automated nightly run.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { EVAL_TASK_CORPUS, type EvalTaskSpec } from "./evalTaskCorpus";
import { scoreEvalCase, type FailureKind } from "./scoreEvalCase";
import { startPipelineRun } from "@/lib/workforce/pipelines/pipelineRunner";
import { registerCodingDryRunExecutors } from "@/lib/workforce/pipelines/codingDryRunExecutors";
import { parseUnifiedDiff } from "@/lib/workforce/pipelines/parseUnifiedDiff";
import { findPlan } from "@/lib/billing/planRegistry";
import { compareEvalRuns } from "./compareEvalRuns";
import { assertEvalReleaseHealthy, type GateDecision } from "./assertEvalReleaseHealthy";
import { loadEvalRunSnapshot, findPreviousCompletedRun } from "./loadEvalRunSnapshot";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatchWebhookEvent";

const INTERNAL_WORKSPACE_ID = "ws_internal_admin_visionxixlabs";

export interface RunEvalSuiteInput {
  runKind: "manual" | "cron_daily" | "ci_smoke";
  triggeredBy: string;
  /** Optional subset of taskKeys; null = full corpus. */
  taskKeys?: ReadonlyArray<string>;
  /** When true, skip the actual pipeline call — useful for sanity checks. */
  dryRun?: boolean;
}

export interface RunEvalSuiteResult {
  runId: string;
  status: "completed" | "failed";
  totalCases: number;
  passCount: number;
  failCount: number;
  skippedCount: number;
  totalCostCents: number;
  /** Phase 393 — release-gate decision after the run completes (null when run failed). */
  gate?: GateDecision | null;
  /** Phase 393 — counts from comparing against the previous completed run. */
  regressionCount?: number;
  improvementCount?: number;
}

export async function runEvalSuite(input: RunEvalSuiteInput): Promise<RunEvalSuiteResult> {
  const corpus = input.taskKeys
    ? EVAL_TASK_CORPUS.filter((t) => input.taskKeys!.includes(t.taskKey))
    : EVAL_TASK_CORPUS;

  const correlationId = `eval_${input.runKind}_${Date.now().toString(36)}`;

  const run = await prisma.evalRun.create({
    data: {
      runKind: input.runKind,
      status: "running",
      totalCases: corpus.length,
      triggeredBy: input.triggeredBy,
      correlationId,
      modelUsed: "claude-sonnet-4-6",
    },
  });

  try {
    await recordAudit({
      organizationId: idFactory.organization(INTERNAL_WORKSPACE_ID),
      actorUserId: idFactory.user(input.triggeredBy),
      actorKind: "system",
      action: "eval.run_started",
      outcome: "success",
      entityRef: `eval_run:${run.id}`,
      correlationId: idFactory.correlation(correlationId),
      source: "live",
      detail: { runKind: input.runKind, corpusSize: corpus.length },
    });
  } catch { /* best-effort */ }

  const result: RunEvalSuiteResult = {
    runId: run.id,
    status: "completed",
    totalCases: corpus.length,
    passCount: 0,
    failCount: 0,
    skippedCount: 0,
    totalCostCents: 0,
  };

  const skipRunner = input.dryRun || !process.env.ANTHROPIC_API_KEY;

  for (const spec of corpus) {
    const t0 = Date.now();
    const caseResult = await runOneCase(spec, skipRunner);
    const durationMs = Date.now() - t0;

    result.totalCostCents += caseResult.costCents;

    let outcome: "pass" | "fail" | "errored" | "skipped";
    let score = 0;
    let failures: ReadonlyArray<FailureKind> = [];
    let notes = caseResult.notes;

    if (caseResult.skipped) {
      outcome = "skipped";
      score = 0;
    } else {
      const scored = scoreEvalCase({
        spec,
        proposedPatchText: caseResult.proposedPatchText,
        filePathsChanged: caseResult.filePathsChanged,
        diffParsed: caseResult.diffParsed,
        costCents: caseResult.costCents,
        executorError: caseResult.executorError,
      });
      outcome = scored.outcome;
      score = scored.score;
      failures = scored.failures;
      notes = scored.notes;
    }

    if (outcome === "pass") result.passCount++;
    else if (outcome === "skipped") result.skippedCount++;
    else result.failCount++;

    try {
      await prisma.evalCase.create({
        data: {
          evalRunId: run.id,
          taskKey: spec.taskKey,
          instruction: spec.instruction,
          codingTaskId: caseResult.codingTaskId,
          outcome,
          score,
          failures: failures as unknown as object,
          durationMs,
          notes,
        },
      });
    } catch { /* best-effort */ }

    try {
      await recordAudit({
        organizationId: idFactory.organization(INTERNAL_WORKSPACE_ID),
        actorKind: "system",
        action: "eval.case_recorded",
        outcome: outcome === "errored" ? "failure" : outcome === "fail" ? "failure" : "success",
        entityRef: `eval_run:${run.id}`,
        correlationId: idFactory.correlation(correlationId),
        source: "live",
        detail: {
          taskKey: spec.taskKey,
          outcome,
          score,
          failures: failures as unknown as object,
          costCents: caseResult.costCents,
        },
      });
    } catch { /* best-effort */ }
  }

  try {
    await prisma.evalRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        passCount: result.passCount,
        failCount: result.failCount,
        skippedCount: result.skippedCount,
        totalCostCents: result.totalCostCents,
        completedAt: new Date(),
      },
    });

    await recordAudit({
      organizationId: idFactory.organization(INTERNAL_WORKSPACE_ID),
      actorKind: "system",
      action: "eval.run_completed",
      outcome: result.failCount === 0 ? "success" : "failure",
      entityRef: `eval_run:${run.id}`,
      correlationId: idFactory.correlation(correlationId),
      source: "live",
      detail: {
        runKind: input.runKind,
        totalCases: result.totalCases,
        passCount: result.passCount,
        failCount: result.failCount,
        skippedCount: result.skippedCount,
        totalCostCents: result.totalCostCents,
      },
    });
  } catch { /* best-effort */ }

  // Phase 393 — regression detection + release gate. Done after the run is
  // marked completed so the comparator can re-read the canonical row. Both
  // halves are best-effort — a regression-detector outage must not corrupt
  // the run record itself.
  try {
    const current = await loadEvalRunSnapshot(run.id);
    if (current) {
      const previous = await findPreviousCompletedRun(current.startedAt, run.id);
      const diff = compareEvalRuns(previous, current);
      result.regressionCount = diff.counts.regressionCount;
      result.improvementCount = diff.counts.improvementCount;

      if (diff.regressions.length > 0) {
        await recordAudit({
          organizationId: idFactory.organization(INTERNAL_WORKSPACE_ID),
          actorKind: "system",
          action: "eval.regression_detected",
          outcome: "failure",
          entityRef: `eval_run:${run.id}`,
          correlationId: idFactory.correlation(correlationId),
          source: "live",
          detail: {
            runKind: input.runKind,
            previousRunId: previous?.runId ?? null,
            counts: diff.counts,
            regressions: diff.regressions,
            improvements: diff.improvements,
          },
        });

        // Phase 396: fire eval.regression_detected webhook so integrators
        // can page on quality regression the second it's detected.
        try {
          await dispatchWebhookEvent({
            organizationId: INTERNAL_WORKSPACE_ID,
            eventKind: "eval.regression_detected",
            data: {
              runId: run.id,
              previousRunId: previous?.runId ?? null,
              runKind: input.runKind,
              counts: diff.counts,
              regressionCount: diff.counts.regressionCount,
              newFailures: diff.counts.newFailures,
              newErrors: diff.counts.newErrors,
            },
            correlationId,
          });
        } catch { /* best-effort */ }
      }

      const gate = assertEvalReleaseHealthy({
        current,
        diff,
        runStatus: "completed",
        // Cron daily uses the strict default thresholds. CI smoke
        // relaxes to "don't block on a single score-drop" so smoke
        // runs from feature branches don't block merges on noise.
        thresholds: input.runKind === "ci_smoke"
          ? { maxScoreDrops: 3, maxNewFailures: 1 }
          : undefined,
      });
      result.gate = gate;

      await recordAudit({
        organizationId: idFactory.organization(INTERNAL_WORKSPACE_ID),
        actorKind: "system",
        action: gate.passed ? "eval.release_gate_passed" : "eval.release_gate_blocked",
        outcome: gate.passed ? "success" : "blocked",
        entityRef: `eval_run:${run.id}`,
        correlationId: idFactory.correlation(correlationId),
        source: "live",
        detail: {
          runKind: input.runKind,
          passRate: gate.passRate,
          averageScore: gate.averageScore,
          blockers: gate.blockers,
          summary: gate.summary,
          regressionCount: diff.counts.regressionCount,
        },
      });

      // Phase 396: fire release_gate.passed / release_gate.blocked +
      // eval.run_completed webhook events. All best-effort.
      try {
        await dispatchWebhookEvent({
          organizationId: INTERNAL_WORKSPACE_ID,
          eventKind: gate.passed ? "release_gate.passed" : "release_gate.blocked",
          data: {
            runId: run.id,
            runKind: input.runKind,
            passRate: gate.passRate,
            averageScore: gate.averageScore,
            blockers: gate.blockers,
            summary: gate.summary,
            regressionCount: diff.counts.regressionCount,
            improvementCount: diff.counts.improvementCount,
          },
          correlationId,
        });
      } catch { /* best-effort */ }

      try {
        await dispatchWebhookEvent({
          organizationId: INTERNAL_WORKSPACE_ID,
          eventKind: "eval.run_completed",
          data: {
            runId: run.id,
            runKind: input.runKind,
            totalCases: result.totalCases,
            passCount: result.passCount,
            failCount: result.failCount,
            skippedCount: result.skippedCount,
            totalCostCents: result.totalCostCents,
            gatePassed: gate.passed,
          },
          correlationId,
        });
      } catch { /* best-effort */ }
    }
  } catch { /* best-effort — never block the run on the gate's plumbing */ }

  return result;
}

interface RunOneCaseResult {
  skipped: boolean;
  proposedPatchText: string | null;
  filePathsChanged: string[];
  diffParsed: boolean;
  costCents: number;
  codingTaskId: string | null;
  executorError: string | undefined;
  notes: string;
}

async function runOneCase(spec: EvalTaskSpec, skipRunner: boolean): Promise<RunOneCaseResult> {
  if (skipRunner) {
    return {
      skipped: true,
      proposedPatchText: null,
      filePathsChanged: [],
      diffParsed: false,
      costCents: 0,
      codingTaskId: null,
      executorError: undefined,
      notes: "Skipped: ANTHROPIC_API_KEY not set OR dryRun=true.",
    };
  }

  registerCodingDryRunExecutors();

  // The eval pipeline always runs against the internal workspace so
  // entitlement gates don't fire (Enterprise tier = unlimited).
  const fakeOrgId = INTERNAL_WORKSPACE_ID;

  try {
    const start = await startPipelineRun({
      organizationId: fakeOrgId,
      pipelineId: "ai_coding",
      triggeredBy: "system:eval_runner",
      metadata: {
        instruction: spec.instruction,
        repoRef: spec.repoRef,
        branchHint: spec.branchHint,
      },
    });
    if (!start.ok) {
      return {
        skipped: false,
        proposedPatchText: null,
        filePathsChanged: [],
        diffParsed: false,
        costCents: 0,
        codingTaskId: null,
        executorError: `startPipelineRun: ${start.reason}`,
        notes: "Pipeline start failed.",
      };
    }

    // Pull the propose stage's outputDetail.
    const proposeStage = await prisma.pipelineStageRun.findFirst({
      where: { runId: start.runId, stageKind: "code_propose" },
      orderBy: { completedAt: "desc" },
      select: { status: true, outputDetail: true, errorMessage: true },
    });

    if (!proposeStage || proposeStage.status !== "succeeded") {
      return {
        skipped: false,
        proposedPatchText: null,
        filePathsChanged: [],
        diffParsed: false,
        costCents: 0,
        codingTaskId: null,
        executorError: proposeStage?.errorMessage ?? "code_propose did not succeed",
        notes: "Pipeline reached propose but did not succeed.",
      };
    }

    const detail = proposeStage.outputDetail as {
      proposedPatchText?: unknown;
      cost?: { totalCents?: unknown };
    } | null;
    const proposedPatchText = typeof detail?.proposedPatchText === "string" ? detail.proposedPatchText : null;
    const costCents = typeof detail?.cost?.totalCents === "number" ? detail.cost.totalCents : 0;

    let diffParsed = false;
    let filePathsChanged: string[] = [];
    if (proposedPatchText) {
      const parsed = parseUnifiedDiff(proposedPatchText);
      diffParsed = parsed.ok;
      if (parsed.ok) {
        filePathsChanged = parsed.files.map((f) => f.path);
      }
    }

    return {
      skipped: false,
      proposedPatchText,
      filePathsChanged,
      diffParsed,
      costCents,
      codingTaskId: start.runId,
      executorError: undefined,
      notes: "Pipeline ran.",
    };
  } catch (err) {
    return {
      skipped: false,
      proposedPatchText: null,
      filePathsChanged: [],
      diffParsed: false,
      costCents: 0,
      codingTaskId: null,
      executorError: err instanceof Error ? err.message : "unknown",
      notes: "Eval runner threw.",
    };
  }
}

// Silence unused-import for findPlan when the eval runner is dry-run-only.
// findPlan is exported by planRegistry; we keep the import lazy so the
// orchestrator stays useful as a single source of truth when more
// gates layer in (future phases).
void findPlan;
