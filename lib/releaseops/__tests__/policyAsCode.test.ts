import { describe, expect, it } from "vitest";
import { diffPolicy, exportPolicyDocument, parsePolicyDocument } from "../policyAsCode";

const rule = (key: string, over: Record<string, unknown> = {}) => ({ key, label: key, severity: "high", blocking: true, exceptionAllowed: false, approverRole: null, evidenceRequired: true, enabled: true, description: null, ...over });

describe("policy as code", () => {
  it("exports a stable, sorted document that parses back", () => {
    const text = exportPolicyDocument([rule("min_approvals"), rule("block_force_push")]);
    expect(exportPolicyDocument([rule("block_force_push"), rule("min_approvals")])).toBe(text);
    const parsed = parsePolicyDocument(text);
    expect(parsed.ok && parsed.document.rules.map((r) => r.key)).toEqual(["block_force_push", "min_approvals"]);
  });

  it("rejects invalid files with readable errors", () => {
    expect(parsePolicyDocument("{")).toEqual({ ok: false, errors: ["The file is not valid JSON."] });
    const dup = parsePolicyDocument(JSON.stringify({ kind: "v19.policy", version: 1, rules: [rule("a"), rule("a")] }));
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.errors.join(" ")).toContain('duplicate key "a"');
    const bad = parsePolicyDocument(JSON.stringify({ kind: "v19.policy", version: 1, rules: [rule("Bad Key", { severity: "urgent" })] }));
    expect(bad.ok).toBe(false);
  });

  it("diffs a proposal and flags changes that loosen governance", () => {
    const proposed = parsePolicyDocument(JSON.stringify({ kind: "v19.policy", version: 1, rules: [
      rule("min_approvals", { blocking: false, exceptionAllowed: true }),
      rule("new_rule"),
    ] }));
    if (!proposed.ok) throw new Error("setup");
    const d = diffPolicy([rule("min_approvals"), rule("block_force_push")], proposed.document);
    expect(d.added.map((r) => r.key)).toEqual(["new_rule"]);
    expect(d.removed).toEqual(["block_force_push"]);
    expect(d.changed[0].fields.map((f) => f.field)).toEqual(["blocking", "exceptionAllowed"]);
    expect(d.loosening).toEqual(["min_approvals: no longer blocks releases", "min_approvals: exceptions now allowed", "block_force_push: removed"]);
  });
});
