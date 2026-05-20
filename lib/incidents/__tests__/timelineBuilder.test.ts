/**
 * Vitest unit tests for the pure incident timeline builder.
 */

import { describe, it, expect } from "vitest";
import { buildTimeline, type RawTimelineEvent } from "../timelineBuilder";

const EV = (ts: string, source: RawTimelineEvent["source"], summary: string, groupKey?: string): RawTimelineEvent =>
  ({ ts, source, summary, groupKey });

describe("timelineBuilder", () => {
  it("empty input → null window, no rows", () => {
    const r = buildTimeline([]);
    expect(r.windowStart).toBeNull();
    expect(r.windowEnd).toBeNull();
    expect(r.rows.length).toBe(0);
  });

  it("sorts events chronologically asc", () => {
    const r = buildTimeline([
      EV("2026-05-20T03:00:00.000Z", "agent_bus", "third"),
      EV("2026-05-20T01:00:00.000Z", "cloudtrail", "first"),
      EV("2026-05-20T02:00:00.000Z", "runbook", "second"),
    ]);
    expect(r.rows.map((row) => row.summary)).toEqual(["first", "second", "third"]);
    expect(r.windowStart).toBe("2026-05-20T01:00:00.000Z");
    expect(r.windowEnd).toBe("2026-05-20T03:00:00.000Z");
  });

  it("groups events by groupKey, sorted by count desc", () => {
    const r = buildTimeline([
      EV("2026-05-20T01:00:00.000Z", "agent_bus", "a", "thread-1"),
      EV("2026-05-20T02:00:00.000Z", "agent_bus", "b", "thread-1"),
      EV("2026-05-20T03:00:00.000Z", "agent_bus", "c", "thread-2"),
    ]);
    expect(r.groups[0]).toEqual({ groupKey: "thread-1", count: 2, firstSeen: "2026-05-20T01:00:00.000Z", lastSeen: "2026-05-20T02:00:00.000Z" });
    expect(r.groups[1].groupKey).toBe("thread-2");
  });

  it("truncates summary at 240 chars", () => {
    const long = "x".repeat(500);
    const r = buildTimeline([EV("2026-05-20T01:00:00.000Z", "manual", long)]);
    expect(r.rows[0].summary.length).toBe(240);
  });

  it("respects custom limit, keeps the last N", () => {
    const events: RawTimelineEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events.push(EV(`2026-05-20T0${i}:00:00.000Z`, "manual", `e${i}`));
    }
    const r = buildTimeline(events, { limit: 3 });
    expect(r.rows.length).toBe(3);
    expect(r.rows.map((row) => row.summary)).toEqual(["e7", "e8", "e9"]);
  });

  it("defaults severity to 'info' when not supplied", () => {
    const r = buildTimeline([EV("2026-05-20T01:00:00.000Z", "manual", "x")]);
    expect(r.rows[0].severity).toBe("info");
  });

  it("respects explicit severity", () => {
    const r = buildTimeline([{
      ts: "2026-05-20T01:00:00.000Z", source: "outbound", summary: "boom", severity: "critical",
    }]);
    expect(r.rows[0].severity).toBe("critical");
  });
});
