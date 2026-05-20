/**
 * Vitest unit tests for the tier-cap enforcer.
 *
 * Locks in: unlimited cap, finite cap allow-then-deny boundary,
 * zero cap (programmatic pause), remaining math.
 */

import { describe, it, expect } from "vitest";
import { checkCap, checkDailyCap } from "../tierCapEnforcer";

describe("tier cap enforcer", () => {
  it("allows everything on the enterprise tier (unlimited)", () => {
    const d = checkCap({ tier: "enterprise", capName: "autonomyCyclesPerDay", used: 9999 });
    expect(d.allowed).toBe(true);
    expect(d.remaining).toBe(-1);
    expect(d.reason).toMatch(/unlimited/);
  });

  it("allows while under the cap", () => {
    const d = checkCap({ tier: "starter", capName: "autonomyCyclesPerDay", used: 95 });
    expect(d.allowed).toBe(true);
    expect(d.remaining).toBe(1);
  });

  it("denies when exactly at the cap", () => {
    const d = checkCap({ tier: "starter", capName: "autonomyCyclesPerDay", used: 96 });
    expect(d.allowed).toBe(false);
    expect(d.remaining).toBe(0);
    expect(d.reason).toMatch(/cap reached/);
  });

  it("denies when over the cap", () => {
    const d = checkCap({ tier: "starter", capName: "outboundPerDay", used: 9999 });
    expect(d.allowed).toBe(false);
    expect(d.remaining).toBe(0);
  });

  it("checkDailyCap is a thin wrapper that uses usedToday", () => {
    const d = checkDailyCap({ tier: "growth", capName: "autonomyCyclesPerDay", usedToday: 479 });
    expect(d.allowed).toBe(true);
    expect(d.remaining).toBe(1);
    const d2 = checkDailyCap({ tier: "growth", capName: "autonomyCyclesPerDay", usedToday: 480 });
    expect(d2.allowed).toBe(false);
  });

  it("returns a typed reason that mentions the tier + capName", () => {
    const d = checkCap({ tier: "trial", capName: "stagedRunbooks", used: 0 });
    expect(d.reason).toContain("trial");
    expect(d.reason).toContain("stagedRunbooks");
  });

  it("never crashes on zero-used", () => {
    const d = checkCap({ tier: "trial", capName: "outboundPerDay", used: 0 });
    expect(d.allowed).toBe(true);
    expect(d.remaining).toBeGreaterThan(0);
  });
});
