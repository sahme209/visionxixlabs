import { describe, expect, it } from "vitest";
import { evaluateChangeWindow, parseChangeWindowRule } from "../environmentChangeWindow";

const at = (iso: string) => new Date(iso);
// 2026-11-26 is a Thursday.
describe("environment change windows", () => {
  it("treats a missing or empty rule as unrestricted and refuses malformed rules", () => {
    expect(parseChangeWindowRule(null)).toEqual({ kind: "none" });
    expect(parseChangeWindowRule({})).toEqual({ kind: "none" });
    expect(evaluateChangeWindow(parseChangeWindowRule(null), at("2026-11-26T12:00:00Z"))).toEqual({ open: true, reason: "no_rule", closesAt: null });
    for (const bad of [[], "x", { weekdays: ["Funday"], utcWindows: [{ start: "01:00", end: "02:00" }] }, { utcWindows: [{ start: "25:00", end: "02:00" }] }, { freezes: [{ startUtc: "2026-12-02", endUtc: "2026-12-01", reason: "x" }] }, { freezes: [{ startUtc: "2026-12-01", endUtc: "2026-12-02" }] }]) {
      expect(parseChangeWindowRule(bad).kind).toBe("unreadable");
    }
  });
  it("opens inside a weekday window and reports when it closes", () => {
    const rule = parseChangeWindowRule({ weekdays: ["Thu"], utcWindows: [{ start: "10:00", end: "14:00" }] });
    expect(evaluateChangeWindow(rule, at("2026-11-26T11:00:00Z"))).toEqual({ open: true, reason: "inside_window", closesAt: "2026-11-26T14:00:00.000Z" });
    expect(evaluateChangeWindow(rule, at("2026-11-26T15:00:00Z"))).toEqual({ open: false, reason: "outside_window", nextOpen: { startUtc: "2026-12-03T10:00:00.000Z", endUtc: "2026-12-03T14:00:00.000Z" } });
  });
  it("handles windows that cross midnight from the day they start", () => {
    const rule = parseChangeWindowRule({ weekdays: ["Wed"], utcWindows: [{ start: "22:00", end: "06:00" }] });
    expect(evaluateChangeWindow(rule, at("2026-11-26T03:00:00Z"))).toMatchObject({ open: true, closesAt: "2026-11-26T06:00:00.000Z" });
    expect(evaluateChangeWindow(rule, at("2026-11-26T07:00:00Z"))).toMatchObject({ open: false, nextOpen: { startUtc: "2026-12-02T22:00:00.000Z" } });
  });
  it("lets a freeze win over a window and finds the next open time after it", () => {
    const rule = parseChangeWindowRule({ utcWindows: [{ start: "09:00", end: "17:00" }], freezes: [{ startUtc: "2026-11-26T00:00:00Z", endUtc: "2026-11-27T12:00:00Z", reason: "Thanksgiving freeze" }] });
    expect(evaluateChangeWindow(rule, at("2026-11-26T10:00:00Z"))).toEqual({ open: false, reason: "freeze", freezeReason: "Thanksgiving freeze", freezeEndsAt: "2026-11-27T12:00:00.000Z", nextOpen: { startUtc: "2026-11-27T12:00:00.000Z", endUtc: "2026-11-27T17:00:00.000Z" } });
    expect(evaluateChangeWindow(rule, at("2026-11-25T16:00:00Z"))).toEqual({ open: true, reason: "inside_window", closesAt: "2026-11-25T17:00:00.000Z" });
  });
  it("supports freezes without windows", () => {
    const rule = parseChangeWindowRule({ freezes: [{ startUtc: "2026-12-20T00:00:00Z", endUtc: "2027-01-03T00:00:00Z", reason: "Holiday freeze" }] });
    expect(evaluateChangeWindow(rule, at("2026-12-01T00:00:00Z"))).toEqual({ open: true, reason: "inside_window", closesAt: "2026-12-20T00:00:00.000Z" });
    expect(evaluateChangeWindow(rule, at("2026-12-25T00:00:00Z"))).toMatchObject({ open: false, reason: "freeze", freezeEndsAt: "2027-01-03T00:00:00.000Z", nextOpen: { startUtc: "2027-01-03T00:00:00.000Z", endUtc: null } });
  });
});

import { canonicalJson, formToRule, ruleToForm } from "../environmentChangeWindow";
describe("change window form", () => {
  it("round-trips a rule through the editable text form", () => {
    const form = { weekdays: ["Mon", "Tue"] as const, windowsText: "09:00-17:00, 22:00 - 02:00", freezesText: "2026-12-20 to 2027-01-02: Holiday freeze" };
    const r = formToRule({ ...form, weekdays: [...form.weekdays] });
    expect(r).toEqual({ ok: true, rule: { weekdays: ["Mon", "Tue"], utcWindows: [{ start: "09:00", end: "17:00" }, { start: "22:00", end: "02:00" }], freezes: [{ startUtc: "2026-12-20T00:00:00.000Z", endUtc: "2027-01-02T00:00:00.000Z", reason: "Holiday freeze" }] } });
    if (r.ok) expect(ruleToForm(r.rule)).toEqual({ weekdays: ["Mon", "Tue"], windowsText: "09:00-17:00, 22:00-02:00", freezesText: "2026-12-20T00:00Z to 2027-01-02T00:00Z: Holiday freeze" });
    if (r.ok) expect(formToRule(ruleToForm(r.rule))).toEqual(r);
  });
  it("returns null for an empty form and explains bad input", () => {
    expect(formToRule({ weekdays: ["Mon"], windowsText: "", freezesText: "" })).toEqual({ ok: true, rule: null });
    expect(formToRule({ weekdays: ["Mon"], windowsText: "9-5", freezesText: "" })).toMatchObject({ ok: false });
    expect(formToRule({ weekdays: ["Mon"], windowsText: "", freezesText: "soon" })).toMatchObject({ ok: false });
    expect(formToRule({ weekdays: [], windowsText: "09:00-10:00", freezesText: "" })).toMatchObject({ ok: false });
  });
  it("compares stored JSON independent of key order", () => {
    expect(canonicalJson({ b: 1, a: [{ y: 2, x: 1 }] })).toBe(canonicalJson({ a: [{ x: 1, y: 2 }], b: 1 }));
    expect(canonicalJson(undefined)).toBe("null");
  });
});
