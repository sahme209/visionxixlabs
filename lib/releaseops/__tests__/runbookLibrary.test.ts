import { describe, expect, it } from "vitest";
import { RUNBOOK_TEMPLATES, approvalSummary, diffRunbooks, exportRunbooks, parseRunbooksDocument, validateRunbook, type RunbookSpec } from "../runbookLibrary";

const rb = (over: Partial<RunbookSpec> = {}): RunbookSpec => ({ key: "failed-deploy", title: "Failed deploy", trigger: "deployment_failed", enabled: true, steps: [{ title: "Look", detail: "read", approval: "none" }, { title: "Roll back", detail: "x", approval: "one_admin" }], ...over });

describe("runbook library", () => {
  it("templates are valid and unique", () => {
    for (const t of RUNBOOK_TEMPLATES) expect(validateRunbook(t).ok).toBe(true);
    expect(new Set(RUNBOOK_TEMPLATES.map((t) => t.key)).size).toBe(RUNBOOK_TEMPLATES.length);
  });
  it("refuses destructive commands and bad shapes", () => {
    const bad = validateRunbook(rb({ steps: [{ title: "Clean", detail: "rm -rf / --no-preserve-root", approval: "two_admins" }] }));
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.errors[0]).toMatch(/steps.0: destructive/);
    expect(validateRunbook(rb({ key: "Bad Key" })).ok).toBe(false);
    expect(validateRunbook(rb({ steps: [] })).ok).toBe(false);
    expect(validateRunbook({ ...rb(), extra: 1 }).ok).toBe(false);
  });
  it("summarizes approvals", () => {
    expect(approvalSummary(rb())).toEqual({ gated: 1, strongest: "one_admin" });
    expect(approvalSummary(RUNBOOK_TEMPLATES[2])).toEqual({ gated: 2, strongest: "two_admins" });
  });
  it("round-trips the file and refuses duplicates", () => {
    const text = exportRunbooks([rb({ key: "b" }), rb({ key: "a" })]);
    const parsed = parseRunbooksDocument(text);
    expect(parsed.ok && parsed.runbooks.map((r) => r.key)).toEqual(["a", "b"]);
    expect(parseRunbooksDocument(JSON.stringify({ kind: "v19.runbooks", version: 1, runbooks: [rb(), rb()] })).ok).toBe(false);
    expect(parseRunbooksDocument("{").ok).toBe(false);
  });
  it("diffs: added, changed, disabled, and weaker approvals are loosening", () => {
    const d = diffRunbooks([rb(), rb({ key: "old" })], [rb({ steps: [{ title: "Roll back", detail: "x", approval: "none" }] }), rb({ key: "new" })]);
    expect(d).toEqual({ added: ["new"], changed: ["failed-deploy"], disabled: ["old"], unchanged: 0, loosening: ["failed-deploy: fewer or weaker approvals"] });
    expect(diffRunbooks([rb()], [rb()]).unchanged).toBe(1);
  });
});
