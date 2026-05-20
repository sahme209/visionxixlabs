/**
 * Vitest unit tests for the pure runbook step validator.
 */

import { describe, it, expect } from "vitest";
import { validateRunbookSteps, type ProposedRunbookStep } from "../runbookStepValidator";

const S = (kind: ProposedRunbookStep["kind"], label: string, body = ""): ProposedRunbookStep =>
  ({ kind, label, body });

describe("runbookStepValidator", () => {
  it("empty steps → fail", () => {
    const r = validateRunbookSteps([]);
    expect(r.valid).toBe(false);
    expect(r.severity).toBe("fail");
  });

  it("missing operator_gate → fail", () => {
    const r = validateRunbookSteps([
      S("stage", "stage rollback", "stage rollback to previous version"),
      S("audit", "audit", "log audit row"),
    ]);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("operator_gate"))).toBe(true);
  });

  it("happy path: stage → gate → audit", () => {
    const r = validateRunbookSteps([
      S("stage", "stage rollback", "stage rollback to previous version"),
      S("operator_gate", "human approve"),
      S("audit", "audit", "log audit"),
    ]);
    expect(r.valid).toBe(true);
    expect(r.severity).toBe("ok");
  });

  it("any 'rm -rf /<path>' in body → fail (intentionally broad)", () => {
    // The validator is deliberately strict: ANY absolute-path rm -rf is rejected.
    const tmp = validateRunbookSteps([
      S("operator_gate", "ack"),
      S("stage", "clean", "rm -rf /tmp/old"),
      S("audit", "x"),
    ]);
    expect(tmp.valid).toBe(false);
    const root = validateRunbookSteps([
      S("operator_gate", "ack"),
      S("stage", "wipe", "rm -rf /"),
      S("audit", "x"),
    ]);
    expect(root.valid).toBe(false);
  });

  it("'aws iam delete-user' rejected", () => {
    const r = validateRunbookSteps([
      S("operator_gate", "ack"),
      S("stage", "delete user", "aws iam delete-user --user-name svc-tmp"),
      S("audit", "x"),
    ]);
    expect(r.valid).toBe(false);
  });

  it("'terraform apply' in body rejected", () => {
    const r = validateRunbookSteps([
      S("operator_gate", "ack"),
      S("stage", "tf", "terraform apply -auto-approve"),
      S("audit", "x"),
    ]);
    expect(r.valid).toBe(false);
  });

  it("'auto-apply' in label warns (not blocks)", () => {
    const r = validateRunbookSteps([
      S("operator_gate", "ack"),
      S("stage", "auto-apply config", "stage config update"),
      S("audit", "x"),
    ]);
    expect(r.valid).toBe(true);
    expect(r.severity).toBe("warn");
    expect(r.warnings.some((w) => w.includes("auto-apply"))).toBe(true);
  });

  it("non-audit final step warns", () => {
    const r = validateRunbookSteps([
      S("stage", "stage"),
      S("operator_gate", "ack"),
      S("notify", "page"),
    ]);
    expect(r.valid).toBe(true);
    expect(r.warnings.some((w) => w.includes("audit"))).toBe(true);
  });
});
