import { describe, expect, it } from "vitest";
import {
  buildReleaseActivityResponse,
  type ReleaseActivityRepo,
  type ActivityReleaseRow,
  type ActivityReadinessRow,
  type ActivityCherryPickRow,
  type ActivityViolationRow,
  type ActivityEvidencePackRow,
} from "../releaseActivityResponder";

type RepoStub = ReleaseActivityRepo & {
  _release: ActivityReleaseRow | null;
  _readiness: ActivityReadinessRow[];
  _cherryPicks: ActivityCherryPickRow[];
  _violations: ActivityViolationRow[];
  _evidencePack: ActivityEvidencePackRow | null;
};

function makeRepo(): RepoStub {
  const stub: RepoStub = {
    _release: null,
    _readiness: [],
    _cherryPicks: [],
    _violations: [],
    _evidencePack: null,
    release: { async findUnique() { return stub._release; } },
    releaseReadinessSnapshot: { async findMany() { return stub._readiness; } },
    cherryPickException: { async findMany() { return stub._cherryPicks; } },
    policyViolation: { async findMany() { return stub._violations; } },
    releaseEvidencePack: { async findUnique() { return stub._evidencePack; } },
  };
  return stub;
}

function rel(over: Partial<ActivityReleaseRow> = {}): ActivityReleaseRow {
  return {
    id: "rel_1", organizationId: "o",
    releaseTag: "v1.0.0", status: "ready",
    scopeFinalizedAt: null, scopeFinalizedByUserId: null,
    actualDeployStart: null, actualDeployEnd: null,
    createdAt: new Date("2026-05-20T10:00:00Z"),
    createdByUserId: "u_captain",
    ...over,
  };
}

describe("buildReleaseActivityResponse", () => {
  it("404 when release missing", async () => {
    const repo = makeRepo();
    const r = await buildReleaseActivityResponse(repo, { organizationId: "o", releaseId: "missing" });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("release_not_found");
  });

  it("403 cross_org_release", async () => {
    const repo = makeRepo();
    repo._release = rel({ organizationId: "other" });
    const r = await buildReleaseActivityResponse(repo, { organizationId: "o", releaseId: "rel_1" });
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_release");
  });

  it("bare release → just the created event", async () => {
    const repo = makeRepo();
    repo._release = rel();
    const r = await buildReleaseActivityResponse(repo, { organizationId: "o", releaseId: "rel_1" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.events).toHaveLength(1);
    expect(r.body.data.events[0].kind).toBe("release_created");
    expect(r.body.data.events[0].actorUserId).toBe("u_captain");
  });

  it("aggregates release + scope + deploy + readiness + cherry + violation + evidence events in chronological order", async () => {
    const repo = makeRepo();
    repo._release = rel({
      scopeFinalizedAt: new Date("2026-05-21T10:00:00Z"),
      scopeFinalizedByUserId: "u_captain",
      actualDeployStart: new Date("2026-05-24T16:00:00Z"),
      actualDeployEnd: new Date("2026-05-24T16:30:00Z"),
    });
    repo._readiness = [
      { id: "rrs_1", overallScore: 70, riskLevel: "medium", evaluatedAt: new Date("2026-05-22T10:00:00Z"), evaluationSource: "phase-480-evaluator" },
      { id: "rrs_2", overallScore: 85, riskLevel: "low",    evaluatedAt: new Date("2026-05-23T10:00:00Z"), evaluationSource: "phase-480-evaluator" },
    ];
    repo._cherryPicks = [
      {
        id: "cp_1", status: "approved",
        requestedByUserId: "u_op", requestedAt: new Date("2026-05-22T11:00:00Z"),
        decidedByUserId: "u_app", decidedAt: new Date("2026-05-22T13:00:00Z"),
        decisionReason: "Hotfix scope verified.",
      },
    ];
    repo._violations = [
      {
        id: "pv_1", status: "exception_granted",
        message: "Missing approvals", detectedAt: new Date("2026-05-21T11:00:00Z"),
        exceptionGrantedByUserId: "u_app", exceptionGrantedAt: new Date("2026-05-21T15:00:00Z"),
        rule: { key: "min_approvals", label: "Minimum approvals", severity: "blocker" },
      },
    ];
    repo._evidencePack = {
      id: "evp_1",
      generatedAt: new Date("2026-05-24T16:35:00Z"),
      signedAt: new Date("2026-05-24T17:00:00Z"),
      contentHash: "abc123def456789",
    };

    const r = await buildReleaseActivityResponse(repo, { organizationId: "o", releaseId: "rel_1" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.events.length).toBeGreaterThanOrEqual(10);
    // First should be release_created.
    expect(r.body.data.events[0].kind).toBe("release_created");
    // Last should be evidence_pack_sealed (latest timestamp).
    expect(r.body.data.events[r.body.data.events.length - 1].kind).toBe("evidence_pack_sealed");
    // Timeline is sorted.
    for (let i = 1; i < r.body.data.events.length; i++) {
      expect(r.body.data.events[i].atIso >= r.body.data.events[i - 1].atIso).toBe(true);
    }
    // Summary buckets match.
    expect(r.body.data.summary.byKind.readiness_evaluated).toBe(2);
    expect(r.body.data.summary.byKind.cherry_pick_requested).toBe(1);
    expect(r.body.data.summary.byKind.cherry_pick_decided).toBe(1);
    expect(r.body.data.summary.byKind.violation_detected).toBe(1);
    expect(r.body.data.summary.byKind.violation_exception_granted).toBe(1);
  });

  it("503 migration_pending when release table missing", async () => {
    const repo = makeRepo();
    repo.release.findUnique = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildReleaseActivityResponse(repo, { organizationId: "o", releaseId: "rel_1" });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
