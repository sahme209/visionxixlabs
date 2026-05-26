import { describe, expect, it } from "vitest";
import {
  buildReleaseFreezeListResponse,
  classify,
  type FreezeReleaseRow,
  type ReleaseFreezeListRepo,
} from "../releaseFreezeListResponder";

function makeRepo(): ReleaseFreezeListRepo & { _rows: FreezeReleaseRow[] } {
  const rows: FreezeReleaseRow[] = [];
  return {
    _rows: rows,
    release: {
      async findMany({ where }) {
        return rows
          .filter((r) => r.organizationId === where.organizationId)
          .slice()
          .sort((a, b) => (b.releaseTag ?? "").localeCompare(a.releaseTag ?? ""));
      },
    },
  };
}

function makeRow(over: Partial<FreezeReleaseRow> = {}): FreezeReleaseRow {
  return {
    id: "rel_1",
    organizationId: "o",
    applicationId: "app_checkout",
    releaseTag: "v1.0.0",
    status: "ready",
    scopeFinalizedAt: null,
    scopeFinalizedByUserId: null,
    plannedWindowStart: null,
    plannedWindowEnd: null,
    actualDeployStart: null,
    actualDeployEnd: null,
    ...over,
  };
}

describe("classify", () => {
  const now = new Date("2026-05-25T12:00:00Z");

  it("not_yet_finalized when scopeFinalizedAt is null", () => {
    const r = classify(makeRow(), now);
    expect(r.status).toBe("not_yet_finalized");
    expect(r.hoursSinceScopeFinalized).toBeNull();
  });

  it("frozen when scope finalized but deploy not started", () => {
    const r = classify(
      makeRow({ scopeFinalizedAt: new Date("2026-05-25T10:00:00Z"), scopeFinalizedByUserId: "u_op" }),
      now,
    );
    expect(r.status).toBe("frozen");
    expect(r.hoursSinceScopeFinalized).toBe(2);
    expect(r.scopeFinalizedByUserId).toBe("u_op");
  });

  it("deploy_window_started when actualDeployStart is set", () => {
    const r = classify(
      makeRow({
        scopeFinalizedAt: new Date("2026-05-25T08:00:00Z"),
        actualDeployStart: new Date("2026-05-25T11:00:00Z"),
      }),
      now,
    );
    expect(r.status).toBe("deploy_window_started");
    expect(r.hoursSinceScopeFinalized).toBe(3);
  });
});

describe("buildReleaseFreezeListResponse", () => {
  it("empty org → 200 ok, summary buckets zeroed", async () => {
    const repo = makeRepo();
    const r = await buildReleaseFreezeListResponse(repo, "o", { now: new Date("2026-05-25T12:00:00Z") });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.releases).toEqual([]);
    expect(r.body.data.summary).toEqual({
      total: 0,
      byStatus: { not_yet_finalized: 0, frozen: 0, deploy_window_started: 0 },
    });
  });

  it("populated org → rows classified, summary buckets reflect mix", async () => {
    const repo = makeRepo();
    repo._rows.push(makeRow({ id: "a", releaseTag: "v2.0.0" }));
    repo._rows.push(makeRow({ id: "b", releaseTag: "v1.9.0", scopeFinalizedAt: new Date("2026-05-25T10:00:00Z") }));
    repo._rows.push(
      makeRow({
        id: "c",
        releaseTag: "v1.8.0",
        scopeFinalizedAt: new Date("2026-05-25T08:00:00Z"),
        actualDeployStart: new Date("2026-05-25T11:30:00Z"),
      }),
    );

    const r = await buildReleaseFreezeListResponse(repo, "o", { now: new Date("2026-05-25T12:00:00Z") });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.releases).toHaveLength(3);
    expect(r.body.data.summary).toEqual({
      total: 3,
      byStatus: { not_yet_finalized: 1, frozen: 1, deploy_window_started: 1 },
    });
  });

  it("migration_pending degradation", async () => {
    const repo = makeRepo();
    repo.release.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildReleaseFreezeListResponse(repo, "o");
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
