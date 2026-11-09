import { describe, expect, it } from "vitest";
import { readinessBlockers, UNCOVERED_FAMILIES } from "../uncoveredFamilies";

describe("Governance readiness blockers", () => {
  it("lists every uncovered family once and never authorizes execution", () => {
    const r = readinessBlockers();
    expect(r.status).toBe("blocked");
    expect(r.executionAuthorized).toBe(false);
    expect(new Set(UNCOVERED_FAMILIES.map((f) => f.id)).size).toBe(UNCOVERED_FAMILIES.length);
    expect(UNCOVERED_FAMILIES.map((f) => f.id)).toEqual(["M02", "M03", "M04", "P01"]);
  });

  it("does not list families that already refuse when enrolled", () => {
    for (const covered of ["F01", "F02", "F15", "F16", "F17", "F18", "M01"]) expect(UNCOVERED_FAMILIES.some((f) => f.id === covered)).toBe(false);
  });
});
