import { describe, expect, it } from "vitest";
import {
  buildCherryPickListResponse,
  type CherryPickListRepo,
  type CherryPickRow,
  type CherryPickReleaseRow,
  type CherryPickRepositoryRow,
} from "../cherryPickListResponder";

function makeRepo(): CherryPickListRepo & {
  _rows: CherryPickRow[];
  _releases: CherryPickReleaseRow[];
  _repositories: CherryPickRepositoryRow[];
} {
  const rows: CherryPickRow[] = [];
  const releases: CherryPickReleaseRow[] = [];
  const repositories: CherryPickRepositoryRow[] = [];
  return {
    _rows: rows,
    _releases: releases,
    _repositories: repositories,
    cherryPickException: {
      async findMany({ where }) {
        return rows
          .filter((r) => r.organizationId === where.organizationId)
          .slice()
          .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
      },
    },
    release: {
      async findMany({ where }) {
        const ids = new Set(where.id.in);
        return releases.filter((r) => ids.has(r.id));
      },
    },
    repository: {
      async findMany({ where }) {
        const ids = new Set(where.id.in);
        return repositories.filter((r) => ids.has(r.id));
      },
    },
  };
}

function makeRow(over: Partial<CherryPickRow> = {}): CherryPickRow {
  return {
    id: "cpe_1",
    organizationId: "o",
    releaseId: "rel_1",
    repositoryId: "repo_1",
    status: "requested",
    rationale: "Hotfix for the prod outage on Saturday morning.",
    approvedPrIds: ["pr_1"],
    excludedPrIds: [],
    hasFinalCommitValidation: false,
    requestedByUserId: "u_op",
    requestedAt: new Date("2026-05-20T10:00:00Z"),
    decidedByUserId: null,
    decidedAt: null,
    decisionReason: null,
    ...over,
  };
}

describe("buildCherryPickListResponse", () => {
  it("empty org → 200 ok, exceptions empty, summary buckets zeroed", async () => {
    const repo = makeRepo();
    const r = await buildCherryPickListResponse(repo, "o", { now: new Date("2026-06-01T00:00:00Z") });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.exceptions).toEqual([]);
    expect(r.body.data.summary).toEqual({
      total: 0,
      byStatus: { requested: 0, approved: 0, denied: 0, superseded: 0, unknown: 0 },
    });
  });

  it("populated org → enriched rows with release tag + repo display + summary buckets", async () => {
    const repo = makeRepo();
    repo._releases.push({ id: "rel_1", releaseTag: "v2.4.0", applicationId: "app_checkout" });
    repo._releases.push({ id: "rel_2", releaseTag: "v1.0.0", applicationId: "app_billing" });
    repo._repositories.push({ id: "repo_1", remoteOwner: "org", remoteName: "checkout" });
    repo._repositories.push({ id: "repo_2", remoteOwner: "org", remoteName: "billing" });

    repo._rows.push(makeRow({ id: "cpe_a", status: "requested", requestedAt: new Date("2026-05-22T10:00:00Z") }));
    repo._rows.push(
      makeRow({
        id: "cpe_b",
        releaseId: "rel_2",
        repositoryId: "repo_2",
        status: "approved",
        decidedByUserId: "u_approver",
        decidedAt: new Date("2026-05-21T12:00:00Z"),
        decisionReason: "Hotfix scope verified.",
        requestedAt: new Date("2026-05-21T08:00:00Z"),
      }),
    );
    repo._rows.push(
      makeRow({ id: "cpe_c", status: "denied", requestedAt: new Date("2026-05-20T08:00:00Z"), decisionReason: "Too broad." }),
    );
    repo._rows.push(makeRow({ id: "cpe_d", status: "garbage", requestedAt: new Date("2026-05-19T08:00:00Z") }));

    const r = await buildCherryPickListResponse(repo, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.exceptions).toHaveLength(4);
    // requestedAt desc → cpe_a first
    expect(r.body.data.exceptions[0].id).toBe("cpe_a");
    expect(r.body.data.exceptions[0].releaseTag).toBe("v2.4.0");
    expect(r.body.data.exceptions[0].repositoryDisplayName).toBe("org/checkout");
    expect(r.body.data.exceptions[1].id).toBe("cpe_b");
    expect(r.body.data.exceptions[1].repositoryDisplayName).toBe("org/billing");
    expect(r.body.data.exceptions[1].decisionReason).toBe("Hotfix scope verified.");
    // garbage status narrowed to "unknown"
    expect(r.body.data.exceptions[3].status).toBe("unknown");

    expect(r.body.data.summary).toEqual({
      total: 4,
      byStatus: { requested: 1, approved: 1, denied: 1, superseded: 0, unknown: 1 },
    });
  });

  it("orphan rows → null release tag + null repository display, but row still rendered", async () => {
    const repo = makeRepo();
    repo._rows.push(makeRow({ id: "cpe_orphan" }));
    const r = await buildCherryPickListResponse(repo, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.exceptions[0].releaseTag).toBeNull();
    expect(r.body.data.exceptions[0].applicationId).toBeNull();
    expect(r.body.data.exceptions[0].repositoryDisplayName).toBeNull();
  });

  it("migration_pending degradation", async () => {
    const repo = makeRepo();
    repo.cherryPickException.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildCherryPickListResponse(repo, "o");
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });

  it("internal_error surfaces correlationId", async () => {
    const repo = makeRepo();
    repo.cherryPickException.findMany = async () => { throw new Error("unexpected"); };
    const r = await buildCherryPickListResponse(repo, "o", { correlationId: "abc-123" });
    expect(r.status).toBe(500);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("internal_error");
    expect(r.body.correlationId).toBe("abc-123");
  });
});
