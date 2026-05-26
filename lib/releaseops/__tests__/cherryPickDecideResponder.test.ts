import { describe, expect, it } from "vitest";
import {
  buildCherryPickDecideResponse,
  type CherryPickDecideRepo,
  type CherryPickDecideRow,
  type CherryPickDecideUpdated,
} from "../cherryPickDecideResponder";

function makeRepo(): CherryPickDecideRepo & {
  _rows: Map<string, CherryPickDecideRow>;
  _updates: CherryPickDecideUpdated[];
} {
  const rows = new Map<string, CherryPickDecideRow>();
  const updates: CherryPickDecideUpdated[] = [];
  return {
    _rows: rows,
    _updates: updates,
    cherryPickException: {
      async findUnique({ where }) { return rows.get(where.id) ?? null; },
      async update({ where, data }) {
        const existing = rows.get(where.id);
        if (!existing) throw new Error("not found");
        const updated: CherryPickDecideUpdated = {
          id: existing.id,
          status: data.status,
          decidedByUserId: data.decidedByUserId,
          decidedAt: data.decidedAt,
          decisionReason: data.decisionReason,
        };
        rows.set(where.id, { ...existing, status: data.status });
        updates.push(updated);
        return updated;
      },
    },
  };
}

function makeRow(over: Partial<CherryPickDecideRow> = {}): CherryPickDecideRow {
  return { id: "cpe_1", organizationId: "o", status: "requested", requestedByUserId: "u_op", ...over };
}

const NOW = new Date("2026-05-25T12:00:00Z");

describe("buildCherryPickDecideResponse", () => {
  it("422 deny_reason_too_short when deny lacks reason", async () => {
    const repo = makeRepo();
    repo._rows.set("cpe_1", makeRow());
    const r = await buildCherryPickDecideResponse(
      repo,
      { organizationId: "o", approverUserId: "u_app", exceptionId: "cpe_1", decision: "deny", reason: "no" },
      { now: NOW },
    );
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("deny_reason_too_short");
  });

  it("404 when exception missing", async () => {
    const repo = makeRepo();
    const r = await buildCherryPickDecideResponse(
      repo,
      { organizationId: "o", approverUserId: "u_app", exceptionId: "missing", decision: "approve" },
      { now: NOW },
    );
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("exception_not_found");
  });

  it("403 cross_org_exception", async () => {
    const repo = makeRepo();
    repo._rows.set("cpe_1", makeRow({ organizationId: "other" }));
    const r = await buildCherryPickDecideResponse(
      repo,
      { organizationId: "o", approverUserId: "u_app", exceptionId: "cpe_1", decision: "approve" },
      { now: NOW },
    );
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_exception");
  });

  it("403 two_person_rule_violation when approver == requester", async () => {
    const repo = makeRepo();
    repo._rows.set("cpe_1", makeRow({ requestedByUserId: "u_same" }));
    const r = await buildCherryPickDecideResponse(
      repo,
      { organizationId: "o", approverUserId: "u_same", exceptionId: "cpe_1", decision: "approve" },
      { now: NOW },
    );
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("two_person_rule_violation");
  });

  it("409 illegal_transition when row already approved", async () => {
    const repo = makeRepo();
    repo._rows.set("cpe_1", makeRow({ status: "approved" }));
    const r = await buildCherryPickDecideResponse(
      repo,
      { organizationId: "o", approverUserId: "u_app", exceptionId: "cpe_1", decision: "approve" },
      { now: NOW },
    );
    expect(r.status).toBe(409);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("illegal_transition");
  });

  it("409 unknown_current_status when row carries an unknown status", async () => {
    const repo = makeRepo();
    repo._rows.set("cpe_1", makeRow({ status: "weird" }));
    const r = await buildCherryPickDecideResponse(
      repo,
      { organizationId: "o", approverUserId: "u_app", exceptionId: "cpe_1", decision: "approve" },
      { now: NOW },
    );
    expect(r.status).toBe(409);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("unknown_current_status");
  });

  it("200 approve transitions requested → approved", async () => {
    const repo = makeRepo();
    repo._rows.set("cpe_1", makeRow());
    const r = await buildCherryPickDecideResponse(
      repo,
      { organizationId: "o", approverUserId: "u_app", exceptionId: "cpe_1", decision: "approve" },
      { now: NOW },
    );
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.status).toBe("approved");
    expect(r.body.data.decidedByUserId).toBe("u_app");
    expect(r.body.data.decidedAtIso).toBe(NOW.toISOString());
    expect(r.body.data.decisionReason).toBeNull();
    expect(repo._updates).toHaveLength(1);
  });

  it("200 deny transitions requested → denied with reason persisted", async () => {
    const repo = makeRepo();
    repo._rows.set("cpe_1", makeRow());
    const r = await buildCherryPickDecideResponse(
      repo,
      {
        organizationId: "o", approverUserId: "u_app", exceptionId: "cpe_1",
        decision: "deny", reason: "Scope too broad — drop the auth changes first.",
      },
      { now: NOW },
    );
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.status).toBe("denied");
    expect(r.body.data.decisionReason).toContain("Scope too broad");
  });

  it("503 migration_pending when table missing", async () => {
    const repo = makeRepo();
    repo.cherryPickException.findUnique = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildCherryPickDecideResponse(
      repo,
      { organizationId: "o", approverUserId: "u_app", exceptionId: "cpe_1", decision: "approve" },
      { now: NOW },
    );
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
