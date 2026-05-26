import { describe, expect, it } from "vitest";
import {
  buildCherryPickSubmitResponse,
  validateInputLocally,
  type CherryPickSubmitRepo,
  type CherryPickReleaseLookup,
  type CherryPickRepositoryLookup,
  type CherryPickInserted,
} from "../cherryPickSubmitResponder";

function makeRepo(): CherryPickSubmitRepo & {
  _releases: Map<string, CherryPickReleaseLookup>;
  _repos: Map<string, CherryPickRepositoryLookup>;
  _inserted: CherryPickInserted[];
} {
  const releases = new Map<string, CherryPickReleaseLookup>();
  const repos = new Map<string, CherryPickRepositoryLookup>();
  const inserted: CherryPickInserted[] = [];
  let nextId = 1;
  return {
    _releases: releases, _repos: repos, _inserted: inserted,
    release: {
      async findUnique({ where }) { return releases.get(where.id) ?? null; },
    },
    repository: {
      async findUnique({ where }) { return repos.get(where.id) ?? null; },
    },
    cherryPickException: {
      async create({ data }) {
        const row: CherryPickInserted = {
          id: `cpe_${nextId++}`,
          status: data.status,
          rationale: data.rationale,
          approvedPrIds: data.approvedPrIds,
          excludedPrIds: data.excludedPrIds,
          requestedByUserId: data.requestedByUserId,
          requestedAt: new Date("2026-05-25T12:00:00Z"),
        };
        inserted.push(row);
        return row;
      },
    },
  };
}

const ORG = "o";
const VALID_INPUT = {
  organizationId: ORG,
  requestedByUserId: "u_op",
  releaseId: "rel_1",
  repositoryId: "repo_1",
  rationale: "We need to ship a security patch out of band for CVE-2026-1234.",
  approvedPrIds: ["pr_1"],
  excludedPrIds: [],
};

describe("validateInputLocally", () => {
  it("rationale shorter than 20 chars rejected", () => {
    expect(validateInputLocally({ ...VALID_INPUT, rationale: "tiny" })).toBe("rationale_too_short");
  });
  it("rationale with only whitespace counted by trimmed length", () => {
    expect(validateInputLocally({ ...VALID_INPUT, rationale: "   short  " })).toBe("rationale_too_short");
  });
  it("empty approved list rejected", () => {
    expect(validateInputLocally({ ...VALID_INPUT, approvedPrIds: [] })).toBe("approved_list_empty");
  });
  it("overlap between approved and excluded rejected", () => {
    expect(validateInputLocally({ ...VALID_INPUT, approvedPrIds: ["pr_1"], excludedPrIds: ["pr_1"] }))
      .toBe("approved_and_excluded_overlap");
  });
  it("clean input → null", () => {
    expect(validateInputLocally(VALID_INPUT)).toBeNull();
  });
});

describe("buildCherryPickSubmitResponse", () => {
  it("422 on local validation failure (rationale too short)", async () => {
    const repo = makeRepo();
    const r = await buildCherryPickSubmitResponse(repo, { ...VALID_INPUT, rationale: "no" });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("rationale_too_short");
  });

  it("404 when release not found", async () => {
    const repo = makeRepo();
    repo._repos.set("repo_1", { id: "repo_1", organizationId: ORG });
    const r = await buildCherryPickSubmitResponse(repo, VALID_INPUT);
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("release_not_found");
  });

  it("403 when release belongs to another org", async () => {
    const repo = makeRepo();
    repo._releases.set("rel_1", { id: "rel_1", organizationId: "other" });
    repo._repos.set("repo_1", { id: "repo_1", organizationId: ORG });
    const r = await buildCherryPickSubmitResponse(repo, VALID_INPUT);
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_release");
  });

  it("404 when repository not found", async () => {
    const repo = makeRepo();
    repo._releases.set("rel_1", { id: "rel_1", organizationId: ORG });
    const r = await buildCherryPickSubmitResponse(repo, VALID_INPUT);
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("repository_not_found");
  });

  it("403 when repository belongs to another org", async () => {
    const repo = makeRepo();
    repo._releases.set("rel_1", { id: "rel_1", organizationId: ORG });
    repo._repos.set("repo_1", { id: "repo_1", organizationId: "other" });
    const r = await buildCherryPickSubmitResponse(repo, VALID_INPUT);
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_repository");
  });

  it("201 on success — row inserted with status=requested", async () => {
    const repo = makeRepo();
    repo._releases.set("rel_1", { id: "rel_1", organizationId: ORG });
    repo._repos.set("repo_1", { id: "repo_1", organizationId: ORG });
    const r = await buildCherryPickSubmitResponse(repo, {
      ...VALID_INPUT,
      approvedPrIds: ["pr_1", "pr_2"],
      excludedPrIds: ["pr_99"],
    });
    expect(r.status).toBe(201);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.status).toBe("requested");
    expect(r.body.data.approvedCount).toBe(2);
    expect(r.body.data.excludedCount).toBe(1);
    expect(r.body.data.requestedByUserId).toBe("u_op");
    expect(repo._inserted).toHaveLength(1);
    expect(repo._inserted[0].approvedPrIds).toEqual(["pr_1", "pr_2"]);
  });

  it("503 migration_pending when CherryPickException table missing", async () => {
    const repo = makeRepo();
    repo._releases.set("rel_1", { id: "rel_1", organizationId: ORG });
    repo._repos.set("repo_1", { id: "repo_1", organizationId: ORG });
    repo.cherryPickException.create = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildCherryPickSubmitResponse(repo, VALID_INPUT);
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });

  it("500 internal_error surfaces correlationId", async () => {
    const repo = makeRepo();
    repo._releases.set("rel_1", { id: "rel_1", organizationId: ORG });
    repo._repos.set("repo_1", { id: "repo_1", organizationId: ORG });
    repo.cherryPickException.create = async () => { throw new Error("unexpected"); };
    const r = await buildCherryPickSubmitResponse(repo, VALID_INPUT, { correlationId: "abc-123" });
    expect(r.status).toBe(500);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("internal_error");
    expect(r.body.correlationId).toBe("abc-123");
  });
});
