import { describe, it, expect, beforeEach } from "vitest";
import {
  proposeTests,
  verdictFor,
  __resetProposalCounter,
  type DiffSymbol,
} from "../testCoverageProposer";

const SYM = (partial: Partial<DiffSymbol> & { id: string }): DiffSymbol => {
  const { id, ...overrides } = partial;
  return {
    kind: "function",
    changeKind: "added",
    exported: false,
    hasBranches: false,
    canError: false,
    hasClosedUnionReturn: false,
    existingTests: [],
    ...overrides,
    id,
  };
};

beforeEach(() => __resetProposalCounter());

describe("testCoverageProposer", () => {
  it("modified symbol without an existing test gets a must-have regression proposal", () => {
    const p = proposeTests([SYM({ id: "lib/foo.ts:bar", changeKind: "modified" })]);
    expect(p.length).toBeGreaterThan(0);
    expect(p[0].kind).toBe("regression");
    expect(p[0].priority).toBe("must_have");
  });

  it("modified symbol WITH an existing test does not get a regression proposal", () => {
    const p = proposeTests([
      SYM({ id: "lib/foo.ts:bar", changeKind: "modified", existingTests: ["lib/foo.test.ts"] }),
    ]);
    expect(p.some((x) => x.kind === "regression")).toBe(false);
  });

  it("newly added exported symbol gets a golden-path must-have", () => {
    const p = proposeTests([SYM({ id: "lib/foo.ts:newApi", exported: true })]);
    expect(p.some((x) => x.kind === "golden_path" && x.priority === "must_have")).toBe(true);
  });

  it("branches → edge-case proposal", () => {
    const p = proposeTests([SYM({ id: "lib/foo.ts:withBranches", hasBranches: true })]);
    expect(p.some((x) => x.kind === "edge_case")).toBe(true);
  });

  it("can-error → error-path proposal", () => {
    const p = proposeTests([SYM({ id: "lib/foo.ts:risky", canError: true })]);
    expect(p.some((x) => x.kind === "error_path")).toBe(true);
  });

  it("closed-union return on an exported symbol → contract proposal", () => {
    const p = proposeTests([
      SYM({ id: "lib/foo.ts:tagged", exported: true, hasClosedUnionReturn: true }),
    ]);
    expect(p.some((x) => x.kind === "contract")).toBe(true);
  });

  it("closed-union return on a NON-exported symbol → no contract proposal", () => {
    const p = proposeTests([
      SYM({ id: "lib/foo.ts:tagged", exported: false, hasClosedUnionReturn: true }),
    ]);
    expect(p.some((x) => x.kind === "contract")).toBe(false);
  });

  it("nothing else triggers → falls back to a nice-to-have smoke for added helpers", () => {
    const p = proposeTests([SYM({ id: "lib/foo.ts:plain", changeKind: "added" })]);
    expect(p.length).toBe(1);
    expect(p[0].priority).toBe("nice_to_have");
  });

  it("sorted by priority — must-have first", () => {
    const p = proposeTests([
      SYM({ id: "lib/a.ts:onlyNice", changeKind: "added" }),
      SYM({ id: "lib/b.ts:critical", changeKind: "modified" }),
    ]);
    expect(p[0].priority).toBe("must_have");
    expect(p[p.length - 1].priority).toBe("nice_to_have");
  });

  it("verdictFor reports counts + coverage", () => {
    const symbols = [
      SYM({ id: "lib/x.ts:noTest", changeKind: "modified" }),
      SYM({ id: "lib/y.ts:hasTest", changeKind: "modified", existingTests: ["lib/y.test.ts"] }),
    ];
    const proposals = proposeTests(symbols);
    const v = verdictFor(symbols, proposals);
    expect(v.mustHaveCount).toBeGreaterThan(0);
    expect(v.allModifiedSymbolsCovered).toBe(true);
  });

  it("verdictFor flags uncovered modified symbol when no proposal references it", () => {
    const symbols = [SYM({ id: "lib/z.ts:noTest", changeKind: "modified" })];
    // Manually clear proposals to simulate a missed proposer pass.
    const v = verdictFor(symbols, []);
    expect(v.allModifiedSymbolsCovered).toBe(false);
  });

  it("issues sequential ids on the in-process counter", () => {
    const p = proposeTests([SYM({ id: "lib/a.ts:fn1", changeKind: "modified" })]);
    expect(p[0].id).toBe("tcov-1");
  });
});
