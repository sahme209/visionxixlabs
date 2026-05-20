/**
 * Vitest unit tests for the pure CI lint-summary builder.
 */

import { describe, it, expect } from "vitest";
import { buildLintSummary, type LintMessage } from "../lintSummaryBuilder";

const M = (file: string, rule: string, severity: LintMessage["severity"]): LintMessage =>
  ({ file, rule, severity, message: "(test)" });

describe("lintSummaryBuilder", () => {
  it("empty input → verdict clean", () => {
    const r = buildLintSummary([]);
    expect(r.verdict).toBe("clean");
    expect(r.totals.total).toBe(0);
  });

  it("errors present → blocking verdict", () => {
    const r = buildLintSummary([M("a.ts", "no-unused-vars", "error")]);
    expect(r.verdict).toBe("blocking");
    expect(r.totals.error).toBe(1);
  });

  it("warnings only → minor", () => {
    const r = buildLintSummary([M("a.ts", "prefer-const", "warning")]);
    expect(r.verdict).toBe("minor");
  });

  it("info only → still clean (info doesn't block or warn)", () => {
    const r = buildLintSummary([M("a.ts", "doc-hint", "info")]);
    expect(r.verdict).toBe("clean");
    expect(r.totals.info).toBe(1);
  });

  it("groups by file with severity sub-counts", () => {
    const r = buildLintSummary([
      M("a.ts", "r1", "error"),
      M("a.ts", "r2", "warning"),
      M("b.ts", "r1", "error"),
    ]);
    const a = r.topFiles.find((x) => x.file === "a.ts")!;
    expect(a).toMatchObject({ errors: 1, warnings: 1, info: 0, total: 2 });
    const b = r.topFiles.find((x) => x.file === "b.ts")!;
    expect(b).toMatchObject({ errors: 1, warnings: 0, info: 0, total: 1 });
  });

  it("topFiles sorted by errors desc then total desc", () => {
    const r = buildLintSummary([
      M("a.ts", "r1", "warning"),
      M("a.ts", "r2", "warning"),
      M("b.ts", "r1", "error"),
    ]);
    expect(r.topFiles[0].file).toBe("b.ts");
    expect(r.topFiles[1].file).toBe("a.ts");
  });

  it("topRules sorted by count desc then worstSeverity desc", () => {
    const r = buildLintSummary([
      M("a.ts", "common", "info"),
      M("b.ts", "common", "info"),
      M("c.ts", "common", "info"),
      M("d.ts", "rare", "error"),
    ]);
    expect(r.topRules[0]).toMatchObject({ rule: "common", count: 3 });
    expect(r.topRules[1]).toMatchObject({ rule: "rare", count: 1, worstSeverity: "error" });
  });

  it("topFiles capped at 20", () => {
    const messages: LintMessage[] = [];
    for (let i = 0; i < 30; i++) messages.push(M(`f${i}.ts`, "r1", "warning"));
    const r = buildLintSummary(messages);
    expect(r.topFiles.length).toBe(20);
  });
});
