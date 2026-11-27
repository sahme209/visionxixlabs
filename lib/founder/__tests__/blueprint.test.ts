import { describe, expect, it } from "vitest";
import { connectorPath, departmentCost, layoutBlueprint, stepCost, validateBlueprint } from "../blueprint";
import { DEFAULT_BLUEPRINT } from "../defaultBlueprint";

describe("founder blueprint", () => {
  it("the default blueprint is valid and covers every department", () => {
    const r = validateBlueprint(DEFAULT_BLUEPRINT);
    if (!r.ok) throw new Error(r.errors.join("; "));
    for (const d of DEFAULT_BLUEPRINT.departments) expect(DEFAULT_BLUEPRINT.steps.some((s) => s.departmentId === d.id)).toBe(true);
  });
  it("catches duplicate ids, unknown departments, overlapping cells and broken links", () => {
    const b = structuredClone(DEFAULT_BLUEPRINT);
    b.steps.push({ ...b.steps[0] });
    b.steps.push({ ...b.steps[1], id: "ghost", departmentId: "nowhere" });
    b.steps.push({ ...b.steps[1], id: "overlap" });
    b.links.push({ from: "gtm-position", to: "missing", label: "" });
    const r = validateBlueprint(b);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join("\n")).toMatch(/step "gtm-position" appears twice/);
      expect(r.errors.join("\n")).toMatch(/unknown department "nowhere"/);
      expect(r.errors.join("\n")).toMatch(/"overlap" overlaps another step/);
      expect(r.errors.join("\n")).toMatch(/refers to a missing step/);
    }
  });
  it("computes step and department cost like the reel's process cost panel", () => {
    const c = stepCost({ cost: { minutesPerRun: 150, runsPerMonth: 20, hourlyRate: 40 }, tools: [{ name: "Loom", monthlyCost: 15, oneTimeCost: 0, active: true }, { name: "Old", monthlyCost: 99, oneTimeCost: 1900, active: false }] });
    expect(c).toEqual({ hoursPerRun: 2.5, costPerRun: 100, hoursPerMonth: 50, monthlyLabor: 2000, annualLabor: 24000, monthlyTools: 15, oneTimeTools: 1900, monthlyTotal: 2015 });
    const b = structuredClone(DEFAULT_BLUEPRINT);
    b.steps.find((s) => s.id === "fin-costs")!.cost = { minutesPerRun: 60, runsPerMonth: 1, hourlyRate: 100 };
    expect(departmentCost(b, "finance")).toMatchObject({ steps: 3, live: 1, monthlyLabor: 100, monthlyTools: 10, monthlyTotal: 110 });
  });
  it("lays departments out in rows without overlapping cards", () => {
    const l = layoutBlueprint(DEFAULT_BLUEPRINT);
    expect(l.regions).toHaveLength(DEFAULT_BLUEPRINT.departments.length);
    const boxes = [...l.steps.values()];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true);
    }
    expect(connectorPath({ stepId: "a", x: 0, y: 0, w: 10, h: 10 }, { stepId: "b", x: 0, y: 40, w: 10, h: 10 })).toBe("M 5 10 V 25 H 5 V 40");
  });
});
