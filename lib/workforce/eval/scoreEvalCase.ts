/**
 * Pure eval case scorer — Phase 389.
 *
 * Compares a coding-pipeline output against an EvalTaskSpec's
 * expectations and returns:
 *
 *   - outcome: "pass" | "fail" | "errored" | "skipped"
 *   - score:   0..1 (1 = perfect, 0 = catastrophic)
 *   - failures: closed-union list of which expectations missed
 *
 * Closed-union failures so the dashboard can render per-failure
 * stats without spelling errors.
 *
 * Pure — no Prisma, no I/O.
 */

import type { EvalTaskSpec } from "./evalTaskCorpus";

export type FailureKind =
  | "no_proposed_patch"          // pipeline returned nothing
  | "parse_failed"               // diff was unparseable
  | "files_changed_below_min"    // touched too few files
  | "files_changed_above_max"    // touched too many files
  | "missing_required_substring" // expected text not in patch
  | "contained_forbidden_substring"
  | "missing_expected_path"      // expected file path not touched
  | "cost_overrun"               // exceeded expectedMaxCostCents
  | "executor_errored";          // pipeline executor crashed

export interface EvalCaseInput {
  spec: EvalTaskSpec;
  /** The patch text returned by code_propose (raw, possibly fenced). null when no patch produced. */
  proposedPatchText: string | null;
  /** Parsed file paths the patch touches. */
  filePathsChanged: ReadonlyArray<string>;
  /** True when the diff parser succeeded. */
  diffParsed: boolean;
  /** Cost incurred (cents). */
  costCents: number;
  /** Set when the pipeline crashed before returning. */
  executorError?: string;
}

export interface EvalCaseScore {
  outcome: "pass" | "fail" | "errored" | "skipped";
  /** 0..1 score; 1 = all expectations met. */
  score: number;
  failures: ReadonlyArray<FailureKind>;
  notes: string;
}

/** Number of independent expectation checks the scorer evaluates. */
const EXPECTATION_WEIGHT = 6;

export function scoreEvalCase(input: EvalCaseInput): EvalCaseScore {
  const failures: FailureKind[] = [];
  const notes: string[] = [];

  if (input.executorError) {
    return {
      outcome: "errored",
      score: 0,
      failures: ["executor_errored"],
      notes: input.executorError,
    };
  }

  // No patch at all — fatal unless the task allows refusal (min=0).
  if (input.proposedPatchText === null || input.proposedPatchText.trim().length === 0) {
    if (input.spec.expectations.minFilesChanged === 0) {
      return {
        outcome: "pass",
        score: 0.6,    // partial credit for valid refusal
        failures: [],
        notes: "Refusal accepted: minFilesChanged=0.",
      };
    }
    failures.push("no_proposed_patch");
    return { outcome: "fail", score: 0, failures, notes: "No patch text produced." };
  }

  if (!input.diffParsed) {
    failures.push("parse_failed");
    notes.push("Patch text did not parse as unified diff.");
  }

  const n = input.filePathsChanged.length;
  if (n < input.spec.expectations.minFilesChanged) {
    failures.push("files_changed_below_min");
    notes.push(`Touched ${n} files; expected ≥${input.spec.expectations.minFilesChanged}.`);
  }
  if (n > input.spec.expectations.maxFilesChanged) {
    failures.push("files_changed_above_max");
    notes.push(`Touched ${n} files; expected ≤${input.spec.expectations.maxFilesChanged}.`);
  }

  if (input.spec.expectations.mustContain) {
    for (const needle of input.spec.expectations.mustContain) {
      if (!input.proposedPatchText.includes(needle)) {
        failures.push("missing_required_substring");
        notes.push(`Missing required substring: "${needle}".`);
        break;  // one is enough — don't pile on
      }
    }
  }

  if (input.spec.expectations.mustNotContain) {
    for (const needle of input.spec.expectations.mustNotContain) {
      if (input.proposedPatchText.includes(needle)) {
        failures.push("contained_forbidden_substring");
        notes.push(`Patch contained forbidden substring: "${needle}".`);
        break;
      }
    }
  }

  if (input.spec.expectations.expectedPaths) {
    const missingPaths = input.spec.expectations.expectedPaths.filter(
      (expected) => !input.filePathsChanged.some((actual) => actual.includes(expected)),
    );
    if (missingPaths.length > 0) {
      failures.push("missing_expected_path");
      notes.push(`Missing expected paths: ${missingPaths.join(", ")}.`);
    }
  }

  if (input.costCents > input.spec.expectedMaxCostCents) {
    failures.push("cost_overrun");
    notes.push(`Cost ${input.costCents}¢ exceeded budget ${input.spec.expectedMaxCostCents}¢.`);
  }

  // Score: pass-through ratio. (failures.length / EXPECTATION_WEIGHT) penalty,
  // dedup'd across categories so a single missing-substring failure doesn't
  // accidentally count twice.
  const uniqueFailures = Array.from(new Set(failures));
  const penalty = Math.min(1, uniqueFailures.length / EXPECTATION_WEIGHT);
  const score = Math.max(0, 1 - penalty);

  // Threshold: any "fatal" failure → fail. Otherwise fail at score < 0.5.
  const fatal: ReadonlyArray<FailureKind> = ["no_proposed_patch", "executor_errored"];
  const hasFatal = uniqueFailures.some((f) => fatal.includes(f));
  const outcome: EvalCaseScore["outcome"] =
    hasFatal           ? "fail" :
    score >= 0.6       ? "pass" :
                         "fail";

  return {
    outcome,
    score,
    failures: uniqueFailures,
    notes: notes.length === 0 ? "All expectations met." : notes.join(" "),
  };
}
