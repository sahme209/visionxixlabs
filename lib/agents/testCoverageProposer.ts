/**
 * Pure AGI-Engineer test-coverage proposer.
 *
 * Input: a structured representation of a diff — added / modified
 * functions, plus the existing test files that cover them. Output:
 * a typed proposal of which tests to add, why, and at what priority.
 *
 * Why this kernel exists: the most common failure mode for an
 * autonomous engineering agent is shipping code without a test that
 * fails before the change. This kernel makes that gap visible to the
 * operator before the approval packet is staged.
 *
 * Pure / deterministic. Closed unions on priority and kind so new
 * categories break the build.
 */

export type TestPriority = "must_have" | "should_have" | "nice_to_have";

export type TestKind = "regression" | "golden_path" | "edge_case" | "error_path" | "contract";

export interface DiffSymbol {
  /** Canonical symbol id — usually module path + function name. */
  id: string;
  /** "function" or "method" or "exported_const" — we only treat them all the same here. */
  kind: "function" | "method" | "exported_const";
  /** Whether the diff added this symbol vs modified an existing one. */
  changeKind: "added" | "modified";
  /** True if the symbol is exported / part of the public API of the module. */
  exported: boolean;
  /** True if there is at least one branch (if/switch/try). Drives edge_case proposals. */
  hasBranches: boolean;
  /** True if the symbol throws or returns a typed error union. Drives error_path proposals. */
  canError: boolean;
  /** True if the symbol returns a closed-union output. Drives contract proposals. */
  hasClosedUnionReturn: boolean;
  /** Existing test files (paths) already importing this symbol. */
  existingTests: readonly string[];
}

export interface TestProposal {
  id: string;
  symbolId: string;
  kind: TestKind;
  priority: TestPriority;
  /** Operator-readable rationale: why this test, why now. */
  rationale: string;
  /** Suggested vitest description for the test case. */
  suggestedName: string;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

let counter = 0;
function nextId(): string {
  counter += 1;
  return `tcov-${counter}`;
}

/** Reset the in-process counter — only intended for tests. */
export function __resetProposalCounter(): void {
  counter = 0;
}

export function proposeTests(symbols: readonly DiffSymbol[]): TestProposal[] {
  const out: TestProposal[] = [];
  for (const sym of symbols) {
    out.push(...proposeForSymbol(sym));
  }
  // Sort: must_have first, then by symbol id for stable ordering.
  const priorityOrder: Record<TestPriority, number> = { must_have: 0, should_have: 1, nice_to_have: 2 };
  out.sort((a, b) => {
    const p = priorityOrder[a.priority] - priorityOrder[b.priority];
    return p !== 0 ? p : a.symbolId.localeCompare(b.symbolId);
  });
  return out;
}

function proposeForSymbol(sym: DiffSymbol): TestProposal[] {
  const proposals: TestProposal[] = [];
  const hasAnyTest = sym.existingTests.length > 0;

  // Modified symbol with no existing test → regression must-have.
  if (sym.changeKind === "modified" && !hasAnyTest) {
    proposals.push({
      id: nextId(),
      symbolId: sym.id,
      kind: "regression",
      priority: "must_have",
      rationale:
        `${sym.id} was modified but has no existing test. A modified symbol without a failing-before-after test is a silent regression risk.`,
      suggestedName: `${shortName(sym.id)} regression — reproduces the bug before the fix lands`,
    });
  }

  // Added exported symbol → golden-path must-have.
  if (sym.changeKind === "added" && sym.exported) {
    proposals.push({
      id: nextId(),
      symbolId: sym.id,
      kind: "golden_path",
      priority: "must_have",
      rationale:
        `${sym.id} is newly exported. Public-API symbols ship with at least one golden-path test so downstream agents can rely on the contract.`,
      suggestedName: `${shortName(sym.id)} — golden path`,
    });
  }

  // Branches → edge-case test, priority depends on whether any test already exists.
  if (sym.hasBranches) {
    proposals.push({
      id: nextId(),
      symbolId: sym.id,
      kind: "edge_case",
      priority: hasAnyTest ? "should_have" : "must_have",
      rationale:
        `${sym.id} has conditional branches. Without an edge-case test, untaken branches accumulate as dead code.`,
      suggestedName: `${shortName(sym.id)} — edge case for non-default branch`,
    });
  }

  // Can throw / return typed error → error-path test.
  if (sym.canError) {
    proposals.push({
      id: nextId(),
      symbolId: sym.id,
      kind: "error_path",
      priority: hasAnyTest ? "should_have" : "must_have",
      rationale:
        `${sym.id} can fail. Error-path behavior is a contract — when it changes silently, callers break.`,
      suggestedName: `${shortName(sym.id)} — surfaces a typed error on bad input`,
    });
  }

  // Closed-union return → contract test pinning the union.
  if (sym.hasClosedUnionReturn && sym.exported) {
    proposals.push({
      id: nextId(),
      symbolId: sym.id,
      kind: "contract",
      priority: "should_have",
      rationale:
        `${sym.id} returns a closed-union. A contract test pins the union so future additions break the test (and therefore the build) before they break callers.`,
      suggestedName: `${shortName(sym.id)} — contract: union members covered`,
    });
  }

  // Nice-to-have: even purely additive non-exported helpers benefit from one test.
  if (proposals.length === 0 && sym.changeKind === "added") {
    proposals.push({
      id: nextId(),
      symbolId: sym.id,
      kind: "golden_path",
      priority: "nice_to_have",
      rationale:
        `${sym.id} is a new private helper. A small test keeps future refactors honest.`,
      suggestedName: `${shortName(sym.id)} — minimal smoke`,
    });
  }

  return proposals;
}

function shortName(id: string): string {
  const last = id.split(/[\/.]/).pop() ?? id;
  return last.slice(0, 60);
}

export interface CoverageVerdict {
  mustHaveCount: number;
  shouldHaveCount: number;
  niceToHaveCount: number;
  /** True when every modified-without-test symbol has a must_have proposal pointing at it. */
  allModifiedSymbolsCovered: boolean;
}

export function verdictFor(
  symbols: readonly DiffSymbol[],
  proposals: readonly TestProposal[],
): CoverageVerdict {
  const proposalCounts = proposals.reduce(
    (acc, p) => {
      acc[p.priority] += 1;
      return acc;
    },
    { must_have: 0, should_have: 0, nice_to_have: 0 } as Record<TestPriority, number>,
  );

  const uncoveredModified = symbols.filter(
    (s) => s.changeKind === "modified" && s.existingTests.length === 0,
  );
  const uncoveredWithMustHave = uncoveredModified.every((s) =>
    proposals.some((p) => p.symbolId === s.id && p.priority === "must_have"),
  );

  return {
    mustHaveCount: clamp(proposalCounts.must_have, 0, Number.MAX_SAFE_INTEGER),
    shouldHaveCount: proposalCounts.should_have,
    niceToHaveCount: proposalCounts.nice_to_have,
    allModifiedSymbolsCovered: uncoveredWithMustHave,
  };
}
