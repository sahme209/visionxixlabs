/**
 * Vitest unit tests for the pure auto-archive planner.
 */

import { describe, it, expect } from "vitest";
import { planAutoArchive, type ArchiveCandidate } from "../autoArchivePlanner";

const REC = (id: string, status: ArchiveCandidate["status"], updatedDaysAgo: number, kind = "decision"): ArchiveCandidate => {
  const now = new Date("2026-05-20T00:00:00.000Z");
  const updatedAt = new Date(now.getTime() - updatedDaysAgo * 24 * 60 * 60 * 1000).toISOString();
  return { id, kind, status, createdAt: updatedAt, updatedAt };
};

const NOW = "2026-05-20T00:00:00.000Z";

describe("autoArchivePlanner", () => {
  it("empty input → zero eligible", () => {
    const r = planAutoArchive({ records: [], retentionDays: 30, now: NOW });
    expect(r.totalConsidered).toBe(0);
    expect(r.eligibleCount).toBe(0);
  });

  it("flags eligible when terminal and old enough", () => {
    const r = planAutoArchive({
      records: [REC("a", "decided", 60)],
      retentionDays: 30, now: NOW,
    });
    expect(r.eligibleCount).toBe(1);
    expect(r.rows[0].reason).toBe("eligible");
    expect(r.rows[0].ageDays).toBe(60);
  });

  it("flags too_recent when age < retention", () => {
    const r = planAutoArchive({
      records: [REC("a", "decided", 10)],
      retentionDays: 30, now: NOW,
    });
    expect(r.rows[0].reason).toBe("too_recent");
    expect(r.eligibleCount).toBe(0);
  });

  it("flags not_terminal for active records regardless of age", () => {
    const r = planAutoArchive({
      records: [REC("a", "active", 999)],
      retentionDays: 30, now: NOW,
    });
    expect(r.rows[0].reason).toBe("not_terminal");
  });

  it("flags already_archived", () => {
    const r = planAutoArchive({
      records: [REC("a", "archived", 999)],
      retentionDays: 30, now: NOW,
    });
    expect(r.rows[0].reason).toBe("already_archived");
  });

  it("respects custom terminalStatuses", () => {
    const r = planAutoArchive({
      records: [REC("a", "expired", 60), REC("b", "decided", 60)],
      retentionDays: 30, now: NOW,
      terminalStatuses: ["expired"], // 'decided' no longer counts as terminal
    });
    expect(r.rows.find((x) => x.id === "a")?.reason).toBe("eligible");
    expect(r.rows.find((x) => x.id === "b")?.reason).toBe("not_terminal");
  });

  it("groups eligible counts by kind, sorted by eligible desc", () => {
    const r = planAutoArchive({
      records: [
        REC("a", "decided", 60, "proposal"),
        REC("b", "decided", 60, "proposal"),
        REC("c", "decided", 60, "rationale"),
      ],
      retentionDays: 30, now: NOW,
    });
    expect(r.byKind[0]).toEqual({ kind: "proposal", eligible: 2, total: 2 });
    expect(r.byKind[1]).toEqual({ kind: "rationale", eligible: 1, total: 1 });
  });
});
