import { describe, expect, it } from "vitest";
import {
  buildManualFixListResponse,
  buildManualFixLogResponse,
  buildManualFixReconcileResponse,
  type ManualFixRepo,
  type ManualFixRow,
} from "../manualFixResponder";

interface Stub extends ManualFixRepo {
  _rows: ManualFixRow[];
  _nextId: number;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _rows: [],
    _nextId: 1,
    manualFix: {
      async findMany({ where, take }) {
        const out = stub._rows.filter((r) => {
          if (r.organizationId !== where.organizationId) return false;
          if (where.releaseId !== undefined && r.releaseId !== where.releaseId) return false;
          return true;
        }).sort((a, b) => b.fixedAtIso.getTime() - a.fixedAtIso.getTime());
        return take ? out.slice(0, take) : out;
      },
      async findUnique({ where }) {
        return stub._rows.find((r) => r.id === where.id) ?? null;
      },
      async create({ data }) {
        const now = new Date();
        const row: ManualFixRow = {
          id: `fix_${stub._nextId++}`,
          organizationId: data.organizationId,
          releaseId: data.releaseId,
          summary: data.summary,
          status: data.status,
          environmentTier: data.environmentTier,
          fixedAtIso: data.fixedAtIso,
          loggedByUserId: data.loggedByUserId,
          reconciledByUserId: null,
          reconciledAt: null,
          reconciliationRef: null,
          createdAt: now,
          updatedAt: now,
        };
        stub._rows.push(row);
        return row;
      },
      async update({ where, data }) {
        const idx = stub._rows.findIndex((r) => r.id === where.id);
        if (idx < 0) throw new Error("not found");
        stub._rows[idx] = {
          ...stub._rows[idx],
          status: data.status,
          reconciledByUserId: data.reconciledByUserId,
          reconciledAt: data.reconciledAt,
          reconciliationRef: data.reconciliationRef,
          updatedAt: new Date(),
        };
        return stub._rows[idx];
      },
    },
  };
  return stub;
}

describe("buildManualFixLogResponse", () => {
  it("422 summary_required for empty summary", async () => {
    const repo = makeRepo();
    const r = await buildManualFixLogResponse(repo, {
      organizationId: "o", loggedByUserId: "u",
      summary: "   ", fixedAtIso: "2026-05-26T12:00:00Z", environmentTier: "prod",
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("summary_required");
  });

  it("422 fixed_at_invalid for unparseable date", async () => {
    const repo = makeRepo();
    const r = await buildManualFixLogResponse(repo, {
      organizationId: "o", loggedByUserId: "u",
      summary: "patched the broken cron job", fixedAtIso: "nope", environmentTier: "prod",
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("fixed_at_invalid");
  });

  it("422 tier_invalid for unknown tier", async () => {
    const repo = makeRepo();
    const r = await buildManualFixLogResponse(repo, {
      organizationId: "o", loggedByUserId: "u",
      summary: "patched x", fixedAtIso: "2026-05-26T12:00:00Z", environmentTier: "qa",
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("tier_invalid");
  });

  it("201 creates pending fix with logged user attached", async () => {
    const repo = makeRepo();
    const r = await buildManualFixLogResponse(repo, {
      organizationId: "o", loggedByUserId: "u1",
      summary: "Bumped redis maxmemory by hand on web-prod-1.",
      fixedAtIso: "2026-05-26T12:00:00Z", environmentTier: "prod",
      releaseId: "rel_1",
    });
    expect(r.status).toBe(201);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.fix.status).toBe("pending");
    expect(r.body.data.fix.environmentTier).toBe("prod");
    expect(r.body.data.fix.loggedByUserId).toBe("u1");
    expect(r.body.data.fix.releaseId).toBe("rel_1");
    expect(r.body.data.fix.reconciledAtIso).toBeNull();
  });
});

describe("buildManualFixListResponse", () => {
  it("200 empty when org has no fixes", async () => {
    const repo = makeRepo();
    const r = await buildManualFixListResponse(repo, { organizationId: "o" });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.fixes).toHaveLength(0);
    expect(r.body.data.summary).toEqual({ total: 0, pending: 0, reconciled: 0, wontFix: 0, pendingProd: 0 });
  });

  it("200 lists fixes with pending-prod count", async () => {
    const repo = makeRepo();
    await buildManualFixLogResponse(repo, {
      organizationId: "o", loggedByUserId: "u", summary: "a",
      fixedAtIso: "2026-05-25T12:00:00Z", environmentTier: "prod",
    });
    await buildManualFixLogResponse(repo, {
      organizationId: "o", loggedByUserId: "u", summary: "b",
      fixedAtIso: "2026-05-26T12:00:00Z", environmentTier: "staging",
    });
    await buildManualFixLogResponse(repo, {
      organizationId: "o", loggedByUserId: "u", summary: "c",
      fixedAtIso: "2026-05-26T13:00:00Z", environmentTier: "prod",
    });
    const r = await buildManualFixListResponse(repo, { organizationId: "o" });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.fixes).toHaveLength(3);
    // sorted by fixedAtIso desc
    expect(r.body.data.fixes[0].summary).toBe("c");
    expect(r.body.data.summary.total).toBe(3);
    expect(r.body.data.summary.pending).toBe(3);
    expect(r.body.data.summary.pendingProd).toBe(2);
  });

  it("200 isolates by org", async () => {
    const repo = makeRepo();
    await buildManualFixLogResponse(repo, {
      organizationId: "o1", loggedByUserId: "u", summary: "a",
      fixedAtIso: "2026-05-25T12:00:00Z", environmentTier: "prod",
    });
    await buildManualFixLogResponse(repo, {
      organizationId: "o2", loggedByUserId: "u", summary: "b",
      fixedAtIso: "2026-05-26T12:00:00Z", environmentTier: "prod",
    });
    const r = await buildManualFixListResponse(repo, { organizationId: "o1" });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.fixes).toHaveLength(1);
    expect(r.body.data.fixes[0].summary).toBe("a");
  });
});

describe("buildManualFixReconcileResponse", () => {
  it("422 outcome_invalid for unsupported outcome", async () => {
    const repo = makeRepo();
    const r = await buildManualFixReconcileResponse(repo, {
      organizationId: "o", actorUserId: "u", fixId: "x", outcome: "nope" as never,
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("outcome_invalid");
  });

  it("404 fix_not_found", async () => {
    const repo = makeRepo();
    const r = await buildManualFixReconcileResponse(repo, {
      organizationId: "o", actorUserId: "u", fixId: "missing", outcome: "reconciled",
    });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("fix_not_found");
  });

  it("403 wrong_org when fix belongs to another tenant", async () => {
    const repo = makeRepo();
    const created = await buildManualFixLogResponse(repo, {
      organizationId: "o1", loggedByUserId: "u", summary: "a",
      fixedAtIso: "2026-05-26T12:00:00Z", environmentTier: "prod",
    });
    if (!created.body.ok) throw new Error("setup failed");
    const r = await buildManualFixReconcileResponse(repo, {
      organizationId: "o2", actorUserId: "u", fixId: created.body.data.fix.id, outcome: "reconciled",
    });
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("wrong_org");
  });

  it("200 reconciles pending fix and persists ref", async () => {
    const repo = makeRepo();
    const created = await buildManualFixLogResponse(repo, {
      organizationId: "o", loggedByUserId: "u", summary: "patched a",
      fixedAtIso: "2026-05-26T12:00:00Z", environmentTier: "prod",
    });
    if (!created.body.ok) throw new Error("setup failed");
    const r = await buildManualFixReconcileResponse(repo, {
      organizationId: "o", actorUserId: "u2",
      fixId: created.body.data.fix.id, outcome: "reconciled",
      reconciliationRef: "PR #4123",
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.fix.status).toBe("reconciled");
    expect(r.body.data.fix.reconciledByUserId).toBe("u2");
    expect(r.body.data.fix.reconciliationRef).toBe("PR #4123");
    expect(r.body.data.fix.reconciledAtIso).not.toBeNull();
  });

  it("409 not_pending when fix already reconciled", async () => {
    const repo = makeRepo();
    const created = await buildManualFixLogResponse(repo, {
      organizationId: "o", loggedByUserId: "u", summary: "patched a",
      fixedAtIso: "2026-05-26T12:00:00Z", environmentTier: "prod",
    });
    if (!created.body.ok) throw new Error("setup failed");
    await buildManualFixReconcileResponse(repo, {
      organizationId: "o", actorUserId: "u", fixId: created.body.data.fix.id, outcome: "reconciled",
    });
    const r = await buildManualFixReconcileResponse(repo, {
      organizationId: "o", actorUserId: "u", fixId: created.body.data.fix.id, outcome: "wont_fix",
    });
    expect(r.status).toBe(409);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("not_pending");
  });
});

describe("migration_pending", () => {
  it("list returns 503", async () => {
    const repo = makeRepo();
    repo.manualFix.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildManualFixListResponse(repo, { organizationId: "o" });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });

  it("log returns 503", async () => {
    const repo = makeRepo();
    repo.manualFix.create = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildManualFixLogResponse(repo, {
      organizationId: "o", loggedByUserId: "u",
      summary: "a", fixedAtIso: "2026-05-26T12:00:00Z", environmentTier: "prod",
    });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
