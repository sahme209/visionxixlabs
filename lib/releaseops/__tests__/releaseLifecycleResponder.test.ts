import { describe, expect, it } from "vitest";
import {
  buildReleaseLifecycleResponse,
  applyTransition,
  type ReleaseLifecycleRepo,
  type LifecycleReleaseRow,
} from "../releaseLifecycleResponder";

function makeRepo(): ReleaseLifecycleRepo & {
  _rows: Map<string, LifecycleReleaseRow>;
  _updates: Array<{ id: string; status: string }>;
} {
  const rows = new Map<string, LifecycleReleaseRow>();
  const updates: Array<{ id: string; status: string }> = [];
  return {
    _rows: rows,
    _updates: updates,
    release: {
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

function makeRow(over: Partial<LifecycleReleaseRow> = {}): LifecycleReleaseRow {
  return { id: "rel_1", organizationId: "o", status: "draft", releaseTag: "v1.0.0", ...over };
}

const NOW = new Date("2026-05-27T12:00:00Z");

describe("applyTransition (pure)", () => {
  const ctx = { actorUserId: "u_op", now: NOW };

  it("draft → ready via finalize_scope (records scope finalization)", () => {
    const r = applyTransition("draft", "finalize_scope", ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("ok");
    expect(r.next).toBe("ready");
    expect(r.fieldsToSet.scopeFinalizedAt).toBe(NOW);
    expect(r.fieldsToSet.scopeFinalizedByUserId).toBe("u_op");
  });

  it("ready → deploying via start_deploy (records actualDeployStart)", () => {
    const r = applyTransition("ready", "start_deploy", ctx);
    if (!r.ok) throw new Error("ok");
    expect(r.next).toBe("deploying");
    expect(r.fieldsToSet.actualDeployStart).toBe(NOW);
  });

  it("deploying → deployed via complete_deploy (records actualDeployEnd)", () => {
    const r = applyTransition("deploying", "complete_deploy", ctx);
    if (!r.ok) throw new Error("ok");
    expect(r.next).toBe("deployed");
    expect(r.fieldsToSet.actualDeployEnd).toBe(NOW);
  });

  it("deployed → rolled_back via mark_rolled_back", () => {
    const r = applyTransition("deployed", "mark_rolled_back", ctx);
    if (!r.ok) throw new Error("ok");
    expect(r.next).toBe("rolled_back");
  });

  it("ready → failed via mark_failed", () => {
    const r = applyTransition("ready", "mark_failed", ctx);
    if (!r.ok) throw new Error("ok");
    expect(r.next).toBe("failed");
  });

  it("rejects illegal transitions", () => {
    expect(applyTransition("draft", "start_deploy", ctx).ok).toBe(false);
    expect(applyTransition("deployed", "finalize_scope", ctx).ok).toBe(false);
    expect(applyTransition("rolled_back", "complete_deploy", ctx).ok).toBe(false);
    expect(applyTransition("draft", "mark_rolled_back", ctx).ok).toBe(false);
  });
});

describe("buildReleaseLifecycleResponse", () => {
  it("404 when release missing", async () => {
    const repo = makeRepo();
    const r = await buildReleaseLifecycleResponse(repo, {
      organizationId: "o", actorUserId: "u", releaseId: "missing", action: "finalize_scope",
    }, { now: NOW });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("release_not_found");
  });

  it("403 cross_org_release", async () => {
    const repo = makeRepo();
    repo._rows.set("rel_1", makeRow({ organizationId: "other" }));
    const r = await buildReleaseLifecycleResponse(repo, {
      organizationId: "o", actorUserId: "u", releaseId: "rel_1", action: "finalize_scope",
    }, { now: NOW });
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_release");
  });

  it("409 unknown_current_status when row carries an out-of-union value", async () => {
    const repo = makeRepo();
    repo._rows.set("rel_1", makeRow({ status: "weirdvalue" }));
    const r = await buildReleaseLifecycleResponse(repo, {
      organizationId: "o", actorUserId: "u", releaseId: "rel_1", action: "finalize_scope",
    }, { now: NOW });
    expect(r.status).toBe(409);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("unknown_current_status");
  });

  it("409 illegal_transition when action doesn't fit current status", async () => {
    const repo = makeRepo();
    repo._rows.set("rel_1", makeRow({ status: "draft" }));
    const r = await buildReleaseLifecycleResponse(repo, {
      organizationId: "o", actorUserId: "u", releaseId: "rel_1", action: "complete_deploy",
    }, { now: NOW });
    expect(r.status).toBe(409);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("illegal_transition");
  });

  it("200 valid transition records previousStatus + new status", async () => {
    const repo = makeRepo();
    repo._rows.set("rel_1", makeRow({ status: "draft" }));
    const r = await buildReleaseLifecycleResponse(repo, {
      organizationId: "o", actorUserId: "u_captain", releaseId: "rel_1", action: "finalize_scope",
    }, { now: NOW });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.previousStatus).toBe("draft");
    expect(r.body.data.status).toBe("ready");
    expect(r.body.data.actorUserId).toBe("u_captain");
    expect(repo._updates[0]).toEqual({ id: "rel_1", status: "ready" });
  });

  it("503 migration_pending when release table missing", async () => {
    const repo = makeRepo();
    repo.release.findUnique = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildReleaseLifecycleResponse(repo, {
      organizationId: "o", actorUserId: "u", releaseId: "rel_1", action: "finalize_scope",
    }, { now: NOW });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
