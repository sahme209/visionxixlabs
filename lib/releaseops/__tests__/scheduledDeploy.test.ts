import { describe, expect, it } from "vitest";
import { isScheduledDeployDue, nextOpeningAfterRefusal } from "../scheduledDeploy";

// Saturday 2026-11-28 12:00 UTC; the window opens weekdays 22:00-02:00.
const now = new Date("2026-11-28T12:00:00Z");
const rule = { weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri"], utcWindows: [{ start: "22:00", end: "02:00" }], freezes: [] };

describe("deploy when the window opens", () => {
  it("finds the next opening after a window refusal", () => {
    expect(nextOpeningAfterRefusal("outside_change_window", rule, now)).toBe("2026-11-30T22:00:00.000Z");
  });
  it("waits out a freeze to the next opening", () => {
    const frozen = { ...rule, freezes: [{ startUtc: "2026-11-27T00:00:00Z", endUtc: "2026-12-02T00:00:00Z", reason: "Incident" }] };
    // Tuesday's 22:00-02:00 window is still running when the freeze ends at midnight, so it opens then.
    expect(nextOpeningAfterRefusal("deployment_freeze_active", frozen, now)).toBe("2026-12-02T00:00:00.000Z");
  });
  it("offers nothing for other refusals, unreadable rules or open windows", () => {
    expect(nextOpeningAfterRefusal("deployment_checks_blocking", rule, now)).toBeNull();
    expect(nextOpeningAfterRefusal("outside_change_window", { weekdays: "bad" }, now)).toBeNull();
    expect(nextOpeningAfterRefusal("outside_change_window", null, now)).toBeNull();
  });
  it("is due a few seconds after the opening, never before", () => {
    expect(isScheduledDeployDue("2026-11-30T22:00:00.000Z", new Date("2026-11-30T22:00:04Z"))).toBe(false);
    expect(isScheduledDeployDue("2026-11-30T22:00:00.000Z", new Date("2026-11-30T22:00:05Z"))).toBe(true);
    expect(isScheduledDeployDue("not a date", new Date())).toBe(false);
  });
});
