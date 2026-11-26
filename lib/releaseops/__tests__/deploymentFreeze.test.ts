import { describe, expect, it } from "vitest";
import { activeFreezes, addFreeze, endFreezeEarly } from "../deploymentFreeze";
import { evaluateChangeWindow, parseChangeWindowRule } from "../environmentChangeWindow";

const now = new Date("2026-11-27T12:00:00Z");
const f = (reason: string, s: string, e: string) => ({ startUtc: s, endUtc: e, reason });
const window = { weekdays: ["Tue"], utcWindows: [{ start: "09:00", end: "17:00" }], freezes: [] };

describe("deployment freeze", () => {
  it("adds a freeze to no rule and blocks deployments now", () => {
    const r = addFreeze(null, f("Incident 42", "2026-11-27T12:00:00.000Z", "2026-11-27T16:00:00.000Z"), now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rule.utcWindows).toEqual([]);
    const d = evaluateChangeWindow(parseChangeWindowRule(r.rule), now);
    expect(d).toMatchObject({ open: false, reason: "freeze", freezeReason: "Incident 42" });
  });
  it("keeps windows and active freezes, drops expired ones, refuses past 50", () => {
    const stored = { ...window, freezes: [f("old", "2026-11-01T00:00:00Z", "2026-11-02T00:00:00Z"), f("holiday", "2026-12-20T00:00:00Z", "2027-01-03T00:00:00Z")] };
    const r = addFreeze(stored, f("Incident", "2026-11-27T12:00:00.000Z", "2026-11-28T12:00:00.000Z"), now);
    expect(r.ok && r.rule.utcWindows).toEqual(window.utcWindows);
    expect(r.ok && r.rule.freezes.map((x) => x.reason)).toEqual(["holiday", "Incident"]);
    const full = { ...window, freezes: Array.from({ length: 50 }, (_, i) => f(`r${i}`, "2026-12-01T00:00:00Z", "2026-12-02T00:00:00Z")) };
    expect(addFreeze(full, f("x", "2026-11-27T12:00:00Z", "2026-11-28T00:00:00Z"), now)).toEqual({ ok: false, error: "too_many_freezes" });
    expect(addFreeze({ weekdays: ["Funday"] }, f("x", "2026-11-27T12:00:00Z", "2026-11-28T00:00:00Z"), now)).toEqual({ ok: false, error: "rule_unreadable" });
  });
  it("ends only active freezes with exactly that reason and leaves everything else", () => {
    const stored = { ...window, freezes: [f("Incident", "2026-11-27T10:00:00Z", "2026-11-28T10:00:00Z"), f("Other", "2026-11-27T10:00:00Z", "2026-11-28T10:00:00Z"), f("Incident", "2026-12-01T00:00:00Z", "2026-12-02T00:00:00Z")] };
    const r = endFreezeEarly(stored, "Incident", now);
    expect(r.ok && r.ended).toBe(2);
    expect(r.ok && r.rule?.freezes).toEqual([{ startUtc: "2026-11-27T10:00:00.000Z", endUtc: now.toISOString(), reason: "Incident" }, { startUtc: "2026-11-27T10:00:00.000Z", endUtc: "2026-11-28T10:00:00.000Z", reason: "Other" }]);
    expect(r.ok && r.rule?.utcWindows).toEqual(window.utcWindows);
  });
  it("clears the rule when a freeze-only rule has nothing left, and reports no match", () => {
    const only = { freezes: [f("Incident", "2026-11-27T12:00:00Z", "2026-11-28T00:00:00Z")] };
    expect(endFreezeEarly(only, "Incident", now)).toEqual({ ok: true, rule: null, ended: 1 });
    expect(endFreezeEarly(only, "Nope", now)).toMatchObject({ ok: true, ended: 0 });
    expect(endFreezeEarly(null, "Incident", now)).toEqual({ ok: true, rule: null, ended: 0 });
  });
  it("groups active freezes across environments", () => {
    const rule = { freezes: [f("Incident", "2026-11-27T10:00:00Z", "2026-11-28T10:00:00Z")] };
    const out = activeFreezes([
      { id: "1", name: "Prod EU", tier: "prod", changeWindowRuleJson: rule },
      { id: "2", name: "Prod US", tier: "prod", changeWindowRuleJson: rule },
      { id: "3", name: "Dev", tier: "dev", changeWindowRuleJson: null },
      { id: "4", name: "Broken", tier: "dev", changeWindowRuleJson: { weekdays: [] } },
    ], now);
    expect(out).toEqual({ freezes: [{ reason: "Incident", until: "2026-11-28T10:00:00.000Z", environments: ["Prod EU", "Prod US"] }], unreadable: ["Broken"] });
  });
});
