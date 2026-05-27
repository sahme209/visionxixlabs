import { describe, expect, it } from "vitest";
import {
  buildCherryPickValidateResponse,
  type CherryPickValidateRepo,
  type ValidateRow,
} from "../cherryPickValidateResponder";

function makeRepo(): CherryPickValidateRepo & {
  _rows: Map<string, ValidateRow>;
  _updates: Array<{ id: string; hasFinalCommitValidation: boolean }>;
} {
  const rows = new Map<string, ValidateRow>();
  const updates: Array<{ id: string; hasFinalCommitValidation: boolean }> = [];
  return {
    _rows: rows,
    _updates: updates,
    cherryPickException: {
      async findUnique({ where }) { return rows.get(where.id) ?? null; },
      async update({ where, data }) {
        const ex = rows.get(where.id);
        if (ex) rows.set(where.id, { ...ex, hasFinalCommitValidation: data.hasFinalCommitValidation });
        updates.push({ id: where.id, hasFinalCommitValidation: data.hasFinalCommitValidation });
        return { id: where.id, hasFinalCommitValidation: data.hasFinalCommitValidation };
      },
    },
  };
}

function makeRow(over: Partial<ValidateRow> = {}): ValidateRow {
  return { id: "cpe_1", organizationId: "o", status: "approved", hasFinalCommitValidation: false, ...over };
}

describe("buildCherryPickValidateResponse", () => {
  it("404 when exception missing", async () => {
    const repo = makeRepo();
    const r = await buildCherryPickValidateResponse(repo, {
      organizationId: "o", actorUserId: "u", exceptionId: "missing", validated: true,
    });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("exception_not_found");
  });

  it("403 cross_org_exception", async () => {
    const repo = makeRepo();
    repo._rows.set("cpe_1", makeRow({ organizationId: "other" }));
    const r = await buildCherryPickValidateResponse(repo, {
      organizationId: "o", actorUserId: "u", exceptionId: "cpe_1", validated: true,
    });
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_exception");
  });

  it("409 not_approved when exception is still requested", async () => {
    const repo = makeRepo();
    repo._rows.set("cpe_1", makeRow({ status: "requested" }));
    const r = await buildCherryPickValidateResponse(repo, {
      organizationId: "o", actorUserId: "u", exceptionId: "cpe_1", validated: true,
    });
    expect(r.status).toBe(409);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("not_approved");
  });

  it("409 not_approved when exception is denied", async () => {
    const repo = makeRepo();
    repo._rows.set("cpe_1", makeRow({ status: "denied" }));
    const r = await buildCherryPickValidateResponse(repo, {
      organizationId: "o", actorUserId: "u", exceptionId: "cpe_1", validated: true,
    });
    expect(r.status).toBe(409);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("not_approved");
  });

  it("200 marks final commit validation when approved", async () => {
    const repo = makeRepo();
    repo._rows.set("cpe_1", makeRow({ status: "approved", hasFinalCommitValidation: false }));
    const r = await buildCherryPickValidateResponse(repo, {
      organizationId: "o", actorUserId: "u", exceptionId: "cpe_1", validated: true,
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.hasFinalCommitValidation).toBe(true);
    expect(repo._updates).toHaveLength(1);
  });

  it("200 unmarks when caller passes validated:false", async () => {
    const repo = makeRepo();
    repo._rows.set("cpe_1", makeRow({ status: "approved", hasFinalCommitValidation: true }));
    const r = await buildCherryPickValidateResponse(repo, {
      organizationId: "o", actorUserId: "u", exceptionId: "cpe_1", validated: false,
    });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.hasFinalCommitValidation).toBe(false);
  });

  it("no_change when already in the requested state", async () => {
    const repo = makeRepo();
    repo._rows.set("cpe_1", makeRow({ status: "approved", hasFinalCommitValidation: true }));
    const r = await buildCherryPickValidateResponse(repo, {
      organizationId: "o", actorUserId: "u", exceptionId: "cpe_1", validated: true,
    });
    if (r.body.ok) throw new Error("expected no_change");
    expect(r.body.error).toBe("no_change");
    expect(repo._updates).toEqual([]);
  });

  it("503 migration_pending when table missing", async () => {
    const repo = makeRepo();
    repo.cherryPickException.findUnique = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildCherryPickValidateResponse(repo, {
      organizationId: "o", actorUserId: "u", exceptionId: "cpe_1", validated: true,
    });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
