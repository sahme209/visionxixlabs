import { describe, expect, it } from "vitest";
import { decideFreezeStatus, detectDayOfPrs } from "../releaseFreeze";
import type { PullRequestRecordRow } from "../gitDiscoveryRepo";

const NOW = new Date("2026-06-01T22:00:00Z");
const FREEZE = new Date("2026-06-01T20:00:00Z");
const WINDOW = new Date("2026-06-01T22:30:00Z");

function makePr(over: Partial<PullRequestRecordRow> = {}): PullRequestRecordRow {
  return {
    id: "pr_1", organizationId: "o", repositoryId: "repo_1",
    number: 1, title: "x", state: "merged",
    sourceBranch: "feat/x", targetBranch: "main",
    commitShaHead: "abc",
    mergedAt: new Date("2026-06-01T19:00:00Z"),
    mergedByUserId: "u",
    linkedStories: [], linkedTickets: [],
    approvalsRequiredCount: 2, approvalsObservedCount: 2,
    codeownersApproved: true, ciStatus: "passing",
    webUrl: null, lastSyncedAt: NOW, createdAt: NOW, updatedAt: NOW,
    ...over,
  };
}

describe("decideFreezeStatus", () => {
  it("not_yet_finalized when scopeFinalizedAt is null", () => {
    const r = decideFreezeStatus({
      scopeFinalizedAt: null, actualDeployStart: null, prs: [makePr()], now: NOW,
    });
    expect(r.status).toBe("not_yet_finalized");
    expect(r.lateMergedPrs).toEqual([]);
    expect(r.hoursSinceScopeFinalized).toBeNull();
  });

  it("deploy_window_started wins over any late-merge check", () => {
    const r = decideFreezeStatus({
      scopeFinalizedAt: FREEZE,
      actualDeployStart: new Date("2026-06-01T22:05:00Z"),
      prs: [makePr({ mergedAt: new Date("2026-06-01T21:00:00Z") })],
      now: NOW,
    });
    expect(r.status).toBe("deploy_window_started");
  });

  it("frozen when scope finalized + no PRs merged after freeze", () => {
    const r = decideFreezeStatus({
      scopeFinalizedAt: FREEZE,
      actualDeployStart: null,
      prs: [makePr({ mergedAt: new Date("2026-06-01T19:00:00Z") })],
      now: NOW,
    });
    expect(r.status).toBe("frozen");
    expect(r.hoursSinceScopeFinalized).toBe(2);
  });

  it("frozen_with_late_change when at least one PR merged after scope freeze", () => {
    const r = decideFreezeStatus({
      scopeFinalizedAt: FREEZE,
      actualDeployStart: null,
      prs: [
        makePr({ id: "pr_a", mergedAt: new Date("2026-06-01T19:00:00Z") }),
        makePr({ id: "pr_b", mergedAt: new Date("2026-06-01T21:30:00Z") }),
      ],
      now: NOW,
    });
    expect(r.status).toBe("frozen_with_late_change");
    expect(r.lateMergedPrs.map((p) => p.id)).toEqual(["pr_b"]);
    expect(r.summary).toMatch(/exception approval required/);
  });

  it("unmerged PRs after freeze don't count as late merges", () => {
    const r = decideFreezeStatus({
      scopeFinalizedAt: FREEZE,
      actualDeployStart: null,
      prs: [makePr({ state: "open", mergedAt: null })],
      now: NOW,
    });
    expect(r.status).toBe("frozen");
  });
});

describe("detectDayOfPrs", () => {
  it("returns hasAny:false when plannedWindowStart is null", () => {
    expect(detectDayOfPrs({ prs: [makePr()], plannedWindowStart: null })).toEqual({ dayOfPrs: [], hasAny: false });
  });

  it("detects merges in the same UTC calendar day as the deploy window", () => {
    const d = detectDayOfPrs({
      prs: [
        makePr({ id: "pr_yesterday", mergedAt: new Date("2026-05-31T23:00:00Z") }),
        makePr({ id: "pr_dayof", mergedAt: new Date("2026-06-01T18:00:00Z") }),
        makePr({ id: "pr_window", mergedAt: new Date("2026-06-01T22:00:00Z") }),
      ],
      plannedWindowStart: WINDOW,
    });
    expect(d.hasAny).toBe(true);
    expect(d.dayOfPrs.map((p) => p.id).sort()).toEqual(["pr_dayof", "pr_window"]);
  });

  it("respects timezoneOffsetMinutes (EST observers see midnight at different absolute time)", () => {
    // 2026-06-02T03:00:00Z = 2026-06-01T22:00:00 EST (offset -300)
    // 2026-06-01T18:00:00Z = 2026-06-01T13:00:00 EST
    const d = detectDayOfPrs({
      prs: [
        makePr({ id: "pr_est_dayof", mergedAt: new Date("2026-06-01T18:00:00Z") }),
        makePr({ id: "pr_est_window", mergedAt: new Date("2026-06-02T03:00:00Z") }),
        makePr({ id: "pr_est_nextday", mergedAt: new Date("2026-06-02T05:00:00Z") }),
      ],
      plannedWindowStart: new Date("2026-06-02T03:30:00Z"),
      timezoneOffsetMinutes: -300,
    });
    expect(d.dayOfPrs.map((p) => p.id).sort()).toEqual(["pr_est_dayof", "pr_est_window"]);
  });

  it("excludes open PRs (only merged count as day-of changes)", () => {
    const d = detectDayOfPrs({
      prs: [makePr({ state: "open", mergedAt: null })],
      plannedWindowStart: WINDOW,
    });
    expect(d.hasAny).toBe(false);
  });
});
