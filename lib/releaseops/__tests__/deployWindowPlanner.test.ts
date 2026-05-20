/**
 * Vitest unit tests for the pure deploy-window planner.
 */

import { describe, it, expect } from "vitest";
import { evaluateDeployWindows, type DeployWindow } from "../deployWindowPlanner";

const BUSINESS_DAYS: DeployWindow = {
  label: "Mon-Fri 09:00-17:00 UTC",
  daysOfWeek: [1, 2, 3, 4, 5],
  startUtc: "09:00",
  endUtc:   "17:00",
};

describe("deployWindowPlanner", () => {
  it("inside window → isOpen=true", () => {
    // 2026-05-20 is a Wednesday.
    const r = evaluateDeployWindows({
      windows: [BUSINESS_DAYS],
      atIso: "2026-05-20T12:00:00.000Z",
    });
    expect(r.isOpen).toBe(true);
    expect(r.openWindows.length).toBe(1);
  });

  it("before window start same day → next open later today", () => {
    const r = evaluateDeployWindows({
      windows: [BUSINESS_DAYS],
      atIso: "2026-05-20T07:00:00.000Z",
    });
    expect(r.isOpen).toBe(false);
    expect(r.nextOpenAt).toBe("2026-05-20T09:00:00.000Z");
  });

  it("after window end same day → next open next Monday-Friday", () => {
    const r = evaluateDeployWindows({
      windows: [BUSINESS_DAYS],
      atIso: "2026-05-20T18:00:00.000Z",
    });
    expect(r.isOpen).toBe(false);
    // Next business day starts at Thursday 09:00 (next-day after Wed 18:00).
    expect(r.nextOpenAt).toBe("2026-05-21T09:00:00.000Z");
  });

  it("weekend → next open Monday 09:00", () => {
    // 2026-05-23 is a Saturday.
    const r = evaluateDeployWindows({
      windows: [BUSINESS_DAYS],
      atIso: "2026-05-23T12:00:00.000Z",
    });
    expect(r.isOpen).toBe(false);
    expect(r.nextOpenAt).toBe("2026-05-25T09:00:00.000Z");
  });

  it("multiple windows: returns all open", () => {
    const second: DeployWindow = {
      label: "weekend morning",
      daysOfWeek: [0, 6],
      startUtc: "08:00",
      endUtc: "11:00",
    };
    const r = evaluateDeployWindows({
      windows: [BUSINESS_DAYS, second],
      atIso: "2026-05-23T10:00:00.000Z", // Saturday
    });
    expect(r.isOpen).toBe(true);
    expect(r.openWindows[0].label).toBe("weekend morning");
  });

  it("inverted window (end <= start) treated as closed", () => {
    const inverted: DeployWindow = {
      label: "broken",
      daysOfWeek: [3],
      startUtc: "18:00",
      endUtc: "09:00",
    };
    const r = evaluateDeployWindows({
      windows: [inverted],
      atIso: "2026-05-20T12:00:00.000Z",
    });
    expect(r.isOpen).toBe(false);
  });

  it("empty windows → not open, no next", () => {
    const r = evaluateDeployWindows({ windows: [], atIso: "2026-05-20T12:00:00.000Z" });
    expect(r.isOpen).toBe(false);
    expect(r.nextOpenAt).toBeNull();
  });

  it("invalid HH:MM → window treated as closed", () => {
    const bad: DeployWindow = { label: "x", daysOfWeek: [3], startUtc: "abc", endUtc: "def" };
    const r = evaluateDeployWindows({ windows: [bad], atIso: "2026-05-20T12:00:00.000Z" });
    expect(r.isOpen).toBe(false);
  });
});
