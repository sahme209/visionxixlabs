/**
 * Pure test-assertion analyzer — Phase 392.
 *
 * Real code_test gate. Given a (path, baseContent, newContent) triple
 * for a modified test file, it diffs the test surface and flags the
 * specific failure modes an AI coding agent is most likely to use to
 * "pass" tests it can't actually make pass:
 *
 *   1. Deleting `it(...)` / `test(...)` cases outright.
 *   2. Deleting whole `describe(...)` blocks.
 *   3. Weakening assertions — replacing `.toBe(specific)` /
 *      `.toEqual(...)` with permissive matchers like `.toBeTruthy()`,
 *      `.toBeDefined()`, `.not.toBeNull()`, or removing `expect(...)`
 *      calls entirely.
 *   4. Re-`skip`-ing previously-active tests (`.skip` / `.todo` /
 *      `xit` / `xdescribe`).
 *
 * What it does NOT do
 * -------------------
 *   - Run any tests. No node:vm, no child process — pure string work.
 *   - Type-check. The lint stage already covers structural validity.
 *   - Catch test cases that *legitimately* needed deletion (e.g., the
 *     PR also removed the feature being tested). That signal lives in
 *     the PR reviewer; this gate just makes the deletion *visible* via
 *     audit + per-file findings so a human can sanity-check.
 *
 * Closed-union FindingKind so the executor + UI can render each one
 * with the appropriate severity badge later.
 *
 * Pure — no I/O, no external deps.
 */

export type TestFindingKind =
  | "deleted_test_case"
  | "deleted_describe_block"
  | "weakened_assertion"
  | "removed_expect_call"
  | "newly_skipped_test"
  | "no_assertions_remaining";

export interface TestFinding {
  kind: TestFindingKind;
  /** Operator-readable message naming the specific identifier. */
  message: string;
  /** When relevant — the test case or describe label. */
  label?: string;
}

export interface TestAnalysis {
  ok: boolean;
  findings: ReadonlyArray<TestFinding>;
  /** Counts (before, after) — useful for audit + the UI summary. */
  baseTestCount: number;
  newTestCount: number;
  baseDescribeCount: number;
  newDescribeCount: number;
  baseExpectCount: number;
  newExpectCount: number;
}

// ------------------------ test-file detection ------------------------

const TEST_PATH_RE = /(?:^|\/)(?:[^/]+\.(?:test|spec)\.[mc]?[jt]sx?|__tests__\/[^/]+\.[mc]?[jt]sx?)$/;

/**
 * Returns true if the path looks like a test file we should analyze.
 * Matches `*.test.ts`, `*.test.tsx`, `*.spec.js`, `*.spec.mjs`, etc.,
 * plus anything inside a `__tests__/` directory.
 */
export function isTestFilePath(path: string): boolean {
  return TEST_PATH_RE.test(path);
}

// --------------------------- token extraction ---------------------------

/**
 * Strip line comments, block comments, and string literals so we don't
 * pick up `it(` inside a doc comment as a real test. Single-pass scan,
 * mirrors the same approach used in staticValidators.ts but coarser —
 * we don't need to track bracket balance, only to neutralize ranges.
 */
function stripCommentsAndStrings(src: string): string {
  const out: string[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];
    // line comment
    if (ch === "/" && next === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    // block comment
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    // strings — preserve as placeholder so identifiers don't merge
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      out.push(" ");
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") { i += 2; continue; }
        // template-literal interpolation: keep the inner code so labels
        // inside ${...} can still be picked up.
        if (quote === "`" && src[i] === "$" && src[i + 1] === "{") {
          i += 2;
          let depth = 1;
          while (i < n && depth > 0) {
            if (src[i] === "{") depth++;
            else if (src[i] === "}") depth--;
            if (depth > 0) { out.push(src[i]); i++; }
          }
          i++; // closing }
          continue;
        }
        i++;
      }
      out.push(" ");
      i++;
      continue;
    }
    out.push(ch);
    i++;
  }
  return out.join("");
}

/**
 * Extract the first string-literal argument of a call like `it("label", ...)`.
 * Operates on the *raw* source (not the stripped one) so we can recover the
 * label even though stripCommentsAndStrings blanks them.
 */
function extractFirstStringArg(src: string, callStart: number): string | null {
  let i = callStart;
  while (i < src.length && src[i] !== "(") i++;
  if (i >= src.length) return null;
  i++;
  while (i < src.length && /\s/.test(src[i])) i++;
  const quote = src[i];
  if (quote !== '"' && quote !== "'" && quote !== "`") return null;
  i++;
  const start = i;
  while (i < src.length && src[i] !== quote) {
    if (src[i] === "\\") { i += 2; continue; }
    i++;
  }
  return src.slice(start, i);
}

const TEST_CALL_RE = /\b(?:it|test|xit|fit|describe|xdescribe|fdescribe)(?:\.(?:skip|only|todo|each))?\s*\(/g;
const EXPECT_CALL_RE = /\bexpect\s*\(/g;

// "Weak" matchers — assertions that pass for almost any non-null value
// and are the model's go-to when it can't make a specific assertion pass.
const WEAK_MATCHER_RE = /\.(?:toBeTruthy|toBeFalsy|toBeDefined|toBeUndefined|toBeNull|not\.toBeNull|not\.toBeUndefined|toEqual\s*\(\s*expect\.anything|toMatchObject\s*\(\s*\{\s*\})\s*\(/g;

interface CallSite {
  fn: string;          // e.g., "it", "describe.skip", "xit"
  label: string | null;
  skipped: boolean;
}

function findCalls(stripped: string, raw: string): CallSite[] {
  const calls: CallSite[] = [];
  TEST_CALL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TEST_CALL_RE.exec(stripped)) !== null) {
    const fn = m[0].replace(/\s*\($/, "");
    const skipped = /\.skip|\.todo|^xit|^xdescribe/.test(fn);
    // Label extraction uses raw so the string literal is intact.
    const label = extractFirstStringArg(raw, m.index);
    calls.push({ fn, label, skipped });
  }
  return calls;
}

function countMatches(src: string, re: RegExp): number {
  re.lastIndex = 0;
  let n = 0;
  while (re.exec(src) !== null) n++;
  return n;
}

// ------------------------------ analyzer ------------------------------

export function analyzeTestChange(args: {
  baseContent: string;
  newContent: string;
}): TestAnalysis {
  const { baseContent, newContent } = args;

  const baseStripped = stripCommentsAndStrings(baseContent);
  const newStripped = stripCommentsAndStrings(newContent);

  const baseCalls = findCalls(baseStripped, baseContent);
  const newCalls = findCalls(newStripped, newContent);

  const baseTests = baseCalls.filter((c) => /^(it|test|xit|fit)/.test(c.fn));
  const newTests = newCalls.filter((c) => /^(it|test|xit|fit)/.test(c.fn));
  const baseDescribes = baseCalls.filter((c) => /^(describe|xdescribe|fdescribe)/.test(c.fn));
  const newDescribes = newCalls.filter((c) => /^(describe|xdescribe|fdescribe)/.test(c.fn));

  const baseExpectCount = countMatches(baseStripped, EXPECT_CALL_RE);
  const newExpectCount = countMatches(newStripped, EXPECT_CALL_RE);
  const baseWeakCount = countMatches(baseStripped, WEAK_MATCHER_RE);
  const newWeakCount = countMatches(newStripped, WEAK_MATCHER_RE);

  const findings: TestFinding[] = [];

  // 1. Deleted test cases — by label when available, else by count.
  const baseTestLabels = new Set(baseTests.map((c) => c.label ?? "").filter(Boolean));
  const newTestLabels = new Set(newTests.map((c) => c.label ?? "").filter(Boolean));
  for (const label of baseTestLabels) {
    if (!newTestLabels.has(label)) {
      findings.push({
        kind: "deleted_test_case",
        message: `Test case "${label}" was removed from the file.`,
        label,
      });
    }
  }
  // Unnamed-test fallback: if labelled accounting under-counts, also fire
  // a count-based finding so silent deletions of `it(variable, fn)` style
  // tests are caught.
  const labelled = baseTests.filter((c) => c.label).length;
  const labelDeletions = findings.length;
  const unlabelledBase = baseTests.length - labelled;
  const unlabelledNew = newTests.length - newTests.filter((c) => c.label).length;
  if (unlabelledBase > unlabelledNew) {
    const delta = unlabelledBase - unlabelledNew;
    findings.push({
      kind: "deleted_test_case",
      message: `${delta} unlabelled test case(s) removed (total tests dropped ${baseTests.length} → ${newTests.length}).`,
    });
  } else if (newTests.length < baseTests.length && labelDeletions === 0) {
    findings.push({
      kind: "deleted_test_case",
      message: `Test count dropped ${baseTests.length} → ${newTests.length} with no labels to attribute.`,
    });
  }

  // 2. Deleted describe blocks.
  const baseDescLabels = new Set(baseDescribes.map((c) => c.label ?? "").filter(Boolean));
  const newDescLabels = new Set(newDescribes.map((c) => c.label ?? "").filter(Boolean));
  for (const label of baseDescLabels) {
    if (!newDescLabels.has(label)) {
      findings.push({
        kind: "deleted_describe_block",
        message: `describe("${label}") block was removed.`,
        label,
      });
    }
  }

  // 3. Newly-skipped tests — a test that was active in the base but is now
  //    `.skip` / `.todo` / `xit` in the new content.
  const baseActive = new Map<string, CallSite>();
  for (const c of baseTests) {
    if (c.label && !c.skipped) baseActive.set(c.label, c);
  }
  for (const c of newTests) {
    if (c.label && c.skipped && baseActive.has(c.label)) {
      findings.push({
        kind: "newly_skipped_test",
        message: `Test "${c.label}" was previously active and is now skipped (${c.fn}).`,
        label: c.label,
      });
    }
  }

  // 4. Removed expect() calls — more than 1 lost across the file.
  if (newExpectCount < baseExpectCount) {
    findings.push({
      kind: "removed_expect_call",
      message: `expect(...) call count dropped ${baseExpectCount} → ${newExpectCount}.`,
    });
  }

  // 5. Weakened assertions — the file now has more weak matchers than it
  //    did before, AND total expects didn't grow to match. The net-new
  //    weak matchers are the suspicious ones.
  if (newWeakCount > baseWeakCount && newExpectCount <= baseExpectCount) {
    findings.push({
      kind: "weakened_assertion",
      message: `Weak matchers (toBeTruthy / toBeDefined / etc.) increased ${baseWeakCount} → ${newWeakCount} without new assertions to justify them.`,
    });
  }

  // 6. No assertions remaining — the file has tests but zero expect().
  //    Catches the "make tests pass by deleting all expect calls" mode.
  if (newTests.length > 0 && newExpectCount === 0 && baseExpectCount > 0) {
    findings.push({
      kind: "no_assertions_remaining",
      message: `File still defines ${newTests.length} test(s) but no expect(...) calls remain.`,
    });
  }

  return {
    ok: findings.length === 0,
    findings,
    baseTestCount: baseTests.length,
    newTestCount: newTests.length,
    baseDescribeCount: baseDescribes.length,
    newDescribeCount: newDescribes.length,
    baseExpectCount,
    newExpectCount,
  };
}
