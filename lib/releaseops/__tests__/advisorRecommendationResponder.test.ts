import { describe, expect, it } from "vitest";
import {
  buildAdvisorGenerateResponse,
  buildAdvisorListResponse,
  buildAdvisorDecisionResponse,
  planOperatorDecision,
  type AdvisorRepo,
  type RecommendationRow,
} from "../advisorRecommendationResponder";
import type { AdvisorInputs } from "../releaseAdvisorEngine";

interface Stub extends AdvisorRepo {
  _rows: RecommendationRow[];
  _nextId: number;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _rows: [],
    _nextId: 1,
    advisorRecommendation: {
      async findUnique({ where }) {
        return stub._rows.find((r) => r.id === where.id) ?? null;
      },
      async findMany({ where, take }) {
        const out = stub._rows.filter((r) => {
          if (r.organizationId !== where.organizationId) return false;
          if (where.releaseId !== undefined && r.releaseId !== where.releaseId) return false;
          if (where.operatorDecision !== undefined && r.operatorDecision !== where.operatorDecision) return false;
          return true;
        }).sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
        return take ? out.slice(0, take) : out;
      },
      async updateMany({ where, data }) {
        let count = 0;
        for (const r of stub._rows) {
          if (r.organizationId === where.organizationId
              && r.releaseId === where.releaseId
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
            id: `rec_${stub._nextId++}`,
            organizationId: d.organizationId,
            releaseId: d.releaseId,
            kind: d.kind,
            confidence: d.confidence,
            title: d.title,
            rationale: d.rationale,
            suggestedActionsJson: d.suggestedActionsJson,
            severity: d.severity,
            operatorDecision: d.operatorDecision,
            decidedByUserId: null,
            decidedAt: null,
            decisionNote: null,
            inputsJson: d.inputsJson,
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
          updatedAt: new Date(),
        };
        return stub._rows[idx];
      },
    },
  };
  return stub;
}

const NOW = new Date("2026-05-26T12:00:00Z");

function baseEngineInputs(overrides: Partial<AdvisorInputs> = {}): AdvisorInputs {
  return {
    release: { id: "rel_1", status: "ready", releaseTag: "v1.2.3", commitSha: "abc1234", plannedWindowStart: null, plannedWindowEnd: null },
    readiness: { overallScore: 85, riskLevel: "low", blockerCount: 0, branchGovernance: 80, changeCompliance: 90, secretTraceability: 85, rollbackReadiness: 75, manualReconciliation: 90 },
    policyViolations: { blocking: 0, warning: 0, advisory: 0 },
    pendingManualFixes: { total: 0, inProd: 0 },
    recentIncidents: { open: 0, openCritical: 0, mitigated: 0 },
    branchProtection: { snapshotsTotal: 1, weakOrNone: 0, forcePushAllowedOnMain: false },
    previousReleaseStatus: null,
    hasEvidencePack: false,
    isInPlannedFreeze: false,
    now: NOW,
    ...overrides,
  };
}

describe("planOperatorDecision", () => {
  it("pending → accepted on accept", () => {
    expect(planOperatorDecision("pending", "accept")).toEqual({ ok: true, next: "accepted" });
  });
  it("pending → rejected on reject", () => {
    expect(planOperatorDecision("pending", "reject")).toEqual({ ok: true, next: "rejected" });
  });
  it("pending → implemented on implement", () => {
    expect(planOperatorDecision("pending", "implement")).toEqual({ ok: true, next: "implemented" });
  });
  it("pending → dismissed on dismiss", () => {
    expect(planOperatorDecision("pending", "dismiss")).toEqual({ ok: true, next: "dismissed" });
  });
  it("rejects any transition from accepted (terminal)", () => {
    const r = planOperatorDecision("accepted", "reject");
    expect(r.ok).toBe(false);
  });
  it("rejects any transition from rejected (terminal)", () => {
    const r = planOperatorDecision("rejected", "accept");
    expect(r.ok).toBe(false);
  });
});

describe("buildAdvisorGenerateResponse", () => {
  it("200 persists the engine output + zero supersedes when no prior pending", async () => {
    const stub = makeRepo();
    const r = await buildAdvisorGenerateResponse(stub, {
      organizationId: "o", releaseId: "rel_1",
      engineInputs: baseEngineInputs({ policyViolations: { blocking: 1, warning: 0, advisory: 0 } }),
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.recommendationCount).toBeGreaterThan(0);
    expect(r.body.data.supersededCount).toBe(0);
    expect(r.body.data.primary?.kind).toBe("block_deploy");
    expect(stub._rows.length).toBeGreaterThan(0);
    expect(stub._rows.every((row) => row.operatorDecision === "pending")).toBe(true);
  });

  it("200 supersedes existing pending recs for same release", async () => {
    const stub = makeRepo();
    // First generate.
    await buildAdvisorGenerateResponse(stub, {
      organizationId: "o", releaseId: "rel_1",
      engineInputs: baseEngineInputs({ policyViolations: { blocking: 1, warning: 0, advisory: 0 } }),
    });
    const firstBatchSize = stub._rows.length;
    expect(firstBatchSize).toBeGreaterThan(0);

    // Second generate — should mark prior pending → dismissed before inserting new ones.
    const r = await buildAdvisorGenerateResponse(stub, {
      organizationId: "o", releaseId: "rel_1",
      engineInputs: baseEngineInputs({ policyViolations: { blocking: 2, warning: 0, advisory: 0 } }),
    });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.supersededCount).toBe(firstBatchSize);
    // Newly inserted pending rows should all be from the second batch.
    expect(r.body.data.recommendationCount).toBeGreaterThan(0);
    const dismissedFromFirst = stub._rows.filter((row) => row.operatorDecision === "dismissed");
    expect(dismissedFromFirst.length).toBe(firstBatchSize);
  });

  it("200 supersede only touches own org+release", async () => {
    const stub = makeRepo();
    await buildAdvisorGenerateResponse(stub, {
      organizationId: "o1", releaseId: "rel_1",
      engineInputs: baseEngineInputs({ policyViolations: { blocking: 1, warning: 0, advisory: 0 } }),
    });
    await buildAdvisorGenerateResponse(stub, {
      organizationId: "o2", releaseId: "rel_1",
      engineInputs: baseEngineInputs({ policyViolations: { blocking: 1, warning: 0, advisory: 0 } }),
    });
    // o1's earlier rows still pending — supersede didn't cross orgs.
    const o1Pending = stub._rows.filter((r) => r.organizationId === "o1" && r.operatorDecision === "pending").length;
    expect(o1Pending).toBeGreaterThan(0);
  });

  it("persists JSON-safe inputs (Dates replaced with ISO strings)", async () => {
    const stub = makeRepo();
    const planned = new Date("2026-06-01T10:00:00Z");
    await buildAdvisorGenerateResponse(stub, {
      organizationId: "o", releaseId: "rel_1",
      engineInputs: baseEngineInputs({
        release: { ...baseEngineInputs().release, plannedWindowStart: planned, plannedWindowEnd: planned },
        policyViolations: { blocking: 1, warning: 0, advisory: 0 },
      }),
    });
    const row = stub._rows[0];
    const inputs = row.inputsJson as { release: { plannedWindowStart: string }; now: string };
    expect(inputs.release.plannedWindowStart).toBe(planned.toISOString());
    expect(inputs.now).toBe(NOW.toISOString());
  });

  it("503 migration_pending", async () => {
    const stub = makeRepo();
    stub.advisorRecommendation.updateMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildAdvisorGenerateResponse(stub, {
      organizationId: "o", releaseId: "rel_1", engineInputs: baseEngineInputs(),
    });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});

describe("buildAdvisorListResponse", () => {
  it("200 reports a per-decision summary", async () => {
    const stub = makeRepo();
    await buildAdvisorGenerateResponse(stub, {
      organizationId: "o", releaseId: "rel_1",
      engineInputs: baseEngineInputs({ policyViolations: { blocking: 1, warning: 0, advisory: 0 } }),
    });
    // Accept the first one to make summary varied.
    const firstId = stub._rows[0].id;
    await buildAdvisorDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", recommendationId: firstId, action: "accept",
    });
    const r = await buildAdvisorListResponse(stub, { organizationId: "o" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.summary.accepted).toBe(1);
    expect(r.body.data.summary.pending).toBe(stub._rows.length - 1);
  });
});

describe("buildAdvisorDecisionResponse", () => {
  async function seeded(): Promise<{ stub: Stub; id: string }> {
    const stub = makeRepo();
    await buildAdvisorGenerateResponse(stub, {
      organizationId: "o", releaseId: "rel_1",
      engineInputs: baseEngineInputs({ policyViolations: { blocking: 1, warning: 0, advisory: 0 } }),
    });
    return { stub, id: stub._rows[0].id };
  }

  it("200 accept transitions pending → accepted", async () => {
    const { stub, id } = await seeded();
    const r = await buildAdvisorDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u1", recommendationId: id, action: "accept",
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.decision).toBe("accepted");
    expect(stub._rows.find((row) => row.id === id)?.decidedByUserId).toBe("u1");
  });

  it("200 persists decisionNote when provided", async () => {
    const { stub, id } = await seeded();
    await buildAdvisorDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u1", recommendationId: id, action: "reject",
      note: "Engine missed that we already have a compensating control.",
    });
    expect(stub._rows.find((row) => row.id === id)?.decisionNote).toContain("compensating control");
  });

  it("404 recommendation_not_found", async () => {
    const stub = makeRepo();
    const r = await buildAdvisorDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", recommendationId: "missing", action: "accept",
    });
    expect(r.status).toBe(404);
  });

  it("403 cross_org_recommendation", async () => {
    const { stub, id } = await seeded();
    const r = await buildAdvisorDecisionResponse(stub, {
      organizationId: "different-org", actorUserId: "u", recommendationId: id, action: "accept",
    });
    expect(r.status).toBe(403);
  });

  it("409 illegal_transition from accepted (terminal)", async () => {
    const { stub, id } = await seeded();
    await buildAdvisorDecisionResponse(stub, { organizationId: "o", actorUserId: "u", recommendationId: id, action: "accept" });
    const r = await buildAdvisorDecisionResponse(stub, { organizationId: "o", actorUserId: "u", recommendationId: id, action: "reject" });
    expect(r.status).toBe(409);
  });

  it("422 illegal_transition for unknown action", async () => {
    const { stub, id } = await seeded();
    const r = await buildAdvisorDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", recommendationId: id, action: "nuke" as never,
    });
    expect(r.status).toBe(422);
  });

  it("503 migration_pending", async () => {
    const { stub, id } = await seeded();
    stub.advisorRecommendation.findUnique = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildAdvisorDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", recommendationId: id, action: "accept",
    });
    expect(r.status).toBe(503);
  });
});
