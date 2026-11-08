import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AI_RATE_CARD, EFFORT_LEVEL_ESTIMATE, effortLevelCostRangeCents } from "../aiRateCard";

describe("per-level AI cost ranges", () => {
  it("matches the agent runtime's step limits", () => {
    const src = readFileSync(join(process.cwd(), "lib/axiom/agentRuntime/decisionLoop.ts"), "utf8");
    for (const l of EFFORT_LEVEL_ESTIMATE.levels) {
      expect(src).toMatch(new RegExp(`label: "${l.label}", maxDecisionIterations: ${l.maxSteps}`));
    }
  });

  it("uses one 1.5x for every level, so cost grows only with steps", () => {
    expect(AI_RATE_CARD.marginMultiplier).toBe(1.5);
    const r = EFFORT_LEVEL_ESTIMATE.levels.map((l) => effortLevelCostRangeCents(l.label));
    expect(r.map((x) => x.lowCents)).toEqual([1, 1, 1]);
    expect(r.map((x) => x.highCents)).toEqual([31, 61, 91]);
  });

  it("refuses unknown levels", () => {
    expect(() => effortLevelCostRangeCents("Max" as never)).toThrow("effort_level_unknown");
  });
});
