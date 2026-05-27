import { describe, expect, it } from "vitest";
import {
  buildReleaseDetailResponse,
  type ReleaseDetailRepo,
  type DetailReleaseRow,
  type DetailReadinessRow,
  type DetailCherryPickRow,
  type DetailViolationRow,
  type DetailTicketRow,
  type DetailEvidencePackRow,
} from "../releaseDetailResponder";

type RepoStub = ReleaseDetailRepo & {
  _release: DetailReleaseRow | null;
  _repository: { id: string; provider: string; remoteOwner: string; remoteName: string } | null;
  _readiness: DetailReadinessRow | null;
  _cherryPicks: DetailCherryPickRow[];
  _violations: DetailViolationRow[];
  _tickets: DetailTicketRow[];
  _evidencePack: DetailEvidencePackRow | null;
};

function makeRepo(): RepoStub {
  const stub: RepoStub = {
    _release: null,
    _repository: null,
    _readiness: null,
    _cherryPicks: [],
    _violations: [],
    _tickets: [],
    _evidencePack: null,
    release: { async findUnique() { return stub._release; } },
    repository: { async findFirst() { return stub._repository; } },
    releaseReadinessSnapshot: { async findFirst() { return stub._readiness; } },
    cherryPickException: { async findMany() { return stub._cherryPicks; } },
    policyViolation: { async findMany() { return stub._violations; } },
    changeTicket: { async findMany() { return stub._tickets; } },
    releaseEvidencePack: { async findUnique() { return stub._evidencePack; } },
  };
  return stub;
}

function makeRelease(over: Partial<DetailReleaseRow> = {}): DetailReleaseRow {
  return {
    id: "rel_1", organizationId: "o", applicationId: "app",
    releaseTag: "v1.0.0", commitSha: "abc", status: "ready",
    scopeFinalizedAt: null, scopeFinalizedByUserId: null,
    plannedWindowStart: null, plannedWindowEnd: null,
    actualDeployStart: null, actualDeployEnd: null,
    rollbackReferenceReleaseId: null, summary: null,
    createdAt: new Date("2026-05-20T10:00:00Z"),
    ...over,
  };
}

describe("buildReleaseDetailResponse", () => {
  it("404 when release missing", async () => {
    const repo = makeRepo();
    const r = await buildReleaseDetailResponse(repo, { organizationId: "o", releaseId: "missing" });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("release_not_found");
  });

  it("403 cross_org_release", async () => {
    const repo = makeRepo();
    repo._release = makeRelease({ organizationId: "other" });
    const r = await buildReleaseDetailResponse(repo, { organizationId: "o", releaseId: "rel_1" });
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_release");
  });

  it("empty release → zeros across all sections", async () => {
    const repo = makeRepo();
    repo._release = makeRelease();
    const r = await buildReleaseDetailResponse(repo, { organizationId: "o", releaseId: "rel_1" });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.release.releaseTag).toBe("v1.0.0");
    expect(r.body.data.repository).toBeNull();
    expect(r.body.data.readiness).toBeNull();
    expect(r.body.data.cherryPicks.total).toBe(0);
    expect(r.body.data.policyViolations.total).toBe(0);
    expect(r.body.data.changeTickets.total).toBe(0);
    expect(r.body.data.evidencePack).toBeNull();
  });

  it("populated release aggregates every section", async () => {
    const repo = makeRepo();
    repo._release = makeRelease();
    repo._repository = { id: "repo_1", provider: "github", remoteOwner: "acme", remoteName: "checkout" };
    repo._readiness = {
      overallScore: 72, riskLevel: "medium", evaluatedAt: new Date("2026-05-25T10:00:00Z"),
      blockersJson: [{ category: "drift_risk", severity: "high", message: "1 blocking violation open." }],
    };
    repo._cherryPicks = [
      { id: "cp_1", status: "approved", rationale: "Hotfix for security CVE.", approvedPrIds: ["pr_1", "pr_2"], requestedAt: new Date("2026-05-22T10:00:00Z") },
      { id: "cp_2", status: "denied",   rationale: "Scope was too broad.",    approvedPrIds: ["pr_3"],          requestedAt: new Date("2026-05-21T10:00:00Z") },
    ];
    repo._violations = [
      { id: "pv_1", status: "open", message: "Missing approvals", rule: { key: "min_approvals", label: "Minimum approvals", severity: "blocker", blocking: true } },
      { id: "pv_2", status: "exception_granted", message: "Coverage below 80%", rule: { key: "test_cov", label: "Test coverage", severity: "warning", blocking: false } },
    ];
    repo._tickets = [
      { id: "t_1", provider: "jira", externalKey: "PROJ-1", title: "Add SSO", status: "implemented" },
      { id: "t_2", provider: "linear", externalKey: "ENG-1", title: "Refactor", status: "implemented" },
    ];
    repo._evidencePack = {
      id: "evp_1", generatedAt: new Date("2026-05-25T11:00:00Z"),
      signedAt: null, contentHash: "abc123def456",
    };

    const r = await buildReleaseDetailResponse(repo, { organizationId: "o", releaseId: "rel_1", repositoryId: "repo_1" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.repository?.displayName).toBe("acme/checkout");
    expect(r.body.data.readiness?.overallScore).toBe(72);
    expect(r.body.data.readiness?.topBlocker).toContain("blocking violation");
    expect(r.body.data.cherryPicks.byStatus).toEqual({ approved: 1, denied: 1 });
    expect(r.body.data.policyViolations.blockingOpen).toBe(1);
    expect(r.body.data.changeTickets.byProvider).toEqual({ jira: 1, linear: 1 });
    expect(r.body.data.evidencePack?.contentHash).toBe("abc123def456");
  });

  it("503 migration_pending when release table missing", async () => {
    const repo = makeRepo();
    repo.release.findUnique = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildReleaseDetailResponse(repo, { organizationId: "o", releaseId: "rel_1" });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
