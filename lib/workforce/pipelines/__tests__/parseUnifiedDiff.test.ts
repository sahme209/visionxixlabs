import { describe, it, expect } from "vitest";
import { parseUnifiedDiff } from "../parseUnifiedDiff";

describe("parseUnifiedDiff — basic shapes", () => {
  it("parses a single-file modification", () => {
    const text = [
      "--- a/foo.ts",
      "+++ b/foo.ts",
      "@@ -1,3 +1,3 @@",
      " function hello() {",
      "-  return 1;",
      "+  return 2;",
      " }",
    ].join("\n");
    const r = parseUnifiedDiff(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.files).toHaveLength(1);
    expect(r.files[0].path).toBe("foo.ts");
    expect(r.files[0].changeKind).toBe("modified");
    expect(r.files[0].hunks).toHaveLength(1);
    expect(r.files[0].hunks[0].oldStart).toBe(1);
    expect(r.files[0].hunks[0].newStart).toBe(1);
    expect(r.files[0].hunks[0].lines).toEqual([
      " function hello() {",
      "-  return 1;",
      "+  return 2;",
      " }",
    ]);
  });

  it("parses an added file (--- /dev/null)", () => {
    const text = [
      "--- /dev/null",
      "+++ b/new.ts",
      "@@ -0,0 +1,2 @@",
      "+export const X = 1;",
      "+export const Y = 2;",
    ].join("\n");
    const r = parseUnifiedDiff(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.files[0].changeKind).toBe("added");
    expect(r.files[0].path).toBe("new.ts");
  });

  it("parses a deleted file (+++ /dev/null)", () => {
    const text = [
      "--- a/old.ts",
      "+++ /dev/null",
      "@@ -1,1 +0,0 @@",
      "-export const Z = 3;",
    ].join("\n");
    const r = parseUnifiedDiff(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.files[0].changeKind).toBe("deleted");
    expect(r.files[0].path).toBe("old.ts");
  });

  it("parses multiple files in one diff", () => {
    const text = [
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -1 +1 @@",
      "-old a",
      "+new a",
      "--- a/b.ts",
      "+++ b/b.ts",
      "@@ -1 +1 @@",
      "-old b",
      "+new b",
    ].join("\n");
    const r = parseUnifiedDiff(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.files).toHaveLength(2);
    expect(r.files.map((f) => f.path)).toEqual(["a.ts", "b.ts"]);
  });

  it("parses multiple hunks in one file", () => {
    const text = [
      "--- a/foo.ts",
      "+++ b/foo.ts",
      "@@ -1,1 +1,1 @@",
      "-line 1 old",
      "+line 1 new",
      "@@ -10,1 +10,1 @@",
      "-line 10 old",
      "+line 10 new",
    ].join("\n");
    const r = parseUnifiedDiff(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.files[0].hunks).toHaveLength(2);
    expect(r.files[0].hunks[1].oldStart).toBe(10);
  });
});

describe("parseUnifiedDiff — fence + preamble", () => {
  it("extracts diff from a ```diff fenced code block", () => {
    const text = [
      "Here is the patch:",
      "",
      "```diff",
      "--- a/foo.ts",
      "+++ b/foo.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "```",
      "",
      "End of patch.",
    ].join("\n");
    const r = parseUnifiedDiff(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.files).toHaveLength(1);
  });

  it("extracts diff from a ```patch fenced block", () => {
    const text = [
      "```patch",
      "--- a/foo.ts",
      "+++ b/foo.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "```",
    ].join("\n");
    expect(parseUnifiedDiff(text).ok).toBe(true);
  });

  it("preamble before the --- line is ignored", () => {
    const text = [
      "Plan: change one line in foo.ts.",
      "",
      "PR title: tweak foo",
      "",
      "--- a/foo.ts",
      "+++ b/foo.ts",
      "@@ -1 +1 @@",
      "-x",
      "+y",
    ].join("\n");
    const r = parseUnifiedDiff(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.files).toHaveLength(1);
  });
});

describe("parseUnifiedDiff — hunk header variants", () => {
  it("accepts @@ with single-line counts elided (-1 + 1)", () => {
    const text = [
      "--- a/foo.ts",
      "+++ b/foo.ts",
      "@@ -1 +1 @@",
      "-x",
      "+y",
    ].join("\n");
    const r = parseUnifiedDiff(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.files[0].hunks[0].oldCount).toBe(1);
    expect(r.files[0].hunks[0].newCount).toBe(1);
  });

  it("rejects bad hunk header", () => {
    const text = [
      "--- a/foo.ts",
      "+++ b/foo.ts",
      "@@ this is not a valid header @@",
      "-x",
      "+y",
    ].join("\n");
    const r = parseUnifiedDiff(text);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("malformed_hunk_header");
  });
});

describe("parseUnifiedDiff — failures", () => {
  it("no diff block at all", () => {
    expect(parseUnifiedDiff("just text").ok).toBe(false);
    expect(parseUnifiedDiff("").ok).toBe(false);
  });

  it("--- without +++", () => {
    const r = parseUnifiedDiff("--- a/foo.ts\nrandom garbage");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("malformed_header");
  });
});

describe("parseUnifiedDiff — defensive", () => {
  it("strips a/ and b/ prefixes from path", () => {
    const text = [
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -1 +1 @@",
      "-x",
      "+y",
    ].join("\n");
    const r = parseUnifiedDiff(text);
    if (!r.ok) throw new Error("expected ok");
    expect(r.files[0].path).toBe("src/foo.ts");
  });
});
