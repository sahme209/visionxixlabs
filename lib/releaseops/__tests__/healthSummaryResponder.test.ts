import { describe, expect, it } from "vitest";
import {
  buildHealthSummaryResponse,
  type HealthSummaryRepo,
} from "../healthSummaryResponder";

type RepoStub = HealthSummaryRepo & {
  _counts: {
    releasesTotal: number;
    releasesDraft: number;
    releasesReady: number;
    releasesDeploying: number;
    releasesDeployed: number;
    blockingOpen: number;
    criticalDrift: number;
    cherryPicksRequested: number;
    ticketsInFlight: number;
  };
  _releaseIds: string[];
  _snapshots: Map<string, { overallScore: number }>;
};

function makeRepo(): RepoStub {
  const stub: RepoStub = {
    _counts: {
      releasesTotal: 0, releasesDraft: 0, releasesReady: 0,
      releasesDeploying: 0, releasesDeployed: 0,
      blockingOpen: 0, criticalDrift: 0, cherryPicksRequested: 0,
      ticketsInFlight: 0,
    },
    _releaseIds: [],
    _snapshots: new Map(),
    release: {
      async count({ where }) {
        if (where.status === "draft") return stub._counts.releasesDraft;
        if (where.status === "ready") return stub._counts.releasesReady;
        if (where.status === "deploying") return stub._counts.releasesDeploying;
        if (where.status === "deployed") return stub._counts.releasesDeployed;
        return stub._counts.releasesTotal;
      },
      async findMany() { return stub._releaseIds.map((id) => ({ id })); },
    },
    policyViolation: { async count() { return stub._counts.blockingOpen; } },
    driftFinding: { async count() { return stub._counts.criticalDrift; } },
    cherryPickException: { async count() { return stub._counts.cherryPicksRequested; } },
    changeTicket: { async count() { return stub._counts.ticketsInFlight; } },
    releaseReadinessSnapshot: {
      async findFirst({ where }) { return stub._snapshots.get(where.releaseId) ?? null; },
    },
  };
  return stub;
}

const NOW = new Date("2026-05-27T12:00:00Z");

describe("buildHealthSummaryResponse", () => {
  it("empty org → zeros across the board, platformHealthScore=70 default", async () => {
    const repo = makeRepo();
    const r = await buildHealthSummaryResponse(repo, "o", { now: NOW });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.releases.total).toBe(0);
    expect(r.body.data.readiness.averageScore).toBeNull();
    expect(r.body.data.platformHealthScore).toBe(70);
  });

  it("populated org aggregates counts + averages readiness", async () => {
    const repo = makeRepo();
    repo._counts = {
      releasesTotal: 5, releasesDraft: 1, releasesReady: 2,
      releasesDeploying: 1, releasesDeployed: 1,
      blockingOpen: 0, criticalDrift: 0,
      cherryPicksRequested: 0, ticketsInFlight: 3,
    };
    repo._releaseIds = ["r1", "r2", "r3"];
    repo._snapshots.set("r1", { overallScore: 85 });
    repo._snapshots.set("r2", { overallScore: 90 });
    repo._snapshots.set("r3", { overallScore: 75 });

    const r = await buildHealthSummaryResponse(repo, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.releases.total).toBe(5);
    expect(r.body.data.releases.ready).toBe(2);
    expect(r.body.data.readiness.evaluated).toBe(3);
    expect(r.body.data.readiness.averageScore).toBe(Math.round((85 + 90 + 75) / 3));
    // No penalties → score == averageScore == 83.
    expect(r.body.data.platformHealthScore).toBe(83);
  });

  it("issue penalties subtract from baseline", async () => {
    const repo = makeRepo();
    repo._counts = {
      releasesTotal: 1, releasesDraft: 0, releasesReady: 0,
      releasesDeploying: 0, releasesDeployed: 1,
      blockingOpen: 2,    // -16
      criticalDrift: 1,   // -5
      cherryPicksRequested: 2, // -6
      ticketsInFlight: 0,
    };
    repo._releaseIds = ["r1"];
    repo._snapshots.set("r1", { overallScore: 90 });
    const r = await buildHealthSummaryResponse(repo, "o");
    if (!r.body.ok) throw new Error("expected ok");
    // base=90, penalty=27, result=63
    expect(r.body.data.platformHealthScore).toBe(63);
  });

  it("score clamps at 0", async () => {
    const repo = makeRepo();
    repo._counts.blockingOpen = 20; // -160 penalty
    repo._releaseIds = ["r1"];
    repo._snapshots.set("r1", { overallScore: 70 });
    const r = await buildHealthSummaryResponse(repo, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.platformHealthScore).toBe(0);
  });

  it("503 migration_pending propagates from any table", async () => {
    const repo = makeRepo();
    repo.release.count = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildHealthSummaryResponse(repo, "o");
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
