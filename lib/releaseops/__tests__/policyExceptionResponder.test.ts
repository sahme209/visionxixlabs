import { describe, expect, it } from "vitest";
import {
  buildPolicyExceptionResponse,
  type PolicyExceptionRepo,
  type ExceptionViolationRow,
} from "../policyExceptionResponder";

function makeRepo(): PolicyExceptionRepo & {
  _rows: Map<string, ExceptionViolationRow>;
  _updates: Array<{ id: string; status: string }>;
} {
  const rows = new Map<string, ExceptionViolationRow>();
  const updates: Array<{ id: string; status: string }> = [];
  return {
    _rows: rows,
    _updates: updates,
    policyViolation: {
      async findUnique({ where }) { return rows.get(where.id) ?? null; },
      async update({ where, data }) {
        const existing = rows.get(where.id);
        if (!existing) throw new Error("not found");
        const next: ExceptionViolationRow = { ...existing, status: data.status };
        rows.set(where.id, next);
        updates.push({ id: where.id, status: data.status });
        return {
          id: where.id,
          status: data.status,
          exceptionGrantedByUserId: data.exceptionGrantedByUserId ?? null,
          exceptionGrantedAt: data.exceptionGrantedAt ?? null,
        };
      },
    },
  };
}

function makeRow(over: Partial<ExceptionViolationRow> = {}): ExceptionViolationRow {
  return {
    id: "pv_1",
    organizationId: "o",
    status: "open",
    rule: { key: "min_approvals", exceptionAllowed: true },
    ...over,
  };
}

const NOW = new Date("2026-05-25T12:00:00Z");

describe("buildPolicyExceptionResponse", () => {
  it("422 reason_too_short when grant lacks justification", async () => {
    const repo = makeRepo();
    repo._rows.set("pv_1", makeRow());
    const r = await buildPolicyExceptionResponse(repo, {
      organizationId: "o", actorUserId: "u", violationId: "pv_1", action: "grant_exception", reason: "too short",
    }, { now: NOW });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("reason_too_short");
  });

  it("404 violation missing", async () => {
    const repo = makeRepo();
    const r = await buildPolicyExceptionResponse(repo, {
      organizationId: "o", actorUserId: "u", violationId: "missing", action: "resolve",
    }, { now: NOW });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("violation_not_found");
  });

  it("403 cross_org_violation", async () => {
    const repo = makeRepo();
    repo._rows.set("pv_1", makeRow({ organizationId: "other" }));
    const r = await buildPolicyExceptionResponse(repo, {
      organizationId: "o", actorUserId: "u", violationId: "pv_1", action: "resolve",
    }, { now: NOW });
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_violation");
  });

  it("409 already_terminal when violation already resolved", async () => {
    const repo = makeRepo();
    repo._rows.set("pv_1", makeRow({ status: "resolved" }));
    const r = await buildPolicyExceptionResponse(repo, {
      organizationId: "o", actorUserId: "u", violationId: "pv_1", action: "resolve",
    }, { now: NOW });
    expect(r.status).toBe(409);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("already_terminal");
  });

  it("422 rule_not_exception_eligible when rule.exceptionAllowed=false", async () => {
    const repo = makeRepo();
    repo._rows.set("pv_1", makeRow({ rule: { key: "hard_rule", exceptionAllowed: false } }));
    const r = await buildPolicyExceptionResponse(repo, {
      organizationId: "o", actorUserId: "u", violationId: "pv_1", action: "grant_exception",
      reason: "Hot-fix scope verified by security",
    }, { now: NOW });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("rule_not_exception_eligible");
  });

  it("200 grant_exception transitions open → exception_granted with approver metadata", async () => {
    const repo = makeRepo();
    repo._rows.set("pv_1", makeRow());
    const r = await buildPolicyExceptionResponse(repo, {
      organizationId: "o", actorUserId: "u_approver", violationId: "pv_1",
      action: "grant_exception", reason: "Reviewed with security team, ok to ship.",
    }, { now: NOW });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.status).toBe("exception_granted");
    expect(r.body.data.exceptionGrantedByUserId).toBe("u_approver");
    expect(r.body.data.exceptionGrantedAtIso).toBe(NOW.toISOString());
  });

  it("200 resolve transitions open → resolved without exception fields", async () => {
    const repo = makeRepo();
    repo._rows.set("pv_1", makeRow());
    const r = await buildPolicyExceptionResponse(repo, {
      organizationId: "o", actorUserId: "u", violationId: "pv_1", action: "resolve",
    }, { now: NOW });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.status).toBe("resolved");
  });

  it("503 migration_pending when table missing", async () => {
    const repo = makeRepo();
    repo.policyViolation.findUnique = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildPolicyExceptionResponse(repo, {
      organizationId: "o", actorUserId: "u", violationId: "pv_1", action: "resolve",
    }, { now: NOW });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
