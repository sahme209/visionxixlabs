import { describe, expect, it } from "vitest";
import {
  buildDriftListResponse,
  type DriftListRepo,
  type DriftRow,
} from "../driftListResponder";

function makeRepo(): DriftListRepo & { _rows: DriftRow[] } {
  const rows: DriftRow[] = [];
  return {
    _rows: rows,
    driftFinding: {
      async findMany({ where, take }) {
        let filtered = rows.filter((r) => r.organizationId === where.organizationId);
        if (where.status) {
          const allowed = new Set(where.status.in);
          filtered = filtered.filter((r) => allowed.has(r.status as never));
        }
        if (where.severity) {
          const allowed = new Set(where.severity.in);
          filtered = filtered.filter((r) => allowed.has(r.severity as never));
        }
        const sorted = filtered.slice().sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
        return take ? sorted.slice(0, take) : sorted;
      },
    },
  };
}

function makeRow(over: Partial<DriftRow> = {}): DriftRow {
  return {
    id: "drift_1", organizationId: "o",
    resourceKind: "aws_resource", resourceId: "arn:aws:ec2/i-abc", displayName: "web-1",
    applicationId: "app_web", environmentTier: "prod",
    severity: "medium", status: "open",
    summary: "Instance type changed from t3.medium to t3.large.",
    remediationKey: null,
    decidedByUserId: null, decidedAt: null, decisionReason: null,
    detectedAt: new Date("2026-05-22T10:00:00Z"),
    lastSeenAt: new Date("2026-05-25T10:00:00Z"),
    ...over,
  };
}

const NOW = new Date("2026-05-25T12:00:00Z");

describe("buildDriftListResponse", () => {
  it("empty org → 200 ok with zeros", async () => {
    const repo = makeRepo();
    const r = await buildDriftListResponse(repo, "o", { now: NOW });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.findings).toEqual([]);
    expect(r.body.data.summary.total).toBe(0);
    expect(r.body.data.summary.openCritical).toBe(0);
  });

  it("populated mix → buckets reflect status + severity + openCritical", async () => {
    const repo = makeRepo();
    repo._rows.push(makeRow({ id: "d1", severity: "critical", status: "open" }));
    repo._rows.push(makeRow({ id: "d2", severity: "critical", status: "acknowledged", detectedAt: new Date("2026-05-21") }));
    repo._rows.push(makeRow({ id: "d3", severity: "low", status: "resolved", detectedAt: new Date("2026-05-20") }));
    repo._rows.push(makeRow({ id: "d4", severity: "weirdvalue", status: "open", detectedAt: new Date("2026-05-19") }));

    const r = await buildDriftListResponse(repo, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.findings).toHaveLength(4);
    expect(r.body.data.summary.openCritical).toBe(1); // only d1
    expect(r.body.data.summary.bySeverity.critical).toBe(2);
    expect(r.body.data.summary.bySeverity.unknown).toBe(1);
  });

  it("statusFilter narrows results", async () => {
    const repo = makeRepo();
    repo._rows.push(makeRow({ id: "d1", status: "open" }));
    repo._rows.push(makeRow({ id: "d2", status: "resolved" }));
    repo._rows.push(makeRow({ id: "d3", status: "suppressed" }));
    const r = await buildDriftListResponse(repo, "o", { statusFilter: ["open", "acknowledged"] });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.findings).toHaveLength(1);
    expect(r.body.data.findings[0].id).toBe("d1");
  });

  it("severityFilter narrows results", async () => {
    const repo = makeRepo();
    repo._rows.push(makeRow({ id: "d1", severity: "critical" }));
    repo._rows.push(makeRow({ id: "d2", severity: "low" }));
    const r = await buildDriftListResponse(repo, "o", { severityFilter: ["critical", "high"] });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.findings).toHaveLength(1);
    expect(r.body.data.findings[0].id).toBe("d1");
  });

  it("503 migration_pending when table missing", async () => {
    const repo = makeRepo();
    repo.driftFinding.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildDriftListResponse(repo, "o");
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
