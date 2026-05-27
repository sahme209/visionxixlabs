import { describe, expect, it } from "vitest";
import {
  planTransition,
  buildIncidentReportResponse,
  buildIncidentTransitionResponse,
  buildIncidentListResponse,
  type DeploymentIncidentRepo,
  type IncidentRow,
  type ReleaseLookupRow,
} from "../deploymentIncidentResponder";

interface Stub extends DeploymentIncidentRepo {
  _releases: ReleaseLookupRow[];
  _incidents: IncidentRow[];
  _nextId: number;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _releases: [],
    _incidents: [],
    _nextId: 1,
    release: {
      async findUnique({ where }) {
        return stub._releases.find((r) => r.id === where.id) ?? null;
      },
    },
    deploymentIncident: {
      async findUnique({ where }) {
        return stub._incidents.find((i) => i.id === where.id) ?? null;
      },
      async findMany({ where, take }) {
        const out = stub._incidents.filter((i) => {
          if (i.organizationId !== where.organizationId) return false;
          if (where.releaseId !== undefined && i.releaseId !== where.releaseId) return false;
          if (where.status !== undefined && i.status !== where.status) return false;
          return true;
        }).sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime());
        return take ? out.slice(0, take) : out;
      },
      async create({ data }) {
        const now = new Date();
        const row: IncidentRow = {
          id: `inc_${stub._nextId++}`,
          organizationId: data.organizationId,
          releaseId: data.releaseId,
          severity: data.severity,
          status: data.status,
          title: data.title,
          summary: data.summary,
          manualFixId: null,
          reportedByUserId: data.reportedByUserId,
          reportedAt: new Date(now.getTime() + stub._incidents.length),
          mitigatedByUserId: null,
          mitigatedAt: null,
          resolvedByUserId: null,
          resolvedAt: null,
          externalUrl: data.externalUrl,
          createdAt: now,
          updatedAt: now,
        };
        stub._incidents.push(row);
        return row;
      },
      async update({ where, data }) {
        const idx = stub._incidents.findIndex((i) => i.id === where.id);
        if (idx < 0) throw new Error("not found");
        const existing = stub._incidents[idx];
        stub._incidents[idx] = {
          ...existing,
          status: data.status,
          mitigatedByUserId: data.mitigatedByUserId !== undefined ? data.mitigatedByUserId : existing.mitigatedByUserId,
          mitigatedAt: data.mitigatedAt !== undefined ? data.mitigatedAt : existing.mitigatedAt,
          resolvedByUserId: data.resolvedByUserId !== undefined ? data.resolvedByUserId : existing.resolvedByUserId,
          resolvedAt: data.resolvedAt !== undefined ? data.resolvedAt : existing.resolvedAt,
          updatedAt: new Date(),
        };
        return stub._incidents[idx];
      },
    },
  };
  return stub;
}

describe("planTransition", () => {
  const ctx = { actorUserId: "u", now: new Date() };
  it("open → mitigated on mitigate", () => {
    const p = planTransition("open", "mitigate", ctx);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.next).toBe("mitigated");
  });
  it("mitigated → resolved on resolve", () => {
    const p = planTransition("mitigated", "resolve", ctx);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.next).toBe("resolved");
  });
  it("open → resolved is legal (skip mitigated)", () => {
    const p = planTransition("open", "resolve", ctx);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.next).toBe("resolved");
  });
  it("rejects mitigate from resolved (terminal)", () => {
    const p = planTransition("resolved", "mitigate", ctx);
    expect(p.ok).toBe(false);
  });
  it("rejects resolve from wont_fix (terminal)", () => {
    const p = planTransition("wont_fix", "resolve", ctx);
    expect(p.ok).toBe(false);
  });
  it("mitigated → open on reopen", () => {
    const p = planTransition("mitigated", "reopen", ctx);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.next).toBe("open");
  });
  it("rejects reopen from open", () => {
    const p = planTransition("open", "reopen", ctx);
    expect(p.ok).toBe(false);
  });
  it("rejects wont_fix from already-resolved (terminal)", () => {
    const p = planTransition("resolved", "wont_fix", ctx);
    expect(p.ok).toBe(false);
  });
});

describe("buildIncidentReportResponse", () => {
  function seeded(): Stub {
    const stub = makeRepo();
    stub._releases.push({ id: "rel_1", organizationId: "o" });
    return stub;
  }
  it("422 title_required", async () => {
    const stub = seeded();
    const r = await buildIncidentReportResponse(stub, {
      organizationId: "o", reportedByUserId: "u", releaseId: "rel_1", severity: "high", title: "  ",
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("title_required");
  });
  it("422 severity_invalid", async () => {
    const stub = seeded();
    const r = await buildIncidentReportResponse(stub, {
      organizationId: "o", reportedByUserId: "u", releaseId: "rel_1", severity: "epic", title: "x",
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("severity_invalid");
  });
  it("404 release_not_found", async () => {
    const stub = makeRepo();
    const r = await buildIncidentReportResponse(stub, {
      organizationId: "o", reportedByUserId: "u", releaseId: "missing", severity: "high", title: "x",
    });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("release_not_found");
  });
  it("403 cross_org_release", async () => {
    const stub = makeRepo();
    stub._releases.push({ id: "rel_1", organizationId: "other" });
    const r = await buildIncidentReportResponse(stub, {
      organizationId: "o", reportedByUserId: "u", releaseId: "rel_1", severity: "high", title: "x",
    });
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_release");
  });
  it("201 creates open incident", async () => {
    const stub = seeded();
    const r = await buildIncidentReportResponse(stub, {
      organizationId: "o", reportedByUserId: "u1", releaseId: "rel_1",
      severity: "critical", title: "Checkout error spike", summary: " 30% errors on /pay ",
      externalUrl: "https://example.com/sp",
    });
    expect(r.status).toBe(201);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.incident.status).toBe("open");
    expect(r.body.data.incident.severity).toBe("critical");
    expect(stub._incidents[0].summary).toBe("30% errors on /pay");
  });
});

describe("buildIncidentTransitionResponse", () => {
  function seeded(): Stub {
    const stub = makeRepo();
    stub._releases.push({ id: "rel_1", organizationId: "o" });
    return stub;
  }
  async function withIncident(stub: Stub) {
    const r = await buildIncidentReportResponse(stub, {
      organizationId: "o", reportedByUserId: "u", releaseId: "rel_1", severity: "high", title: "x",
    });
    if (!r.body.ok) throw new Error("setup failed");
    return r.body.data.incident.id;
  }

  it("404 incident_not_found", async () => {
    const stub = seeded();
    const r = await buildIncidentTransitionResponse(stub, {
      organizationId: "o", actorUserId: "u", incidentId: "missing", action: "mitigate",
    });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("incident_not_found");
  });

  it("200 mitigate flips status + records actor", async () => {
    const stub = seeded();
    const id = await withIncident(stub);
    const r = await buildIncidentTransitionResponse(stub, {
      organizationId: "o", actorUserId: "u2", incidentId: id, action: "mitigate",
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.status).toBe("mitigated");
    expect(stub._incidents[0].mitigatedByUserId).toBe("u2");
  });

  it("reopen clears mitigation fields", async () => {
    const stub = seeded();
    const id = await withIncident(stub);
    await buildIncidentTransitionResponse(stub, { organizationId: "o", actorUserId: "u", incidentId: id, action: "mitigate" });
    await buildIncidentTransitionResponse(stub, { organizationId: "o", actorUserId: "u", incidentId: id, action: "reopen" });
    expect(stub._incidents[0].status).toBe("open");
    expect(stub._incidents[0].mitigatedByUserId).toBeNull();
  });

  it("409 illegal_transition mitigate from resolved", async () => {
    const stub = seeded();
    const id = await withIncident(stub);
    await buildIncidentTransitionResponse(stub, { organizationId: "o", actorUserId: "u", incidentId: id, action: "resolve" });
    const r = await buildIncidentTransitionResponse(stub, { organizationId: "o", actorUserId: "u", incidentId: id, action: "mitigate" });
    expect(r.status).toBe(409);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("illegal_transition");
  });
});

describe("buildIncidentListResponse", () => {
  it("200 reports summary with openCritical count", async () => {
    const stub = makeRepo();
    stub._releases.push({ id: "rel_1", organizationId: "o" });
    await buildIncidentReportResponse(stub, { organizationId: "o", reportedByUserId: "u", releaseId: "rel_1", severity: "critical", title: "a" });
    await buildIncidentReportResponse(stub, { organizationId: "o", reportedByUserId: "u", releaseId: "rel_1", severity: "high", title: "b" });
    const r = await buildIncidentListResponse(stub, { organizationId: "o" });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.summary.open).toBe(2);
    expect(r.body.data.summary.openCritical).toBe(1);
  });

  it("503 migration_pending", async () => {
    const stub = makeRepo();
    stub.deploymentIncident.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildIncidentListResponse(stub, { organizationId: "o" });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
