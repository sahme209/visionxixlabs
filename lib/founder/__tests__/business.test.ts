import { describe, expect, it } from "vitest";
import { changePct, dailySeries, funnel, marginPct, rankTopics, roadmapCandidates, topicKey, weeklyCounts, workspaceLabel } from "../business";

const NOW = new Date("2026-11-27T12:00:00Z");
describe("founder business shaping", () => {
  it("builds a daily series with every day present, oldest first", () => {
    const s = dailySeries([{ at: new Date("2026-11-27T01:00:00Z"), value: 5 }, { at: new Date("2026-11-27T20:00:00Z"), value: 2 }, { at: new Date("2026-11-25T10:00:00Z"), value: 3 }, { at: new Date("2026-10-01T00:00:00Z"), value: 99 }], 3, NOW);
    expect(s).toEqual([{ day: "2026-11-25", value: 3 }, { day: "2026-11-26", value: 0 }, { day: "2026-11-27", value: 7 }]);
  });
  it("counts per week", () => {
    const w = weeklyCounts([new Date("2026-11-26T00:00:00Z"), new Date("2026-11-25T00:00:00Z"), new Date("2026-11-10T00:00:00Z"), new Date("2026-01-01T00:00:00Z")], 4, NOW);
    expect(w.map((x) => x.count)).toEqual([0, 1, 0, 2]);
  });
  it("computes margin and change, or null when undefined", () => {
    expect(marginPct(1000, 400)).toBe(60); expect(marginPct(0, 400)).toBeNull(); expect(marginPct(100, 150)).toBe(-50);
    expect(changePct(150, 100)).toBe(50); expect(changePct(5, 0)).toBeNull();
  });
  it("groups similar questions and ranks repeated ones first", () => {
    expect(topicKey("How do I connect GitLab?")).toBe("connect gitlab");
    const t = rankTopics(["How do I connect GitLab?", "how do i connect gitlab", "Can I connect GitLab?", "Bitbucket pipelines?", "  ?? "]);
    expect(t[0]).toMatchObject({ topic: "connect gitlab", count: 3, example: "How do I connect GitLab?" });
    expect(t).toHaveLength(2);
  });
  it("shows a funnel as shares of the first step", () => {
    expect(funnel([{ label: "a", count: 4 }, { label: "b", count: 1 }]).steps.map((s) => s.pct)).toEqual([100, 25]);
    expect(funnel([{ label: "a", count: 0 }]).steps[0].pct).toBeNull();
  });
  it("labels workspaces without names", () => { expect(workspaceLabel("ws_b2096dbc5111b630")).toBe("Workspace …11b630"); });
  it("proposes roadmap items from repeated questions, negative pages and at-risk accounts", () => {
    const r = roadmapCandidates({ topUnanswered: [{ example: "How do I connect GitLab?", count: 3 }, { example: "once", count: 1 }], negativeByPage: [{ page: "/control/checks", count: 2 }], atRisk: [{ label: "Workspace …abc", reason: "Payment past due" }] });
    expect(r.map((x) => x.kind)).toEqual(["doc_gap", "fix_page", "follow_up"]);
    expect(r[0].reason).toBe("Asked 3 times and Ask V19 could not answer.");
  });
});

describe("cohortRetention", () => {
  it("shows each signup week's share active in later weeks, with future weeks empty", async () => {
    const { cohortRetention } = await import("../business");
    const now = new Date("2026-11-27T12:00:00Z"); const W = 7 * 86_400_000;
    const at = (weeksAgo: number) => new Date(now.getTime() - weeksAgo * W + 3_600_000);
    const rows = cohortRetention(
      [{ org: "a", at: at(3) }, { org: "b", at: at(3) }, { org: "c", at: at(1) }],
      [{ org: "a", at: at(3) }, { org: "b", at: at(3) }, { org: "a", at: at(2) }, { org: "a", at: at(1) }, { org: "c", at: at(1) }, { org: "x", at: at(1) }],
      3, now);
    expect(rows).toEqual([
      { cohortWeek: new Date(now.getTime() - 3 * W).toISOString().slice(0, 10), size: 2, retained: [100, 50, 50] },
      { cohortWeek: new Date(now.getTime() - 1 * W).toISOString().slice(0, 10), size: 1, retained: [100, null, null] },
    ]);
  });
});
