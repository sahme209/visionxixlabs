import { describe, expect, it } from "vitest";
import {
  appendAuditEvent,
  buildAuditEventListResponse,
  type AuditEventRepo,
  type AuditEventRow,
} from "../auditEventResponder";

interface Stub extends AuditEventRepo {
  _rows: AuditEventRow[];
  _nextId: number;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _rows: [],
    _nextId: 1,
    auditEvent: {
      async create({ data }) {
        const row: AuditEventRow = {
          id: `evt_${stub._nextId++}`,
          organizationId: data.organizationId,
          kind: data.kind,
          subjectKind: data.subjectKind,
          subjectId: data.subjectId,
          outcome: data.outcome,
          summary: data.summary,
          detailJson: data.detailJson ?? null,
          actorUserId: data.actorUserId,
          correlationId: data.correlationId,
          createdAt: new Date(Date.now() + stub._rows.length),
        };
        stub._rows.push(row);
        return row;
      },
      async findMany({ where, take }) {
        const out = stub._rows.filter((r) => {
          if (r.organizationId !== where.organizationId) return false;
          if (where.kind !== undefined && r.kind !== where.kind) return false;
          if (where.subjectKind !== undefined && r.subjectKind !== where.subjectKind) return false;
          if (where.subjectId !== undefined && r.subjectId !== where.subjectId) return false;
          return true;
        }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return take ? out.slice(0, take) : out;
      },
    },
  };
  return stub;
}

describe("appendAuditEvent", () => {
  it("inserts an event and returns true", async () => {
    const repo = makeRepo();
    const ok = await appendAuditEvent(repo, {
      organizationId: "o", kind: "release.transition",
      subjectKind: "release", subjectId: "rel_1",
      summary: "draft → ready",
    });
    expect(ok).toBe(true);
    expect(repo._rows).toHaveLength(1);
    expect(repo._rows[0].outcome).toBe("ok");
    expect(repo._rows[0].actorUserId).toBeNull();
  });

  it("accepts detail JSON + actor + correlationId", async () => {
    const repo = makeRepo();
    await appendAuditEvent(repo, {
      organizationId: "o", kind: "manual_fix.reconcile",
      subjectKind: "manual_fix", subjectId: "fix_1",
      summary: "reconciled with PR #42",
      detailJson: { ref: "PR #42" },
      actorUserId: "u1",
      correlationId: "req_abc",
    });
    expect(repo._rows[0].actorUserId).toBe("u1");
    expect(repo._rows[0].correlationId).toBe("req_abc");
    expect(repo._rows[0].detailJson).toEqual({ ref: "PR #42" });
  });

  it("swallows errors and returns false", async () => {
    const repo = makeRepo();
    repo.auditEvent.create = async () => { throw new Error("boom"); };
    const ok = await appendAuditEvent(repo, {
      organizationId: "o", kind: "x", subjectKind: "release", subjectId: "r", summary: "s",
    });
    expect(ok).toBe(false);
  });
});

describe("buildAuditEventListResponse", () => {
  it("200 empty when no events", async () => {
    const repo = makeRepo();
    const r = await buildAuditEventListResponse(repo, { organizationId: "o" });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.events).toHaveLength(0);
    expect(r.body.data.summary.total).toBe(0);
  });

  it("200 returns chronological inbox newest first", async () => {
    const repo = makeRepo();
    await appendAuditEvent(repo, { organizationId: "o", kind: "a", subjectKind: "release", subjectId: "r1", summary: "first" });
    await appendAuditEvent(repo, { organizationId: "o", kind: "b", subjectKind: "release", subjectId: "r2", summary: "second" });
    await appendAuditEvent(repo, { organizationId: "o", kind: "c", subjectKind: "release", subjectId: "r3", summary: "third" });
    const r = await buildAuditEventListResponse(repo, { organizationId: "o" });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.events.map((e) => e.summary)).toEqual(["third", "second", "first"]);
  });

  it("200 isolates by org", async () => {
    const repo = makeRepo();
    await appendAuditEvent(repo, { organizationId: "o1", kind: "a", subjectKind: "release", subjectId: "r", summary: "x" });
    await appendAuditEvent(repo, { organizationId: "o2", kind: "a", subjectKind: "release", subjectId: "r", summary: "y" });
    const r = await buildAuditEventListResponse(repo, { organizationId: "o1" });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.events).toHaveLength(1);
    expect(r.body.data.events[0].summary).toBe("x");
  });

  it("200 narrows by subject", async () => {
    const repo = makeRepo();
    await appendAuditEvent(repo, { organizationId: "o", kind: "a", subjectKind: "release", subjectId: "r1", summary: "x" });
    await appendAuditEvent(repo, { organizationId: "o", kind: "b", subjectKind: "release", subjectId: "r2", summary: "y" });
    await appendAuditEvent(repo, { organizationId: "o", kind: "c", subjectKind: "manual_fix", subjectId: "r1", summary: "z" });
    const r = await buildAuditEventListResponse(repo, {
      organizationId: "o", subjectKind: "release", subjectId: "r1",
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.events).toHaveLength(1);
    expect(r.body.data.events[0].subjectId).toBe("r1");
    expect(r.body.data.events[0].subjectKind).toBe("release");
  });

  it("200 reports byOutcome + byKind summary", async () => {
    const repo = makeRepo();
    await appendAuditEvent(repo, { organizationId: "o", kind: "a", subjectKind: "release", subjectId: "1", summary: "x", outcome: "ok" });
    await appendAuditEvent(repo, { organizationId: "o", kind: "a", subjectKind: "release", subjectId: "2", summary: "y", outcome: "rejected" });
    await appendAuditEvent(repo, { organizationId: "o", kind: "b", subjectKind: "release", subjectId: "3", summary: "z", outcome: "ok" });
    const r = await buildAuditEventListResponse(repo, { organizationId: "o" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.summary.total).toBe(3);
    expect(r.body.data.summary.byOutcome).toEqual({ ok: 2, rejected: 1 });
    expect(r.body.data.summary.byKind).toEqual({ a: 2, b: 1 });
  });

  it("503 migration_pending", async () => {
    const repo = makeRepo();
    repo.auditEvent.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildAuditEventListResponse(repo, { organizationId: "o" });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });

  it("falls back to 'unknown' for unrecognized closed-union strings", async () => {
    const repo = makeRepo();
    await appendAuditEvent(repo, {
      organizationId: "o", kind: "x", subjectKind: "frob" as never, subjectId: "1", summary: "x", outcome: "weird",
    });
    const r = await buildAuditEventListResponse(repo, { organizationId: "o" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.events[0].subjectKind).toBe("unknown");
    expect(r.body.data.events[0].outcome).toBe("unknown");
  });
});
