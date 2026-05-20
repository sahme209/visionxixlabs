/**
 * Vitest unit tests for the pure helpers in usageCounterStore.
 *
 * The full read/increment paths hit Prisma — covered by integration.
 * Here we lock in the UTC dateKey shape since it's the rollover
 * boundary every cap depends on.
 */

import { describe, it, expect } from "vitest";
import { todayUtcKey } from "../usageCounterStore";

describe("usage counter UTC dateKey", () => {
  it("returns YYYY-MM-DD shape", () => {
    const k = todayUtcKey();
    expect(k).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("uses UTC, not local time", () => {
    // Pick a date that's definitively in a non-UTC timezone's
    // previous/next day. 2026-05-20T23:59:59Z is always 2026-05-20
    // in UTC regardless of where the server runs.
    const k = todayUtcKey(new Date("2026-05-20T23:59:59.000Z"));
    expect(k).toBe("2026-05-20");
  });

  it("rolls over at UTC midnight", () => {
    const before = todayUtcKey(new Date("2026-05-20T23:59:59.999Z"));
    const after = todayUtcKey(new Date("2026-05-21T00:00:00.000Z"));
    expect(before).toBe("2026-05-20");
    expect(after).toBe("2026-05-21");
  });
});
