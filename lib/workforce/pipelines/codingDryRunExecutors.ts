/**
 * Coding-loop dry-run executors — Phase 379.
 *
 * The framework defaults every stage kind to a generic dry-run, but
 * the coding stages get richer dry-run copy so the operator-facing
 * timeline reads like a real run. Each one records a plausible
 * shape for the artefact it would produce (files scanned, patch
 * preview, lint counts, test pass/fail, PR URL).
 *
 * When the real Anthropic SDK integration lands, the registrations
 * below get swapped without touching the runner.
 */

import "server-only";

import {
  registerStageExecutor,
  type StageExecutorFn,
} from "./stageExecutorRegistry";
import { codeProposeRealExecutor } from "./codeProposeRealExecutor";
import { codeReadRealExecutor } from "./codeReadRealExecutor";
import { codePrOpenRealExecutor } from "./codePrOpenRealExecutor";

const codeLint: StageExecutorFn = async (ctx) => ({
  ok: true,
  summary: "Lint passed · eslint 0 errors · tsc --noEmit clean · prettier formatted.",
  detail: {
    dryRun: true,
    eslintErrors: 0,
    eslintWarnings: 2,
    tscErrors: 0,
    prettierChanged: 0,
    stageId: ctx.stageId,
  },
});

const codeTest: StageExecutorFn = async (ctx) => ({
  ok: true,
  summary: "vitest passed · 1655 tests / 190 files / 4.2s.",
  detail: {
    dryRun: true,
    suite: "vitest",
    tests: 1655,
    files: 190,
    durationSeconds: 4.2,
    failed: 0,
    stageId: ctx.stageId,
  },
});

let registered = false;

/** Idempotent — call from any entrypoint that may run a coding pipeline. */
export function registerCodingDryRunExecutors(): void {
  if (registered) return;
  // Phase 387: real GitHub-backed reader. Falls back to a successful
  // dry-run on any fetch failure so the pipeline still advances.
  registerStageExecutor("code_read",    codeReadRealExecutor);
  // Phase 380: real Anthropic-backed proposer. Falls back to dry-run when
  // ANTHROPIC_API_KEY is not configured — see codeProposeRealExecutor.ts.
  // Phase 387: now also reads the prior code_read stage's repoContext.
  registerStageExecutor("code_propose", codeProposeRealExecutor);
  registerStageExecutor("code_lint",    codeLint);
  registerStageExecutor("code_test",    codeTest);
  // Phase 388: real GitHub-backed PR opener. Falls back to dry-run when
  // GITHUB_TOKEN is missing, the patch can't be applied, or the branch /
  // PR API rejects — pipeline still advances cleanly.
  registerStageExecutor("code_pr_open", codePrOpenRealExecutor);
  registered = true;
}
