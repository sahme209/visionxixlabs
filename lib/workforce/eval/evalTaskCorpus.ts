/**
 * AI coding loop eval task corpus — Phase 389.
 *
 * Synthetic operator instructions the eval harness fires at the
 * coding pipeline. Each task carries:
 *
 *   - Stable taskKey for cross-run regression tracking.
 *   - The operator instruction (what gets fed to the AI).
 *   - Expected output shape — what we'd want a competent engineer
 *     to emit. The scorer (lib/workforce/eval/scoreEvalCase.ts)
 *     compares actual codingTask outputs against these.
 *
 * Tasks are deliberately small + verifiable. A real eval run
 * triggers the full pipeline against the platform's own repo with
 * a throwaway branch hint, so the AI codes against real code.
 */

export type EvalTaskCategory =
  | "trivial"       // one-line edit, should never fail
  | "rename"        // identifier rename across one file
  | "add_feature"   // a small new function or endpoint
  | "fix_bug"       // a small fix in existing code
  | "documentation" // README / comment edit
  | "refactor";     // light internal refactor

export interface EvalTaskSpec {
  /** Stable across model + prompt changes. The cross-run join key. */
  taskKey: string;
  category: EvalTaskCategory;
  /** Human-friendly name for the dashboard. */
  displayName: string;
  /** The fake operator instruction sent to the coding pipeline. */
  instruction: string;
  /** Repository the eval runs against (default: the platform's own repo for self-eval). */
  repoRef: string;
  /** Branch hint (typically a throwaway scratch branch the operator pre-creates). */
  branchHint: string;
  /**
   * Heuristic expectations the scorer checks against the produced
   * patch text. All are soft — a missing one decrements score but
   * doesn't necessarily fail the case.
   */
  expectations: {
    /** The diff must touch at least this many files. */
    minFilesChanged: number;
    /** The diff must touch at most this many files. */
    maxFilesChanged: number;
    /** Substrings the patch text MUST contain (case-sensitive). */
    mustContain?: ReadonlyArray<string>;
    /** Substrings the patch MUST NOT contain. */
    mustNotContain?: ReadonlyArray<string>;
    /** Path globs the diff is expected to touch. */
    expectedPaths?: ReadonlyArray<string>;
  };
  /** Maximum cost (cents) we expect this task to incur. Scorer flags overrun. */
  expectedMaxCostCents: number;
}

/**
 * The shipped corpus. Keep this list small + curated; eval runs
 * cost real Anthropic tokens (Phase 380) and the cron fires daily.
 */
export const EVAL_TASK_CORPUS: ReadonlyArray<EvalTaskSpec> = [
  {
    taskKey: "trivial_comment_typo",
    category: "trivial",
    displayName: "Fix typo in README",
    instruction: "Find any obvious typo or grammar mistake in the README.md and propose a one-line patch fixing it.",
    repoRef: "sahme209/visionxixlabs",
    branchHint: "main",
    expectations: {
      minFilesChanged: 1,
      maxFilesChanged: 1,
      expectedPaths: ["README.md"],
      mustContain: ["--- ", "+++ "],
    },
    expectedMaxCostCents: 20,
  },
  {
    taskKey: "trivial_add_keyword_to_readme",
    category: "trivial",
    displayName: "Append a sentence to README",
    instruction: "Append one sentence to the end of the README.md describing what VisionXIXLabs is.",
    repoRef: "sahme209/visionxixlabs",
    branchHint: "main",
    expectations: {
      minFilesChanged: 1,
      maxFilesChanged: 1,
      expectedPaths: ["README.md"],
      mustContain: ["+++"],
    },
    expectedMaxCostCents: 25,
  },
  {
    taskKey: "doc_add_section_to_readme",
    category: "documentation",
    displayName: "Add 'Architecture' section to README",
    instruction: "Add a short '## Architecture' section to README.md (3-5 sentences) describing the high-level layers: data model, pure layers, API, UI.",
    repoRef: "sahme209/visionxixlabs",
    branchHint: "main",
    expectations: {
      minFilesChanged: 1,
      maxFilesChanged: 1,
      mustContain: ["## Architecture"],
      expectedPaths: ["README.md"],
    },
    expectedMaxCostCents: 50,
  },
  {
    taskKey: "add_feature_healthz_route",
    category: "add_feature",
    displayName: "Add /healthz Next.js API route",
    instruction: "Add a new Next.js API route at app/api/healthz/route.ts that returns 200 with JSON { ok: true, ts: new Date().toISOString() }. Keep it minimal and stateless.",
    repoRef: "sahme209/visionxixlabs",
    branchHint: "main",
    expectations: {
      minFilesChanged: 1,
      maxFilesChanged: 1,
      expectedPaths: ["app/api/healthz/route.ts"],
      mustContain: ["NextResponse", "/dev/null"],  // /dev/null because new file
    },
    expectedMaxCostCents: 60,
  },
  {
    taskKey: "refactor_extract_helper",
    category: "refactor",
    displayName: "Extract a helper function (small)",
    instruction: "In any file under lib/billing, if you spot a small computation that's repeated, extract it into a named helper. If nothing fits, return a refusal with a one-paragraph explanation.",
    repoRef: "sahme209/visionxixlabs",
    branchHint: "main",
    expectations: {
      minFilesChanged: 0,        // refusal allowed
      maxFilesChanged: 3,
    },
    expectedMaxCostCents: 80,
  },
] as const;

export function findEvalTask(taskKey: string): EvalTaskSpec | null {
  return EVAL_TASK_CORPUS.find((t) => t.taskKey === taskKey) ?? null;
}
