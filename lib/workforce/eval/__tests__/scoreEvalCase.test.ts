import { describe, it, expect } from "vitest";
import { scoreEvalCase } from "../scoreEvalCase";
import { findEvalTask } from "../evalTaskCorpus";

const TYPO = findEvalTask("trivial_comment_typo")!;
const REFACTOR = findEvalTask("refactor_extract_helper")!;
const HEALTHZ = findEvalTask("add_feature_healthz_route")!;

describe("scoreEvalCase — fatal failures", () => {
  it("no patch text → fail with no_proposed_patch", () => {
    const r = scoreEvalCase({
      spec: TYPO,
      proposedPatchText: null,
      filePathsChanged: [],
      diffParsed: false,
      costCents: 0,
    });
    expect(r.outcome).toBe("fail");
    expect(r.failures).toContain("no_proposed_patch");
    expect(r.score).toBe(0);
  });

  it("executor errored → errored outcome", () => {
    const r = scoreEvalCase({
      spec: TYPO,
      proposedPatchText: "irrelevant",
      filePathsChanged: [],
      diffParsed: false,
      costCents: 0,
      executorError: "GitHub rate-limited.",
    });
    expect(r.outcome).toBe("errored");
    expect(r.failures).toEqual(["executor_errored"]);
  });

  it("refusal accepted when minFilesChanged === 0 (refactor task)", () => {
    const r = scoreEvalCase({
      spec: REFACTOR,
      proposedPatchText: "",
      filePathsChanged: [],
      diffParsed: false,
      costCents: 5,
    });
    expect(r.outcome).toBe("pass");
    expect(r.notes).toContain("Refusal accepted");
  });
});

describe("scoreEvalCase — partial credit", () => {
  it("passes when all expectations satisfied", () => {
    const patchText = [
      "--- a/README.md",
      "+++ b/README.md",
      "@@ -1 +1 @@",
      "-old text",
      "+fixed text",
    ].join("\n");
    const r = scoreEvalCase({
      spec: TYPO,
      proposedPatchText: patchText,
      filePathsChanged: ["README.md"],
      diffParsed: true,
      costCents: 5,
    });
    expect(r.outcome).toBe("pass");
    expect(r.failures).toEqual([]);
    expect(r.score).toBe(1);
  });

  it("touched too many files → files_changed_above_max", () => {
    const r = scoreEvalCase({
      spec: TYPO,
      proposedPatchText: "--- a/a.ts\n+++ b/a.ts\n",
      filePathsChanged: ["README.md", "src/a.ts", "src/b.ts"],
      diffParsed: true,
      costCents: 10,
    });
    expect(r.failures).toContain("files_changed_above_max");
  });

  it("cost_overrun fires when costCents exceeds the budget", () => {
    const r = scoreEvalCase({
      spec: TYPO,
      proposedPatchText: "--- a/README.md\n+++ b/README.md",
      filePathsChanged: ["README.md"],
      diffParsed: true,
      costCents: TYPO.expectedMaxCostCents + 1,
    });
    expect(r.failures).toContain("cost_overrun");
  });

  it("missing required substring fires once even if multiple are missing", () => {
    const r = scoreEvalCase({
      spec: HEALTHZ,
      proposedPatchText: "--- a/x\n+++ b/x\n@@ -1 +1 @@",
      filePathsChanged: ["app/api/healthz/route.ts"],
      diffParsed: true,
      costCents: 30,
    });
    // missing "NextResponse" + "/dev/null" — should add ONE failure, not multiple.
    const missingSubstring = r.failures.filter((f) => f === "missing_required_substring").length;
    expect(missingSubstring).toBe(1);
  });

  it("missing expected path fires once", () => {
    const r = scoreEvalCase({
      spec: HEALTHZ,
      proposedPatchText: "--- a/other.ts\n+++ b/other.ts\n@@ -1 +1 @@\n-NextResponse",
      filePathsChanged: ["other.ts"],
      diffParsed: true,
      costCents: 30,
    });
    expect(r.failures).toContain("missing_expected_path");
  });

  it("parse_failed fires when diffParsed=false", () => {
    const r = scoreEvalCase({
      spec: TYPO,
      proposedPatchText: "not a diff",
      filePathsChanged: [],
      diffParsed: false,
      costCents: 5,
    });
    expect(r.failures).toContain("parse_failed");
  });
});

describe("scoreEvalCase — score math", () => {
  it("score=1 with no failures", () => {
    const r = scoreEvalCase({
      spec: TYPO,
      proposedPatchText: "--- a/README.md\n+++ b/README.md",
      filePathsChanged: ["README.md"],
      diffParsed: true,
      costCents: 5,
    });
    expect(r.score).toBe(1);
  });

  it("score decreases with each failure category", () => {
    const r = scoreEvalCase({
      spec: TYPO,
      proposedPatchText: "--- a/foo.ts\n+++ b/foo.ts",
      filePathsChanged: ["foo.ts", "bar.ts"],
      diffParsed: true,
      costCents: TYPO.expectedMaxCostCents + 100,
    });
    // 2 failures (files_changed_above_max + cost_overrun + missing_expected_path)
    expect(r.score).toBeLessThan(1);
    expect(r.score).toBeGreaterThan(0);
  });

  it("duplicated failure category counts once", () => {
    const r = scoreEvalCase({
      spec: HEALTHZ,
      proposedPatchText: "irrelevant text without any expected substring",
      filePathsChanged: ["wrong-path.ts"],
      diffParsed: true,
      costCents: 30,
    });
    // Two different missing substrings should add ONE "missing_required_substring" failure.
    const counts: Record<string, number> = {};
    for (const f of r.failures) counts[f] = (counts[f] ?? 0) + 1;
    expect(counts["missing_required_substring"]).toBe(1);
  });
});

describe("scoreEvalCase — pass/fail threshold", () => {
  it("score >= 0.6 → pass when no fatal", () => {
    const r = scoreEvalCase({
      spec: TYPO,
      proposedPatchText: "--- a/README.md\n+++ b/README.md\n",
      filePathsChanged: ["README.md", "extra.ts"], // 1 failure
      diffParsed: true,
      costCents: 5,
    });
    // 1 failure → score = 5/6 ≈ 0.83 → pass
    expect(r.outcome).toBe("pass");
  });

  it("low score → fail", () => {
    const r = scoreEvalCase({
      spec: TYPO,
      proposedPatchText: "irrelevant",
      filePathsChanged: ["a", "b", "c", "d", "e"],
      diffParsed: false,
      costCents: TYPO.expectedMaxCostCents + 100,
    });
    expect(r.outcome).toBe("fail");
  });
});
