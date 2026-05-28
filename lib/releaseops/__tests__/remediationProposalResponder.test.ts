import { describe, expect, it } from "vitest";
import {
  buildRemediationGenerateResponse,
  buildRemediationListResponse,
  buildRemediationDecisionResponse,
  planRemediationDecision,
  type IncidentLookupRow,
  type RemediationRepo,
  type RemediationRow,
} from "../remediationProposalResponder";
import type { RemediationInputs } from "../remediationProposalEngine";

interface Stub extends RemediationRepo {
  _incidents: IncidentLookupRow[];
  _rows: RemediationRow[];
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
    remediationProposal: {
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
      async createMany({ data }) {
        const now = new Date();
        for (let i = 0; i < data.length; i++) {
          const d = data[i];
          stub._rows.push({
            id: `rp_${stub._nextId++}`,
            organizationId: d.organizationId,
            incidentId: d.incidentId,
            triageId: d.triageId,
            kind: d.kind,
            title: d.title,
            description: d.description,
            confidence: d.confidence,
            severity: d.severity,
            prerequisitesJson: d.prerequisitesJson,
            expectedImpact: d.expectedImpact,
            rollbackPlan: d.rollbackPlan,
            estimatedMinutes: d.estimatedMinutes,
            reversible: d.reversible,
            rationale: d.rationale,
            inputsJson: d.inputsJson,
            operatorDecision: d.operatorDecision,
            decidedByUserId: null,
            decidedAt: null,
            decisionNote: null,
            linkedManualFixId: null,
            engineVersion: d.engineVersion,
            generatedAt: new Date(now.getTime() + i),
            updatedAt: now,
          });
        }
        return { count: data.length };
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
          linkedManualFixId: data.linkedManualFixId ?? null,
          updatedAt: new Date(),
        };
        return stub._rows[idx];
      },
    },
  };
  return stub;
}

const NOW = new Date("2026-05-28T12:00:00Z");

function baseEngineInputs(overrides: Partial<RemediationInputs> = {}): RemediationInputs {
  return {
    triage: { priority: "P1", suggestedOwnerTeam: "payments", recommendedRunbook: "checkout_outage", autoEscalate: true },
    incident: { id: "inc_1", title: "Checkout 500 errors", summary: null, severity: "high", reportedAtIso: NOW.toISOString() },
    release: { id: "rel_1", status: "deployed", releaseTag: "v1.2.3", previousSuccessfulTag: "v1.2.2", minutesSinceDeploy: 45, isProduction: true },
    releaseFeatureFlags: ["new_checkout"],
    isCapacitySaturated: false,
    thirdPartyDependencyHint: false,
    highErrorRate: false,
    availableRunbookKeys: [],
    now: NOW,
    ...overrides,
  };
}

describe("planRemediationDecision", () => {
  it("pending → accepted on accept", () => {
    expect(planRemediationDecision("pending", "accept")).toEqual({ ok: true, next: "accepted" });
  });
  it("rejects from terminal accepted", () => {
    expect(planRemediationDecision("accepted", "reject").ok).toBe(false);
  });
});

describe("buildRemediationGenerateResponse", () => {
  function seeded(): Stub {
    const stub = makeRepo();
    stub._incidents.push({ id: "inc_1", organizationId: "o", status: "open" });
    return stub;
  }

  it("200 persists engine output + 0 supersedes when no prior pending", async () => {
    const stub = seeded();
    const r = await buildRemediationGenerateResponse(stub, {
      organizationId: "o", incidentId: "inc_1", triageId: "tri_1",
      engineInputs: baseEngineInputs(),
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.supersededCount).toBe(0);
    expect(r.body.data.proposalCount).toBeGreaterThan(0);
    expect(r.body.data.primary).not.toBeNull();
    expect(stub._rows.every((row) => row.triageId === "tri_1")).toBe(true);
  });

  it("200 supersedes prior pending for the same incident on regenerate", async () => {
    const stub = seeded();
    await buildRemediationGenerateResponse(stub, {
      organizationId: "o", incidentId: "inc_1", engineInputs: baseEngineInputs(),
    });
    const firstBatch = stub._rows.length;
    const r = await buildRemediationGenerateResponse(stub, {
      organizationId: "o", incidentId: "inc_1",
      engineInputs: baseEngineInputs({ isCapacitySaturated: true }),
    });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.supersededCount).toBe(firstBatch);
    const dismissed = stub._rows.filter((row) => row.operatorDecision === "dismissed").length;
    expect(dismissed).toBe(firstBatch);
  });

  it("404 incident_not_found", async () => {
    const stub = makeRepo();
    const r = await buildRemediationGenerateResponse(stub, {
      organizationId: "o", incidentId: "missing", engineInputs: baseEngineInputs(),
    });
    expect(r.status).toBe(404);
  });

  it("403 cross_org_incident", async () => {
    const stub = makeRepo();
    stub._incidents.push({ id: "inc_1", organizationId: "other", status: "open" });
    const r = await buildRemediationGenerateResponse(stub, {
      organizationId: "o", incidentId: "inc_1", engineInputs: baseEngineInputs(),
    });
    expect(r.status).toBe(403);
  });

  it("503 migration_pending", async () => {
    const stub = seeded();
    stub.remediationProposal.createMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildRemediationGenerateResponse(stub, {
      organizationId: "o", incidentId: "inc_1", engineInputs: baseEngineInputs(),
    });
    expect(r.status).toBe(503);
  });

  it("persists prerequisites as a JSON array roundtrippable to strings", async () => {
    const stub = seeded();
    await buildRemediationGenerateResponse(stub, {
      organizationId: "o", incidentId: "inc_1", engineInputs: baseEngineInputs(),
    });
    const rollback = stub._rows.find((r) => r.kind === "rollback_release");
    expect(rollback).toBeDefined();
    expect(Array.isArray(rollback?.prerequisitesJson)).toBe(true);
  });
});

describe("buildRemediationListResponse", () => {
  it("200 reports per-decision summary", async () => {
    const stub = makeRepo();
    stub._incidents.push({ id: "inc_1", organizationId: "o", status: "open" });
    await buildRemediationGenerateResponse(stub, {
      organizationId: "o", incidentId: "inc_1", engineInputs: baseEngineInputs(),
    });
    const r = await buildRemediationListResponse(stub, { organizationId: "o" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.summary.pending).toBeGreaterThan(0);
  });
});

describe("buildRemediationDecisionResponse", () => {
  async function seededWithProposal(): Promise<{ stub: Stub; id: string }> {
    const stub = makeRepo();
    stub._incidents.push({ id: "inc_1", organizationId: "o", status: "open" });
    await buildRemediationGenerateResponse(stub, {
      organizationId: "o", incidentId: "inc_1", engineInputs: baseEngineInputs(),
    });
    return { stub, id: stub._rows[0].id };
  }

  it("200 accept transitions to accepted", async () => {
    const { stub, id } = await seededWithProposal();
    const r = await buildRemediationDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", proposalId: id, action: "accept",
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.decision).toBe("accepted");
  });

  it("200 implement persists linkedManualFixId", async () => {
    const { stub, id } = await seededWithProposal();
    await buildRemediationDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", proposalId: id, action: "implement",
      linkedManualFixId: "fix_1", note: "Rolled back successfully",
    });
    expect(stub._rows.find((r) => r.id === id)?.linkedManualFixId).toBe("fix_1");
    expect(stub._rows.find((r) => r.id === id)?.decisionNote).toContain("Rolled back");
  });

  it("404 proposal_not_found", async () => {
    const stub = makeRepo();
    const r = await buildRemediationDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", proposalId: "missing", action: "accept",
    });
    expect(r.status).toBe(404);
  });

  it("403 cross_org_proposal", async () => {
    const { stub, id } = await seededWithProposal();
    const r = await buildRemediationDecisionResponse(stub, {
      organizationId: "different", actorUserId: "u", proposalId: id, action: "accept",
    });
    expect(r.status).toBe(403);
  });

  it("409 illegal_transition from accepted (terminal)", async () => {
    const { stub, id } = await seededWithProposal();
    await buildRemediationDecisionResponse(stub, { organizationId: "o", actorUserId: "u", proposalId: id, action: "accept" });
    const r = await buildRemediationDecisionResponse(stub, { organizationId: "o", actorUserId: "u", proposalId: id, action: "reject" });
    expect(r.status).toBe(409);
  });
});
