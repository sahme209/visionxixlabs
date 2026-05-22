import { describe, it, expect } from "vitest";
import { applyHunks, applyDiff } from "../applyUnifiedDiff";
import { parseUnifiedDiff } from "../parseUnifiedDiff";

describe("applyHunks — single-line modify", () => {
  it("replaces a single line with context", () => {
    const base = "function hello() {\n  return 1;\n}";
    const hunks = [{
      oldStart: 1, oldCount: 3, newStart: 1, newCount: 3,
      lines: [" function hello() {", "-  return 1;", "+  return 2;", " }"],
    }];
    const r = applyHunks(base, hunks);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newContent).toBe("function hello() {\n  return 2;\n}");
  });

  it("returns context_mismatch when context line doesn't match base", () => {
    const base = "function world() {\n  return 1;\n}";
    const hunks = [{
      oldStart: 1, oldCount: 3, newStart: 1, newCount: 3,
      lines: [" function hello() {", "-  return 1;", "+  return 2;", " }"],
    }];
    const r = applyHunks(base, hunks);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("context_mismatch");
  });

  it("returns delete_mismatch when '-' line doesn't match base", () => {
    const base = "function hello() {\n  return 99;\n}";
    const hunks = [{
      oldStart: 1, oldCount: 3, newStart: 1, newCount: 3,
      lines: [" function hello() {", "-  return 1;", "+  return 2;", " }"],
    }];
    const r = applyHunks(base, hunks);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("delete_mismatch");
  });
});

describe("applyHunks — multi-hunk + offset", () => {
  it("applies hunks separated by unchanged base content", () => {
    const base = [
      "line 1",
      "line 2",
      "line 3",
      "line 4",
      "line 5",
    ].join("\n");
    const hunks = [
      {
        oldStart: 1, oldCount: 1, newStart: 1, newCount: 1,
        lines: ["-line 1", "+LINE 1"],
      },
      {
        oldStart: 5, oldCount: 1, newStart: 5, newCount: 1,
        lines: ["-line 5", "+LINE 5"],
      },
    ];
    const r = applyHunks(base, hunks);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newContent).toBe("LINE 1\nline 2\nline 3\nline 4\nLINE 5");
  });

  it("preserves untouched trailing lines", () => {
    const base = "a\nb\nc\nd\ne";
    const hunks = [{
      oldStart: 1, oldCount: 1, newStart: 1, newCount: 1,
      lines: ["-a", "+A"],
    }];
    const r = applyHunks(base, hunks);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newContent).toBe("A\nb\nc\nd\ne");
  });
});

describe("applyHunks — adds + deletes only", () => {
  it("pure insertion (no deletes)", () => {
    const base = "a\nb";
    const hunks = [{
      oldStart: 1, oldCount: 2, newStart: 1, newCount: 3,
      lines: [" a", "+inserted", " b"],
    }];
    const r = applyHunks(base, hunks);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newContent).toBe("a\ninserted\nb");
  });

  it("pure deletion (no inserts)", () => {
    const base = "a\nb\nc";
    const hunks = [{
      oldStart: 1, oldCount: 3, newStart: 1, newCount: 2,
      lines: [" a", "-b", " c"],
    }];
    const r = applyHunks(base, hunks);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newContent).toBe("a\nc");
  });
});

describe("applyDiff — added/deleted/modified", () => {
  it("new file: concatenates all '+' lines", () => {
    const r = applyDiff({
      diff: {
        path: "new.ts",
        changeKind: "added",
        hunks: [{
          oldStart: 0, oldCount: 0, newStart: 1, newCount: 2,
          lines: ["+export const X = 1;", "+export const Y = 2;"],
        }],
      },
      baseContent: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry.changeKind).toBe("added");
    expect(r.entry.newContent).toBe("export const X = 1;\nexport const Y = 2;");
  });

  it("deleted file: newContent null", () => {
    const r = applyDiff({
      diff: {
        path: "old.ts",
        changeKind: "deleted",
        hunks: [],
      },
      baseContent: "anything",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry.newContent).toBeNull();
  });

  it("modified file without base content fails", () => {
    const r = applyDiff({
      diff: {
        path: "foo.ts",
        changeKind: "modified",
        hunks: [{ oldStart: 1, oldCount: 1, newStart: 1, newCount: 1, lines: ["-a", "+b"] }],
      },
      baseContent: null,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("missing_base_for_modified");
  });

  it("added file with no hunks fails", () => {
    const r = applyDiff({
      diff: { path: "x.ts", changeKind: "added", hunks: [] },
      baseContent: null,
    });
    expect(r.ok).toBe(false);
  });
});

describe("integration: parse + apply round-trip", () => {
  it("Claude-style diff applies cleanly", () => {
    const base = "function hello() {\n  return 1;\n}";
    const diffText = [
      "--- a/foo.ts",
      "+++ b/foo.ts",
      "@@ -1,3 +1,3 @@",
      " function hello() {",
      "-  return 1;",
      "+  return 2;",
      " }",
    ].join("\n");
    const parsed = parseUnifiedDiff(diffText);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = applyDiff({ diff: parsed.files[0], baseContent: base });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.newContent).toBe("function hello() {\n  return 2;\n}");
  });

  it("multi-file diff applies each independently", () => {
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
    const parsed = parseUnifiedDiff(text);
    if (!parsed.ok) throw new Error("parse failed");
    const ra = applyDiff({ diff: parsed.files[0], baseContent: "old a" });
    const rb = applyDiff({ diff: parsed.files[1], baseContent: "old b" });
    if (!ra.ok || !rb.ok) throw new Error("apply failed");
    expect(ra.entry.newContent).toBe("new a");
    expect(rb.entry.newContent).toBe("new b");
  });
});
