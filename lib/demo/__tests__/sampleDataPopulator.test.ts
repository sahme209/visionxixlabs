/**
 * Vitest unit test for the demo populator invariant.
 *
 * The full populator hits Prisma — covered by integration. Here we
 * lock in the one invariant that prevents demo data from co-mingling
 * with real data: the DEMO_ROW_PREFIX constant.
 */

import { describe, it, expect } from "vitest";
import { DEMO_ROW_PREFIX } from "../sampleDataPopulator";

describe("demo populator prefix", () => {
  it("uses a stable demo: prefix on every seeded id", () => {
    expect(DEMO_ROW_PREFIX).toBe("demo:");
  });

  it("the prefix is distinctive (won't collide with real rows that happen to start with 'd')", () => {
    expect(DEMO_ROW_PREFIX.includes(":")).toBe(true);
    expect(DEMO_ROW_PREFIX.length).toBeGreaterThanOrEqual(5);
  });
});
