import { describe, expect, it } from "vitest";
import {
  buildEvidencePackResponse,
  type EvidencePackRepo,
  type EvidencePackRepoRelease,
  type EvidencePackRepoRepository,
  type EvidencePackRepoPr,
  type EvidencePackRepoCherryPick,
  type EvidencePackRepoTicket,
  type EvidencePackRepoReadiness,
} from "../evidencePackResponder";

type RepoStub = EvidencePackRepo & {
  _release: EvidencePackRepoRelease | null;
  _repository: EvidencePackRepoRepository | null;
  _prs: EvidencePackRepoPr[];
  _cherryPicks: EvidencePackRepoCherryPick[];
  _tickets: EvidencePackRepoTicket[];
  _readiness: EvidencePackRepoReadiness | null;
  _upserts: Array<{ contentHash: string }>;
};

function makeRepo(): RepoStub {
  let nextId = 1;
  const stub: RepoStub = {
    _release: null,
    _repository: null,
    _prs: [],
    _cherryPicks: [],
    _tickets: [],
    _readiness: null,
    _upserts: [],
    release: { async findUnique() { return stub._release; } },
    repository: { async findUnique() { return stub._repository; } },
    releaseReadinessSnapshot: { async findFirst() { return stub._readiness; } },
    pullRequestRecord: { async findMany() { return stub._prs; } },
    cherryPickException: { async findMany() { return stub._cherryPicks; } },
    changeTicket: { async findMany() { return stub._tickets; } },
    releaseEvidencePack: {
      async upsert({ create }) {
        stub._upserts.push({ contentHash: create.contentHash });
        return { id: `evp_${nextId++}` };
      },
    },
  };
  return stub;
}

function makeRelease(over: Partial<EvidencePackRepoRelease> = {}): EvidencePackRepoRelease {
  return {
    id: "rel_1", organizationId: "o", applicationId: "app", status: "ready",
    releaseTag: "v1.0.0", commitSha: "abc",
    scopeFinalizedAt: null, scopeFinalizedByUserId: null,
    plannedWindowStart: null, plannedWindowEnd: null,
    actualDeployStart: null, actualDeployEnd: null,
    summary: null, createdAt: new Date("2026-05-20T10:00:00Z"),
    ...over,
  };
}

const NOW = new Date("2026-05-25T12:00:00Z");

describe("buildEvidencePackResponse", () => {
  it("404 when release missing", async () => {
    const repo = makeRepo();
    const r = await buildEvidencePackResponse(repo, { organizationId: "o", releaseId: "missing" }, { now: NOW });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("release_not_found");
  });

  it("403 cross_org_release", async () => {
    const repo = makeRepo();
    repo._release = makeRelease({ organizationId: "other" });
    const r = await buildEvidencePackResponse(repo, { organizationId: "o", releaseId: "rel_1" }, { now: NOW });
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_release");
  });

  it("404 when repositoryId provided but missing", async () => {
    const repo = makeRepo();
    repo._release = makeRelease();
    const r = await buildEvidencePackResponse(repo, { organizationId: "o", releaseId: "rel_1", repositoryId: "missing" }, { now: NOW });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("repository_not_found");
  });

  it("200 — empty inputs produce a minimal pack with deterministic hash", async () => {
    const repo = makeRepo();
    repo._release = makeRelease();
    const r = await buildEvidencePackResponse(repo, { organizationId: "o", releaseId: "rel_1" }, { now: NOW });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.summary).toEqual({
      prCount: 0, cherryPickCount: 0, linkedTicketCount: 0,
      branchTotal: 0, branchPassing: 0, branchFailing: 0,
    });
    expect(r.body.data.contentHash).toHaveLength(64);
    expect(repo._upserts).toHaveLength(1);
  });

  it("200 — populated pack aggregates PR + cherry-pick + ticket counts", async () => {
    const repo = makeRepo();
    repo._release = makeRelease();
    repo._repository = {
      id: "repo_1", provider: "github", remoteOwner: "acme", remoteName: "checkout", defaultBranch: "main",
    };
    repo._prs = [
      { id: "pr_1", organizationId: "o", repositoryId: "repo_1", number: 1, title: "A", state: "merged", mergedAt: new Date(), mergedByUserId: "u", approvalsRequiredCount: 2, approvalsObservedCount: 2, codeownersApproved: true, ciStatus: "passing", linkedStories: ["PROJ-1"], linkedTickets: [], webUrl: null },
      { id: "pr_2", organizationId: "o", repositoryId: "repo_1", number: 2, title: "B", state: "open", mergedAt: null, mergedByUserId: null, approvalsRequiredCount: 1, approvalsObservedCount: 1, codeownersApproved: false, ciStatus: "passing", linkedStories: [], linkedTickets: [], webUrl: null },
    ];
    repo._cherryPicks = [
      { id: "cp_1", organizationId: "o", releaseId: "rel_1", status: "approved", rationale: "hotfix", approvedPrIds: ["pr_1"], excludedPrIds: [], hasFinalCommitValidation: true, requestedByUserId: "u_op", requestedAt: new Date(), decidedByUserId: "u_app", decidedAt: new Date(), decisionReason: "ok" },
    ];
    repo._tickets = [
      { id: "t_1", organizationId: "o", linkedReleaseIds: ["rel_1"], provider: "jira", externalKey: "PROJ-1", title: "x", ticketType: "story", status: "implemented", priority: "normal", webUrl: null },
      { id: "t_2", organizationId: "o", linkedReleaseIds: ["rel_1"], provider: "linear", externalKey: "ENG-1", title: "y", ticketType: "task", status: "implemented", priority: "high", webUrl: null },
    ];

    const r = await buildEvidencePackResponse(repo, { organizationId: "o", releaseId: "rel_1", repositoryId: "repo_1" }, { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.summary).toMatchObject({ prCount: 2, cherryPickCount: 1, linkedTicketCount: 2 });
  });

  it("503 migration_pending when ReleaseEvidencePack table missing", async () => {
    const repo = makeRepo();
    repo._release = makeRelease();
    repo.releaseEvidencePack.upsert = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildEvidencePackResponse(repo, { organizationId: "o", releaseId: "rel_1" }, { now: NOW });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
