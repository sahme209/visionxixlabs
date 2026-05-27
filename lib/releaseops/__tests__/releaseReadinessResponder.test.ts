import { describe, expect, it } from "vitest";
import {
  buildReleaseReadinessResponse,
  type ReleaseReadinessRepo,
  type ReadinessRepoReleaseRow,
} from "../releaseReadinessResponder";

type RepoStub = ReleaseReadinessRepo & {
  _release: ReadinessRepoReleaseRow | null;
  _cherryPicks: Array<{ status: string; hasFinalCommitValidation: boolean }>;
  _violations: Array<{ status: string; rule: { severity: string; blocking: boolean } }>;
  _tickets: Array<{ status: string }>;
  _snapshots: Array<{ overallScore: number; riskLevel: string }>;
};

function makeRepo(): RepoStub {
  let nextId = 1;
  const stub: RepoStub = {
    _release: null,
    _cherryPicks: [],
    _violations: [],
    _tickets: [],
    _snapshots: [],
    release: { async findUnique() { return stub._release; } },
    cherryPickException: { async findMany() { return stub._cherryPicks; } },
    policyViolation: { async findMany() { return stub._violations; } },
    changeTicket: { async findMany() { return stub._tickets; } },
    releaseReadinessSnapshot: {
      async create({ data }) {
        stub._snapshots.push({ overallScore: data.overallScore, riskLevel: data.riskLevel });
        return { id: `rrs_${nextId++}` };
      },
    },
  };
  return stub;
}

function makeRelease(over: Partial<ReadinessRepoReleaseRow> = {}): ReadinessRepoReleaseRow {
  return {
    id: "rel_1", organizationId: "o",
    releaseTag: "v1.0.0", commitSha: "abc",
    scopeFinalizedAt: new Date("2026-05-23T10:00:00Z"),
    rollbackReferenceReleaseId: "rel_prev",
    summary: "Security patch + perf improvements across checkout.",
    ...over,
  };
}

const NOW = new Date("2026-05-25T12:00:00Z");

describe("buildReleaseReadinessResponse", () => {
  it("404 when release missing", async () => {
    const repo = makeRepo();
    const r = await buildReleaseReadinessResponse(repo, { organizationId: "o", releaseId: "missing" }, { now: NOW });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("release_not_found");
  });

  it("403 cross_org_release", async () => {
    const repo = makeRepo();
    repo._release = makeRelease({ organizationId: "other" });
    const r = await buildReleaseReadinessResponse(repo, { organizationId: "o", releaseId: "rel_1" }, { now: NOW });
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_release");
  });

  it("clean release with branch validation provided → snapshot persisted, low risk", async () => {
    const repo = makeRepo();
    repo._release = makeRelease();
    repo._tickets = [{ status: "implemented" }];
    const r = await buildReleaseReadinessResponse(repo, {
      organizationId: "o", releaseId: "rel_1",
      branchValidation: { total: 18, passing: 18, failing: 0, notApplicable: 0, unknown: 0 },
    }, { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.overallScore).toBeGreaterThanOrEqual(80);
    expect(r.body.data.riskLevel).toBe("low");
    expect(repo._snapshots).toHaveLength(1);
  });

  it("open blocking violation surfaces as top blocker + critical risk", async () => {
    const repo = makeRepo();
    repo._release = makeRelease();
    repo._violations = [
      { status: "open", rule: { severity: "blocker", blocking: true } },
      { status: "open", rule: { severity: "blocker", blocking: true } },
      { status: "open", rule: { severity: "blocker", blocking: true } },
    ];
    repo._tickets = [{ status: "implemented" }];
    const r = await buildReleaseReadinessResponse(repo, { organizationId: "o", releaseId: "rel_1" }, { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.topBlocker).not.toBeNull();
    expect(r.body.data.blockerCount).toBeGreaterThanOrEqual(1);
  });

  it("503 migration_pending when snapshot table missing", async () => {
    const repo = makeRepo();
    repo._release = makeRelease();
    repo.releaseReadinessSnapshot.create = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildReleaseReadinessResponse(repo, { organizationId: "o", releaseId: "rel_1" }, { now: NOW });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
