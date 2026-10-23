/**
 * Register real coding-stage executors. The historical exported name remains
 * for entrypoint compatibility; missing capabilities and failed stages must
 * not be reported as successful dry runs.
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
  // Repository read failures stop the run before paid generation.
  registerStageExecutor("code_read",    codeReadRealExecutor);
  // Governed Gateway proposer requires policy and durable credit admission.
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
  // PR completion requires a confirmed response; failed/uncertain writes stop.
  registerStageExecutor("code_pr_open", codePrOpenRealExecutor);
  registered = true;
}
