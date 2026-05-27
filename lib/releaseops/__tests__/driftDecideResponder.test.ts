import { describe, expect, it } from "vitest";
import {
  buildDriftDecideResponse,
  type DriftDecideRepo,
  type DriftDecideRow,
} from "../driftDecideResponder";

function makeRepo(): DriftDecideRepo & {
  _rows: Map<string, DriftDecideRow>;
  _updates: Array<{ id: string; status: string }>;
} {
  const rows = new Map<string, DriftDecideRow>();
  const updates: Array<{ id: string; status: string }> = [];
  return {
    _rows: rows,
    _updates: updates,
    driftFinding: {
      async findUnique({ where }) { return rows.get(where.id) ?? null; },
      async update({ where, data }) {
        const ex = rows.get(where.id);
        if (ex) rows.set(where.id, { ...ex, status: data.status });
        updates.push({ id: where.id, status: data.status });
        return { id: where.id, status: data.status };
      },
    },
  };
}

function makeRow(over: Partial<DriftDecideRow> = {}): DriftDecideRow {
  return { id: "dr_1", organizationId: "o", status: "open", ...over };
}

const NOW = new Date("2026-05-25T12:00:00Z");

describe("buildDriftDecideResponse", () => {
  it("422 when suppress lacks reason", async () => {
    const repo = makeRepo();
    repo._rows.set("dr_1", makeRow());
    const r = await buildDriftDecideResponse(repo, {
      organizationId: "o", actorUserId: "u", findingId: "dr_1", action: "suppress", reason: "no",
    }, { now: NOW });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("suppress_reason_too_short");
  });

  it("404 when finding missing", async () => {
    const repo = makeRepo();
    const r = await buildDriftDecideResponse(repo, {
      organizationId: "o", actorUserId: "u", findingId: "missing", action: "acknowledge",
    }, { now: NOW });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("finding_not_found");
  });

  it("403 cross_org_finding", async () => {
    const repo = makeRepo();
    repo._rows.set("dr_1", makeRow({ organizationId: "other" }));
    const r = await buildDriftDecideResponse(repo, {
      organizationId: "o", actorUserId: "u", findingId: "dr_1", action: "resolve",
    }, { now: NOW });
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_finding");
  });

  it("409 already_terminal when finding already resolved", async () => {
    const repo = makeRepo();
    repo._rows.set("dr_1", makeRow({ status: "resolved" }));
    const r = await buildDriftDecideResponse(repo, {
      organizationId: "o", actorUserId: "u", findingId: "dr_1", action: "resolve",
    }, { now: NOW });
    expect(r.status).toBe(409);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("already_terminal");
  });

  it("409 illegal_transition when acknowledging an already-suppressed finding", async () => {
    const repo = makeRepo();
    repo._rows.set("dr_1", makeRow({ status: "suppressed" }));
    const r = await buildDriftDecideResponse(repo, {
      organizationId: "o", actorUserId: "u", findingId: "dr_1", action: "acknowledge",
    }, { now: NOW });
    expect(r.status).toBe(409);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("illegal_transition");
  });

  it("200 acknowledge: open → acknowledged", async () => {
    const repo = makeRepo();
    repo._rows.set("dr_1", makeRow());
    const r = await buildDriftDecideResponse(repo, {
      organizationId: "o", actorUserId: "u", findingId: "dr_1", action: "acknowledge",
    }, { now: NOW });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.status).toBe("acknowledged");
  });

  it("200 suppress with reason: open → suppressed", async () => {
    const repo = makeRepo();
    repo._rows.set("dr_1", makeRow());
    const r = await buildDriftDecideResponse(repo, {
      organizationId: "o", actorUserId: "u", findingId: "dr_1", action: "suppress",
      reason: "Intentional override per ops decision MFE-12.",
    }, { now: NOW });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.status).toBe("suppressed");
  });

  it("200 resolve from acknowledged state", async () => {
    const repo = makeRepo();
    repo._rows.set("dr_1", makeRow({ status: "acknowledged" }));
    const r = await buildDriftDecideResponse(repo, {
      organizationId: "o", actorUserId: "u", findingId: "dr_1", action: "resolve",
    }, { now: NOW });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.status).toBe("resolved");
  });

  it("503 migration_pending when table missing", async () => {
    const repo = makeRepo();
    repo.driftFinding.findUnique = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildDriftDecideResponse(repo, {
      organizationId: "o", actorUserId: "u", findingId: "dr_1", action: "acknowledge",
    }, { now: NOW });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
