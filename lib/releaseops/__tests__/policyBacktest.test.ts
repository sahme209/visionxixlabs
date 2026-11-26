import { describe, expect, it } from "vitest";
import { backtestPolicy } from "../policyBacktest";

const rule = (key: string, over: Record<string, unknown> = {}) => ({ key, label: key, severity: "high" as const, blocking: true, exceptionAllowed: false, approverRole: null, evidenceRequired: false, enabled: true, description: null, ...over });
const current = [rule("tests-pass"), rule("change-ticket", { blocking: false }), rule("sbom", { exceptionAllowed: true })];
const violations = [
  { releaseId: "r1", ruleKey: "tests-pass", exceptionGranted: false },
  { releaseId: "r2", ruleKey: "change-ticket", exceptionGranted: false },
  { releaseId: "r3", ruleKey: "sbom", exceptionGranted: true },
  { releaseId: "r4", ruleKey: "sbom", exceptionGranted: false },
];
const doc = (rules: ReturnType<typeof rule>[]) => ({ kind: "v19.policy" as const, version: 1 as const, rules });

describe("policy backtest", () => {
  it("reports no change for the current rules", () => {
    const r = backtestPolicy(current, doc(current), violations, ["r1", "r2", "r3", "r4", "r5"]);
    expect(r).toMatchObject({ releases: 5, blockedNow: 2, blockedProposed: 2, newlyBlocked: [], newlyUnblocked: [], byRule: [], rulesWithoutHistory: [] });
  });
  it("shows releases a stricter policy would have blocked and a looser one would have let through", () => {
    const stricter = backtestPolicy(current, doc([rule("tests-pass"), rule("change-ticket"), rule("sbom", { exceptionAllowed: true })]), violations, ["r1", "r2", "r3", "r4"]);
    expect(stricter).toMatchObject({ blockedNow: 2, blockedProposed: 3, newlyBlocked: ["r2"], newlyUnblocked: [], byRule: [{ key: "change-ticket", blockedNow: 0, blockedProposed: 1 }] });
    const looser = backtestPolicy(current, doc([rule("tests-pass", { enabled: false }), rule("change-ticket", { blocking: false }), rule("sbom", { exceptionAllowed: true })]), violations, ["r1"]);
    expect(looser).toMatchObject({ newlyUnblocked: ["r1"], byRule: [{ key: "tests-pass", blockedNow: 1, blockedProposed: 0 }] });
  });
  it("counts an exception only where the rule allows exceptions, and flags new rules as having no history", () => {
    const noExceptions = backtestPolicy(current, doc([rule("tests-pass"), rule("change-ticket", { blocking: false }), rule("sbom"), rule("new-rule")]), violations, []);
    expect(noExceptions.newlyBlocked).toEqual(["r3"]);
    expect(noExceptions.rulesWithoutHistory).toEqual(["new-rule"]);
  });
});
