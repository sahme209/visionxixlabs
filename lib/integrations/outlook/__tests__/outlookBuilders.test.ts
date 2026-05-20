/**
 * Vitest unit tests for the pure Outlook helper (war-room builder).
 */

import { describe, it, expect } from "vitest";
import { buildIncidentWarRoom } from "../outlookAdapter";

describe("buildIncidentWarRoom", () => {
  it("default duration 30 mins → endIso = startIso + 30m", () => {
    const r = buildIncidentWarRoom({
      service: "checkout", severity: "high",
      startIso: "2026-05-20T15:00:00.000Z",
      attendees: ["a@example.com"],
    });
    expect(r.endIso).toBe("2026-05-20T15:30:00.000Z");
  });

  it("custom duration honored within [15, 240] minutes", () => {
    const r = buildIncidentWarRoom({
      service: "checkout", severity: "high",
      startIso: "2026-05-20T15:00:00.000Z",
      durationMins: 60,
      attendees: [],
    });
    expect(r.endIso).toBe("2026-05-20T16:00:00.000Z");
  });

  it("duration clamped >= 15 mins", () => {
    const r = buildIncidentWarRoom({
      service: "x", severity: "low",
      startIso: "2026-05-20T15:00:00.000Z",
      durationMins: 5, attendees: [],
    });
    expect(r.endIso).toBe("2026-05-20T15:15:00.000Z");
  });

  it("duration clamped <= 240 mins", () => {
    const r = buildIncidentWarRoom({
      service: "x", severity: "low",
      startIso: "2026-05-20T15:00:00.000Z",
      durationMins: 9999, attendees: [],
    });
    expect(r.endIso).toBe("2026-05-20T19:00:00.000Z");
  });

  it("subject contains uppercase severity + service", () => {
    const r = buildIncidentWarRoom({
      service: "checkout-api", severity: "critical",
      startIso: "2026-05-20T15:00:00.000Z", attendees: [],
    });
    expect(r.subject).toContain("[CRITICAL]");
    expect(r.subject).toContain("checkout-api");
  });

  it("body reaffirms approval-only-no-execution", () => {
    const r = buildIncidentWarRoom({
      service: "x", severity: "medium",
      startIso: "2026-05-20T15:00:00.000Z", attendees: [],
    });
    expect(r.body.toLowerCase()).toContain("approval-only-no-execution");
  });

  it("onlineMeeting is always true (Teams meeting attached)", () => {
    const r = buildIncidentWarRoom({
      service: "x", severity: "medium",
      startIso: "2026-05-20T15:00:00.000Z", attendees: [],
    });
    expect(r.onlineMeeting).toBe(true);
  });
});
