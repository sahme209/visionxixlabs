import { describe, expect, it } from "vitest";
import {
  buildTriageGenerateResponse,
  buildTriageListResponse,
  buildTriageDecisionResponse,
  planTriageDecision,
  type IncidentLookupRow,
  type IncidentTriageRepo,
  type TriageRow,
} from "../incidentTriageResponder";
import type { IncidentTriageInputs } from "../incidentTriageEngine";

interface Stub extends IncidentTriageRepo {
  _incidents: IncidentLookupRow[];
  _rows: TriageRow[];
  _nextId: number;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _incidents: [],
    _rows: [],
    _nextId: 1,
    deploymentIncident: {
      async findUnique({ where }) {
        return stub._incidents.find((i) => i.id === where.id) ?? null;
      },
    },
    incidentTriage: {
      async findUnique({ where }) {
        return stub._rows.find((r) => r.id === where.id) ?? null;
      },
      async findMany({ where, take }) {
        const out = stub._rows.filter((r) => {
          if (r.organizationId !== where.organizationId) return false;
          if (where.incidentId !== undefined && r.incidentId !== where.incidentId) return false;
          if (where.operatorDecision !== undefined && r.operatorDecision !== where.operatorDecision) return false;
          return true;
        }).sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
        return take ? out.slice(0, take) : out;
      },
      async updateMany({ where, data }) {
        let count = 0;
        for (const r of stub._rows) {
          if (r.organizationId === where.organizationId
              && r.incidentId === where.incidentId
              && r.operatorDecision === where.operatorDecision) {
            r.operatorDecision = data.operatorDecision;
            r.updatedAt = new Date();
            count += 1;
          }
        }
        return { count };
      },
      async create({ data }) {
        const now = new Date();
        const row: TriageRow = {
          id: `tri_${stub._nextId++}`,
          organizationId: data.organizationId,
          incidentId: data.incidentId,
          priority: data.priority,
          suggestedOwnerTeam: data.suggestedOwnerTeam,
          estimatedTimeToMitigateMinutes: data.estimatedTimeToMitigateMinutes,
          recommendedRunbook: data.recommendedRunbook,
          autoEscalate: data.autoEscalate,
          confidence: data.confidence,
          rationale: data.rationale,
          inputsJson: data.inputsJson,
          operatorDecision: data.operatorDecision,
          decidedByUserId: null,
          decidedAt: null,
          decisionNote: null,
          overridePriority: null,
          engineVersion: data.engineVersion,
          generatedAt: new Date(now.getTime() + stub._rows.length),
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
          operatorDecision: data.operatorDecision,
          decidedByUserId: data.decidedByUserId,
          decidedAt: data.decidedAt,
          decisionNote: data.decisionNote ?? null,
          overridePriority: data.overridePriority ?? null,
          updatedAt: new Date(),
        };
        return stub._rows[idx];
      },
    },
  };
  return stub;
}

const NOW = new Date("2026-05-26T12:00:00Z");

function baseEngineInputs(overrides: Partial<IncidentTriageInputs> = {}): IncidentTriageInputs {
  return {
    incident: { id: "inc_1", severity: "high", title: "Checkout 500 errors", summary: null, reportedAtIso: NOW.toISOString() },
    release: { id: "rel_1", status: "deployed", releaseTag: "v1.2.3", isProduction: true, deployedAtIso: NOW.toISOString() },
    openCriticalIncidentsOnThisRelease: 0,
    pendingAdvisorBlockKinds: [],
    similarHistoricalIncidents: 0,
    medianHistoricalMitigationMinutes: 0,
    businessImpactHint: null,
    isInPlannedFreeze: false,
    now: NOW,
    ...overrides,
  };
}

describe("planTriageDecision", () => {
  it("pending → accepted on accept", () => {
    expect(planTriageDecision("pending", "accept")).toEqual({ ok: true, next: "accepted" });
  });
  it("pending → overridden on override", () => {
    expect(planTriageDecision("pending", "override")).toEqual({ ok: true, next: "overridden" });
  });
  it("rejects re-decision from accepted (terminal)", () => {
    expect(planTriageDecision("accepted", "override").ok).toBe(false);
  });
});

describe("buildTriageGenerateResponse", () => {
  function seeded(): Stub {
    const stub = makeRepo();
    stub._incidents.push({ id: "inc_1", organizationId: "o", severity: "high", status: "open" });
    return stub;
  }

  it("200 creates triage + zero supersedes when none prior", async () => {
    const stub = seeded();
    const r = await buildTriageGenerateResponse(stub, {
      organizationId: "o",
      incidentId: "inc_1",
      engineInputs: baseEngineInputs(),
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.supersededCount).toBe(0);
    expect(r.body.data.triage.priority).toBe("P1");
    expect(r.body.data.triage.suggestedOwnerTeam).toBe("payments");
  });

  it("200 supersedes prior pending on regenerate", async () => {
    const stub = seeded();
    await buildTriageGenerateResponse(stub, {
      organizationId: "o", incidentId: "inc_1", engineInputs: baseEngineInputs(),
    });
    const r = await buildTriageGenerateResponse(stub, {
      organizationId: "o", incidentId: "inc_1",
      engineInputs: baseEngineInputs({ openCriticalIncidentsOnThisRelease: 3 }),
    });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.supersededCount).toBe(1);
    expect(stub._rows.filter((r) => r.operatorDecision === "dismissed").length).toBe(1);
    expect(stub._rows.filter((r) => r.operatorDecision === "pending").length).toBe(1);
  });

  it("404 incident_not_found", async () => {
    const stub = makeRepo();
    const r = await buildTriageGenerateResponse(stub, {
      organizationId: "o", incidentId: "missing", engineInputs: baseEngineInputs(),
    });
    expect(r.status).toBe(404);
  });

  it("403 cross_org_incident", async () => {
    const stub = makeRepo();
    stub._incidents.push({ id: "inc_1", organizationId: "other", severity: "high", status: "open" });
    const r = await buildTriageGenerateResponse(stub, {
      organizationId: "o", incidentId: "inc_1", engineInputs: baseEngineInputs(),
    });
    expect(r.status).toBe(403);
  });

  it("503 migration_pending", async () => {
    const stub = makeRepo();
    stub._incidents.push({ id: "inc_1", organizationId: "o", severity: "high", status: "open" });
    stub.incidentTriage.create = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildTriageGenerateResponse(stub, {
      organizationId: "o", incidentId: "inc_1", engineInputs: baseEngineInputs(),
    });
    expect(r.status).toBe(503);
  });
});

describe("buildTriageListResponse", () => {
  it("200 reports per-decision + per-priority summary", async () => {
    const stub = makeRepo();
    stub._incidents.push({ id: "inc_1", organizationId: "o", severity: "critical", status: "open" });
    await buildTriageGenerateResponse(stub, {
      organizationId: "o", incidentId: "inc_1",
      engineInputs: baseEngineInputs({ incident: { ...baseEngineInputs().incident, severity: "critical" } }),
    });
    const r = await buildTriageListResponse(stub, { organizationId: "o" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.summary.p0).toBe(1);
    expect(r.body.data.summary.pending).toBe(1);
  });
});

describe("buildTriageDecisionResponse", () => {
  async function seededWithTriage(): Promise<{ stub: Stub; id: string }> {
    const stub = makeRepo();
    stub._incidents.push({ id: "inc_1", organizationId: "o", severity: "high", status: "open" });
    await buildTriageGenerateResponse(stub, {
      organizationId: "o", incidentId: "inc_1", engineInputs: baseEngineInputs(),
    });
    return { stub, id: stub._rows[0].id };
  }

  it("200 accept transitions pending → accepted", async () => {
    const { stub, id } = await seededWithTriage();
    const r = await buildTriageDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", triageId: id, action: "accept",
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.decision).toBe("accepted");
  });

  it("422 override_priority_invalid when override lacks valid priority", async () => {
    const { stub, id } = await seededWithTriage();
    const r = await buildTriageDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", triageId: id, action: "override",
    });
    expect(r.status).toBe(422);
  });

  it("200 override records the new priority on the row", async () => {
    const { stub, id } = await seededWithTriage();
    const r = await buildTriageDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", triageId: id, action: "override",
      overridePriority: "P0",
      note: "Real impact is bigger than engine assessed.",
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.decision).toBe("overridden");
    expect(r.body.data.overridePriority).toBe("P0");
    expect(stub._rows.find((row) => row.id === id)?.overridePriority).toBe("P0");
  });

  it("404 triage_not_found", async () => {
    const stub = makeRepo();
    const r = await buildTriageDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", triageId: "missing", action: "accept",
    });
    expect(r.status).toBe(404);
  });

  it("403 cross_org_triage", async () => {
    const { stub, id } = await seededWithTriage();
    const r = await buildTriageDecisionResponse(stub, {
      organizationId: "different", actorUserId: "u", triageId: id, action: "accept",
    });
    expect(r.status).toBe(403);
  });

  it("409 illegal_transition from accepted", async () => {
    const { stub, id } = await seededWithTriage();
    await buildTriageDecisionResponse(stub, { organizationId: "o", actorUserId: "u", triageId: id, action: "accept" });
    const r = await buildTriageDecisionResponse(stub, { organizationId: "o", actorUserId: "u", triageId: id, action: "override", overridePriority: "P0" });
    expect(r.status).toBe(409);
  });
});
