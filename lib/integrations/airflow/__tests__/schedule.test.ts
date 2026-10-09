import { describe, expect, it } from "vitest";
import { isValidUtcCron, nextCronOccurrence } from "../schedule";

describe("Airflow UTC schedules", () => {
  it("accepts the supported safe five-field syntax", () => {
    expect(isValidUtcCron("0 6 * * *")).toBe(true);
    expect(isValidUtcCron("*/5 * * * *")).toBe(true);
    expect(isValidUtcCron("0 6 * * 1")).toBe(true);
    expect(isValidUtcCron("0 25 * * *")).toBe(false);
    expect(isValidUtcCron("@daily")).toBe(false);
    expect(isValidUtcCron("0 6 * * 1-5")).toBe(false);
  });

  it("computes the next UTC occurrence strictly after the input", () => {
    expect(nextCronOccurrence("0 6 * * *", new Date("2026-10-08T06:00:00.000Z")).toISOString()).toBe("2026-10-09T06:00:00.000Z");
    expect(nextCronOccurrence("*/15 * * * *", new Date("2026-10-08T06:07:45.000Z")).toISOString()).toBe("2026-10-08T06:15:00.000Z");
  });
});
