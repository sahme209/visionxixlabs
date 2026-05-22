import { describe, it, expect } from "vitest";
import { whichAlertsToFire } from "../whichAlertsToFire";

describe("whichAlertsToFire", () => {
  it("0% usage → no alerts", () => {
    expect(whichAlertsToFire({ currentRatio: 0, alreadyFired: [] })).toEqual([]);
  });

  it("50% usage → no alerts (below 70 threshold)", () => {
    expect(whichAlertsToFire({ currentRatio: 0.5, alreadyFired: [] })).toEqual([]);
  });

  it("69% usage → no alerts (just below 70)", () => {
    expect(whichAlertsToFire({ currentRatio: 0.69, alreadyFired: [] })).toEqual([]);
  });

  it("70% usage exactly → fires 70", () => {
    expect(whichAlertsToFire({ currentRatio: 0.70, alreadyFired: [] })).toEqual([70]);
  });

  it("85% usage → fires 70 only (90 not yet)", () => {
    expect(whichAlertsToFire({ currentRatio: 0.85, alreadyFired: [] })).toEqual([70]);
  });

  it("90% usage exactly → fires 70 AND 90 (skipped ahead)", () => {
    expect(whichAlertsToFire({ currentRatio: 0.90, alreadyFired: [] })).toEqual([70, 90]);
  });

  it("100% usage exactly → fires 70, 90, AND 100", () => {
    expect(whichAlertsToFire({ currentRatio: 1.0, alreadyFired: [] })).toEqual([70, 90, 100]);
  });

  it("150% usage (overage plan) → fires 70, 90, 100", () => {
    expect(whichAlertsToFire({ currentRatio: 1.5, alreadyFired: [] })).toEqual([70, 90, 100]);
  });

  it("already-fired 70: 75% → no new alerts", () => {
    expect(whichAlertsToFire({ currentRatio: 0.75, alreadyFired: [70] })).toEqual([]);
  });

  it("already-fired 70: 92% → only 90 fires now", () => {
    expect(whichAlertsToFire({ currentRatio: 0.92, alreadyFired: [70] })).toEqual([90]);
  });

  it("already-fired 70, 90: 100% → only 100 fires", () => {
    expect(whichAlertsToFire({ currentRatio: 1.0, alreadyFired: [70, 90] })).toEqual([100]);
  });

  it("already-fired all three: no new alerts even at 200%", () => {
    expect(whichAlertsToFire({ currentRatio: 2.0, alreadyFired: [70, 90, 100] })).toEqual([]);
  });

  it("negative ratio (defensive) → no alerts", () => {
    expect(whichAlertsToFire({ currentRatio: -0.5, alreadyFired: [] })).toEqual([]);
  });

  it("only 90 has fired (gap): 75% → 70 still fires (we don't skip lower)", () => {
    // Defensive — if for some reason 90 fired before 70 (data corruption,
    // backfill order, etc.), running again at 75% still emits 70.
    expect(whichAlertsToFire({ currentRatio: 0.75, alreadyFired: [90] })).toEqual([70]);
  });

  it("returns sorted ascending (70 before 90 before 100)", () => {
    const r = whichAlertsToFire({ currentRatio: 1.5, alreadyFired: [] });
    expect(r).toEqual([70, 90, 100]);
  });
});
