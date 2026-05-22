import { describe, it, expect } from "vitest";
import { analyzeTestChange, isTestFilePath } from "../testAssertionAnalyzer";

describe("isTestFilePath", () => {
  it("matches .test.ts/.test.tsx", () => {
    expect(isTestFilePath("foo.test.ts")).toBe(true);
    expect(isTestFilePath("nested/dir/foo.test.tsx")).toBe(true);
  });

  it("matches .spec.js/.spec.mjs", () => {
    expect(isTestFilePath("a.spec.js")).toBe(true);
    expect(isTestFilePath("a.spec.mjs")).toBe(true);
  });

  it("matches anything in __tests__", () => {
    expect(isTestFilePath("lib/__tests__/foo.ts")).toBe(true);
    expect(isTestFilePath("__tests__/bar.tsx")).toBe(true);
  });

  it("rejects non-test files", () => {
    expect(isTestFilePath("foo.ts")).toBe(false);
    expect(isTestFilePath("README.md")).toBe(false);
    expect(isTestFilePath("test-utils.ts")).toBe(false);
  });
});

describe("analyzeTestChange — clean changes", () => {
  it("ok when nothing changed", () => {
    const src = `
      describe("foo", () => {
        it("bar", () => { expect(1).toBe(1); });
      });
    `;
    const r = analyzeTestChange({ baseContent: src, newContent: src });
    expect(r.ok).toBe(true);
    expect(r.findings).toEqual([]);
  });

  it("ok when a new test is added", () => {
    const base = `describe("d", () => { it("a", () => { expect(1).toBe(1); }); });`;
    const next = `describe("d", () => { it("a", () => { expect(1).toBe(1); }); it("b", () => { expect(2).toBe(2); }); });`;
    const r = analyzeTestChange({ baseContent: base, newContent: next });
    expect(r.ok).toBe(true);
  });

  it("ok when assertions strengthen (toBeTruthy → toBe(specific))", () => {
    const base = `it("x", () => { expect(value).toBeTruthy(); });`;
    const next = `it("x", () => { expect(value).toBe(42); });`;
    const r = analyzeTestChange({ baseContent: base, newContent: next });
    expect(r.ok).toBe(true);
  });
});

describe("analyzeTestChange — deleted tests", () => {
  it("flags removed labelled it()", () => {
    const base = `it("active test", () => { expect(1).toBe(1); }); it("kept", () => { expect(2).toBe(2); });`;
    const next = `it("kept", () => { expect(2).toBe(2); });`;
    const r = analyzeTestChange({ baseContent: base, newContent: next });
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.kind === "deleted_test_case" && f.label === "active test")).toBe(true);
  });

  it("flags removed describe block", () => {
    const base = `describe("group A", () => { it("a", () => { expect(1).toBe(1); }); }); describe("group B", () => { it("b", () => { expect(2).toBe(2); }); });`;
    const next = `describe("group B", () => { it("b", () => { expect(2).toBe(2); }); });`;
    const r = analyzeTestChange({ baseContent: base, newContent: next });
    expect(r.findings.some((f) => f.kind === "deleted_describe_block" && f.label === "group A")).toBe(true);
  });

  it("flags count drop even when labels can't attribute", () => {
    const base = `for (const x of cases) { it(x, () => { expect(x).toBeDefined(); }); }`;
    // base has 1 it() call, all unlabelled (label is a variable)
    const next = ``;
    const r = analyzeTestChange({ baseContent: base, newContent: next });
    expect(r.findings.some((f) => f.kind === "deleted_test_case")).toBe(true);
  });
});

describe("analyzeTestChange — weakened assertions", () => {
  it("flags toBe → toBeTruthy when expect count stays same", () => {
    const base = `it("x", () => { expect(result).toBe(42); });`;
    const next = `it("x", () => { expect(result).toBeTruthy(); });`;
    const r = analyzeTestChange({ baseContent: base, newContent: next });
    expect(r.findings.some((f) => f.kind === "weakened_assertion")).toBe(true);
  });

  it("flags toBe → toBeDefined", () => {
    const base = `expect(x).toBe("hello");`;
    const next = `expect(x).toBeDefined();`;
    const r = analyzeTestChange({ baseContent: base, newContent: next });
    expect(r.findings.some((f) => f.kind === "weakened_assertion")).toBe(true);
  });

  it("does NOT flag weakened when new assertions also added", () => {
    const base = `expect(x).toBe(1);`;
    const next = `expect(x).toBe(1); expect(y).toBeDefined(); expect(z).toBe(2);`;
    const r = analyzeTestChange({ baseContent: base, newContent: next });
    expect(r.findings.some((f) => f.kind === "weakened_assertion")).toBe(false);
  });
});

describe("analyzeTestChange — removed expect calls", () => {
  it("flags expect count drop", () => {
    const base = `it("x", () => { expect(a).toBe(1); expect(b).toBe(2); });`;
    const next = `it("x", () => { expect(a).toBe(1); });`;
    const r = analyzeTestChange({ baseContent: base, newContent: next });
    expect(r.findings.some((f) => f.kind === "removed_expect_call")).toBe(true);
  });

  it("flags total assertion wipe", () => {
    const base = `it("x", () => { expect(a).toBe(1); }); it("y", () => { expect(b).toBe(2); });`;
    const next = `it("x", () => { /* removed */ }); it("y", () => { /* removed */ });`;
    const r = analyzeTestChange({ baseContent: base, newContent: next });
    expect(r.findings.some((f) => f.kind === "no_assertions_remaining")).toBe(true);
  });
});

describe("analyzeTestChange — newly skipped", () => {
  it("flags it.skip on a previously-active test", () => {
    const base = `it("flaky", () => { expect(1).toBe(1); });`;
    const next = `it.skip("flaky", () => { expect(1).toBe(1); });`;
    const r = analyzeTestChange({ baseContent: base, newContent: next });
    expect(r.findings.some((f) => f.kind === "newly_skipped_test")).toBe(true);
  });

  it("flags xit conversion", () => {
    const base = `it("xtest", () => { expect(1).toBe(1); });`;
    const next = `xit("xtest", () => { expect(1).toBe(1); });`;
    const r = analyzeTestChange({ baseContent: base, newContent: next });
    expect(r.findings.some((f) => f.kind === "newly_skipped_test")).toBe(true);
  });
});

describe("analyzeTestChange — comment/string safety", () => {
  it("ignores it() inside a // line comment", () => {
    const base = `// it("ghost", () => {})`;
    const next = ``;
    const r = analyzeTestChange({ baseContent: base, newContent: next });
    expect(r.ok).toBe(true);
  });

  it("ignores it() inside a block comment", () => {
    const base = `/* it("ghost", () => {}) */`;
    const next = ``;
    const r = analyzeTestChange({ baseContent: base, newContent: next });
    expect(r.ok).toBe(true);
  });

  it("ignores 'it(' inside a string literal", () => {
    const base = `const msg = "we call it('hi') inside a string";`;
    const next = ``;
    const r = analyzeTestChange({ baseContent: base, newContent: next });
    expect(r.ok).toBe(true);
  });
});

describe("analyzeTestChange — counts surfaced", () => {
  it("returns base/new counts for audit", () => {
    const base = `describe("a", () => { it("a1", () => { expect(1).toBe(1); }); });`;
    const next = `describe("a", () => { it("a1", () => { expect(1).toBe(1); }); it("a2", () => { expect(2).toBe(2); }); });`;
    const r = analyzeTestChange({ baseContent: base, newContent: next });
    expect(r.baseTestCount).toBe(1);
    expect(r.newTestCount).toBe(2);
    expect(r.baseDescribeCount).toBe(1);
    expect(r.newDescribeCount).toBe(1);
    expect(r.baseExpectCount).toBe(1);
    expect(r.newExpectCount).toBe(2);
  });
});
