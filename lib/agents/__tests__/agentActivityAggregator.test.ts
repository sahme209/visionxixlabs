/**
 * Vitest unit tests for the pure activity aggregator.
 */

import { describe, it, expect } from "vitest";
import { buildActivityReport, type RawBusRow } from "../agentActivityAggregator";
import { AGENT_MESSAGE_KINDS, AGENT_ROLES } from "../agentBusModel";

const ROW = (sender: string, kind: string, createdAt: string): RawBusRow => ({ sender, kind, createdAt });

describe("agent activity aggregator", () => {
  it("empty input → zero totals + full role/kind matrix", () => {
    const r = buildActivityReport([]);
    expect(r.totalMessages).toBe(0);
    expect(r.windowStart).toBeNull();
    expect(r.windowEnd).toBeNull();
    expect(r.agents.length).toBe(AGENT_ROLES.length);
    expect(r.kinds.length).toBe(AGENT_MESSAGE_KINDS.length);
    expect(r.agents.every((a) => a.sent === 0 && a.lastActiveAt === null)).toBe(true);
    expect(r.kinds.every((k) => k.count === 0)).toBe(true);
  });

  it("counts per agent + per kind", () => {
    const rows = [
      ROW("detector", "broadcast_signal", "2026-05-20T01:00:00.000Z"),
      ROW("detector", "broadcast_signal", "2026-05-20T02:00:00.000Z"),
      ROW("reasoner", "hypothesis_proposed", "2026-05-20T03:00:00.000Z"),
      ROW("council", "council_consensus", "2026-05-20T04:00:00.000Z"),
    ];
    const r = buildActivityReport(rows);
    expect(r.totalMessages).toBe(4);
    expect(r.agents.find((a) => a.agent === "detector")!.sent).toBe(2);
    expect(r.agents.find((a) => a.agent === "reasoner")!.sent).toBe(1);
    expect(r.agents.find((a) => a.agent === "council")!.sent).toBe(1);
    expect(r.kinds.find((k) => k.kind === "broadcast_signal")!.count).toBe(2);
    expect(r.kinds.find((k) => k.kind === "council_consensus")!.count).toBe(1);
  });

  it("tracks earliest and latest publishedAt across the window", () => {
    const rows = [
      ROW("detector", "broadcast_signal", "2026-05-20T02:00:00.000Z"),
      ROW("reasoner", "hypothesis_proposed", "2026-05-20T01:00:00.000Z"),
      ROW("council", "council_consensus", "2026-05-20T05:00:00.000Z"),
    ];
    const r = buildActivityReport(rows);
    expect(r.windowStart).toBe("2026-05-20T01:00:00.000Z");
    expect(r.windowEnd).toBe("2026-05-20T05:00:00.000Z");
  });

  it("lastActiveAt is the agent's most recent timestamp", () => {
    const rows = [
      ROW("detector", "broadcast_signal", "2026-05-20T01:00:00.000Z"),
      ROW("detector", "broadcast_signal", "2026-05-20T09:00:00.000Z"),
      ROW("detector", "broadcast_signal", "2026-05-20T03:00:00.000Z"),
    ];
    const r = buildActivityReport(rows);
    expect(r.agents.find((a) => a.agent === "detector")!.lastActiveAt).toBe("2026-05-20T09:00:00.000Z");
  });

  it("kindBreakdown groups by sender + kind", () => {
    const rows = [
      ROW("reasoner", "hypothesis_proposed", "2026-05-20T01:00:00.000Z"),
      ROW("reasoner", "hypothesis_proposed", "2026-05-20T02:00:00.000Z"),
      ROW("reasoner", "freeform_note", "2026-05-20T03:00:00.000Z"),
    ];
    const r = buildActivityReport(rows);
    const reasoner = r.agents.find((a) => a.agent === "reasoner")!;
    expect(reasoner.sent).toBe(3);
    expect(reasoner.kindBreakdown.hypothesis_proposed).toBe(2);
    expect(reasoner.kindBreakdown.freeform_note).toBe(1);
  });

  it("ignores rows with unknown sender or kind", () => {
    const rows = [
      ROW("not_a_role", "broadcast_signal", "2026-05-20T01:00:00.000Z"),
      ROW("detector", "not_a_kind", "2026-05-20T02:00:00.000Z"),
      ROW("detector", "broadcast_signal", "2026-05-20T03:00:00.000Z"),
    ];
    const r = buildActivityReport(rows);
    expect(r.totalMessages).toBe(1);
    expect(r.agents.find((a) => a.agent === "detector")!.sent).toBe(1);
  });

  it("accepts Date or ISO string for createdAt", () => {
    const rows: RawBusRow[] = [
      { sender: "detector", kind: "broadcast_signal", createdAt: new Date("2026-05-20T01:00:00.000Z") },
      { sender: "detector", kind: "broadcast_signal", createdAt: "2026-05-20T02:00:00.000Z" },
    ];
    const r = buildActivityReport(rows);
    expect(r.totalMessages).toBe(2);
    expect(r.windowEnd).toBe("2026-05-20T02:00:00.000Z");
  });
});
