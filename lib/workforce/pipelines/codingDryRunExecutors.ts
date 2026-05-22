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
} from "./stageExecutorRegistry";
import { codeProposeRealExecutor } from "./codeProposeRealExecutor";
import { codeReadRealExecutor } from "./codeReadRealExecutor";
import { codePrOpenRealExecutor } from "./codePrOpenRealExecutor";
import { codeLintRealExecutor } from "./codeLintRealExecutor";
import { codeTestRealExecutor } from "./codeTestRealExecutor";

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
  // Phase 391: real static-validator lint. Parses the propose stage's patch,
  // fetches base content per modified file, applies the diff in-memory, and
  // runs the closed-union validators from staticValidators.ts. Stage fails
  // the whole pipeline on any structural issue so broken code can't reach PR.
  registerStageExecutor("code_lint",    codeLintRealExecutor);
  // Phase 392: real assertion-integrity gate. Parses each modified test file,
  // diffs the test surface (it/describe/expect counts, weak matchers, skips)
  // against base, and fails the pipeline when the AI tried to "pass" tests
  // by deleting cases, weakening assertions, or removing expect calls.
  registerStageExecutor("code_test",    codeTestRealExecutor);
  // Phase 388: real GitHub-backed PR opener. Falls back to dry-run when
  // GITHUB_TOKEN is missing, the patch can't be applied, or the branch /
  // PR API rejects — pipeline still advances cleanly.
  registerStageExecutor("code_pr_open", codePrOpenRealExecutor);
  registered = true;
}
