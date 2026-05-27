import { describe, expect, it } from "vitest";
import {
  buildReadinessListResponse,
  type ReadinessListRepo,
  type ReadinessReleaseRow,
  type ReadinessSnapshotRow,
} from "../readinessListResponder";

function makeRepo(): ReadinessListRepo & {
  _releases: ReadinessReleaseRow[];
  _snapshots: Map<string, ReadinessSnapshotRow>;
} {
  const releases: ReadinessReleaseRow[] = [];
  const snapshots = new Map<string, ReadinessSnapshotRow>();
  return {
    _releases: releases,
    _snapshots: snapshots,
    release: {
      async findMany({ where }) {
        return releases.filter((r) => r.organizationId === where.organizationId);
      },
    },
    releaseReadinessSnapshot: {
      async findFirst({ where }) {
        return snapshots.get(where.releaseId) ?? null;
      },
    },
  };
}

function makeSnap(over: Partial<ReadinessSnapshotRow> = {}): ReadinessSnapshotRow {
  return {
    id: "rrs_1", releaseId: "rel_1",
    overallScore: 85, riskLevel: "low",
    branchGovernance: 90, changeCompliance: 80, artifactTraceability: 90,
    rollbackReadiness: 80, driftRisk: 90, manualReconciliation: 80,
    blockersJson: [], evaluatedAt: new Date("2026-05-25T12:00:00Z"),
    evaluationSource: "phase-480-evaluator",
    ...over,
  };
}

const NOW = new Date("2026-05-25T13:00:00Z");

describe("buildReadinessListResponse", () => {
  it("empty org → 200 ok, zeros across the board", async () => {
    const repo = makeRepo();
    const r = await buildReadinessListResponse(repo, "o", { now: NOW });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.releases).toEqual([]);
    expect(r.body.data.summary).toEqual({
      total: 0, evaluated: 0,
      byRisk: { low: 0, medium: 0, high: 0, critical: 0, unknown: 0 },
      averageScore: null,
    });
  });

  it("releases without snapshots → hasSnapshot=false, no score", async () => {
    const repo = makeRepo();
    repo._releases.push({ id: "rel_1", organizationId: "o", applicationId: "app", releaseTag: "v1", status: "draft" });
    const r = await buildReadinessListResponse(repo, "o", { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.releases[0]).toMatchObject({ hasSnapshot: false, overallScore: null, riskLevel: null });
    expect(r.body.data.summary.evaluated).toBe(0);
  });

  it("populated mix — averages score, buckets by risk, surfaces top blocker", async () => {
    const repo = makeRepo();
    repo._releases.push({ id: "rel_1", organizationId: "o", applicationId: "a1", releaseTag: "v1", status: "ready" });
    repo._releases.push({ id: "rel_2", organizationId: "o", applicationId: "a1", releaseTag: "v2", status: "ready" });
    repo._releases.push({ id: "rel_3", organizationId: "o", applicationId: "a1", releaseTag: "v3", status: "ready" });
    repo._snapshots.set("rel_1", makeSnap({ releaseId: "rel_1", overallScore: 92, riskLevel: "low" }));
    repo._snapshots.set("rel_2", makeSnap({
      releaseId: "rel_2", overallScore: 55, riskLevel: "high",
      blockersJson: [{ category: "drift_risk", severity: "critical", message: "2 blocking violations open." }],
    }));
    // rel_3 has no snapshot

    const r = await buildReadinessListResponse(repo, "o", { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.releases).toHaveLength(3);
    expect(r.body.data.summary.evaluated).toBe(2);
    expect(r.body.data.summary.averageScore).toBe(Math.round((92 + 55) / 2));
    expect(r.body.data.summary.byRisk).toMatchObject({ low: 1, high: 1 });
    const rel2 = r.body.data.releases.find((x) => x.releaseId === "rel_2");
    expect(rel2?.topBlockerMessage).toContain("blocking");
  });

  it("unknown risk-level value narrowed to 'unknown'", async () => {
    const repo = makeRepo();
    repo._releases.push({ id: "rel_1", organizationId: "o", applicationId: "a", releaseTag: null, status: "ready" });
    repo._snapshots.set("rel_1", makeSnap({ releaseId: "rel_1", riskLevel: "weird" }));
    const r = await buildReadinessListResponse(repo, "o", { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.releases[0].riskLevel).toBe("unknown");
    expect(r.body.data.summary.byRisk.unknown).toBe(1);
  });

  it("503 migration_pending when release table missing", async () => {
    const repo = makeRepo();
    repo.release.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildReadinessListResponse(repo, "o");
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
