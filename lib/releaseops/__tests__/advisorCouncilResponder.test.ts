import { describe, expect, it } from "vitest";
import {
  buildCouncilGenerateResponse,
  buildCouncilListResponse,
  buildCouncilDecisionResponse,
  planCouncilDecision,
  type AdvisorCouncilRepo,
  type CouncilRow,
} from "../advisorCouncilResponder";
import type { AdvisorInputs } from "../releaseAdvisorEngine";

interface Stub extends AdvisorCouncilRepo {
  _rows: CouncilRow[];
  _nextId: number;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _rows: [],
    _nextId: 1,
    advisorCouncilDecision: {
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
      async create({ data }) {
        const now = new Date();
        const row: CouncilRow = {
          id: `cd_${stub._nextId++}`,
          organizationId: data.organizationId,
          releaseId: data.releaseId,
          consensusKind: data.consensusKind,
          agreementScore: data.agreementScore,
          title: data.title,
          rationale: data.rationale,
          votesJson: data.votesJson,
          voterCount: data.voterCount,
          inputsJson: data.inputsJson,
          engineVersion: data.engineVersion,
          operatorDecision: data.operatorDecision,
          decidedByUserId: null,
          decidedAt: null,
          decisionNote: null,
          overrideKind: null,
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
          overrideKind: data.overrideKind ?? null,
          updatedAt: new Date(),
        };
        return stub._rows[idx];
      },
    },
  };
  return stub;
}

const NOW = new Date("2026-05-28T12:00:00Z");

function baseInputs(overrides: Partial<AdvisorInputs> = {}): AdvisorInputs {
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

describe("planCouncilDecision", () => {
  it("pending → accepted", () => {
    expect(planCouncilDecision("pending", "accept")).toEqual({ ok: true, next: "accepted" });
  });
  it("pending → overridden", () => {
    expect(planCouncilDecision("pending", "override")).toEqual({ ok: true, next: "overridden" });
  });
  it("rejects from terminal accepted", () => {
    expect(planCouncilDecision("accepted", "override").ok).toBe(false);
  });
});

describe("buildCouncilGenerateResponse", () => {
  it("200 persists output + zero supersedes when no prior pending", async () => {
    const stub = makeRepo();
    const r = await buildCouncilGenerateResponse(stub, {
      organizationId: "o", releaseId: "rel_1",
      engineInputs: baseInputs({ policyViolations: { blocking: 1, warning: 0, advisory: 0 } }),
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.supersededCount).toBe(0);
    expect(r.body.data.decision.consensusKind).toBe("block_deploy");
    expect(r.body.data.decision.voterCount).toBe(3);
    expect(r.body.data.decision.votes).toHaveLength(3);
  });

  it("200 supersedes prior pending on regenerate", async () => {
    const stub = makeRepo();
    await buildCouncilGenerateResponse(stub, {
      organizationId: "o", releaseId: "rel_1",
      engineInputs: baseInputs(),
    });
    const r = await buildCouncilGenerateResponse(stub, {
      organizationId: "o", releaseId: "rel_1",
      engineInputs: baseInputs({ policyViolations: { blocking: 2, warning: 0, advisory: 0 } }),
    });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.supersededCount).toBe(1);
    expect(stub._rows.filter((r) => r.operatorDecision === "dismissed")).toHaveLength(1);
  });

  it("503 migration_pending", async () => {
    const stub = makeRepo();
    stub.advisorCouncilDecision.create = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildCouncilGenerateResponse(stub, {
      organizationId: "o", releaseId: "rel_1", engineInputs: baseInputs(),
    });
    expect(r.status).toBe(503);
  });
});

describe("buildCouncilListResponse", () => {
  it("200 reports per-decision summary + agreement metrics", async () => {
    const stub = makeRepo();
    // High-agreement decision (clean baseline at readiness 95 → all agree).
    await buildCouncilGenerateResponse(stub, {
      organizationId: "o", releaseId: "rel_1",
      engineInputs: baseInputs({ readiness: { ...baseInputs().readiness!, overallScore: 95 } }),
    });
    await buildCouncilGenerateResponse(stub, {
      organizationId: "o", releaseId: "rel_2",
      engineInputs: baseInputs({ policyViolations: { blocking: 1, warning: 0, advisory: 0 } }),
    });
    const r = await buildCouncilListResponse(stub, { organizationId: "o" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.summary.total).toBe(2);
    expect(r.body.data.summary.pending).toBe(2);
    expect(r.body.data.summary.highAgreement).toBeGreaterThanOrEqual(1);
    expect(r.body.data.summary.avgAgreementScore).toBeGreaterThan(0);
  });
});

describe("buildCouncilDecisionResponse", () => {
  async function seeded(): Promise<{ stub: Stub; id: string }> {
    const stub = makeRepo();
    await buildCouncilGenerateResponse(stub, {
      organizationId: "o", releaseId: "rel_1", engineInputs: baseInputs(),
    });
    return { stub, id: stub._rows[0].id };
  }

  it("200 accept transitions pending → accepted", async () => {
    const { stub, id } = await seeded();
    const r = await buildCouncilDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", decisionId: id, action: "accept",
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.decision).toBe("accepted");
  });

  it("200 override requires + persists overrideKind", async () => {
    const { stub, id } = await seeded();
    const r = await buildCouncilDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", decisionId: id, action: "override",
      overrideKind: "block_deploy",
      note: "Council missed an external risk signal.",
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.overrideKind).toBe("block_deploy");
    expect(stub._rows.find((r) => r.id === id)?.overrideKind).toBe("block_deploy");
    expect(stub._rows.find((r) => r.id === id)?.decisionNote).toContain("external risk");
  });

  it("422 override_kind_invalid for unknown kind", async () => {
    const { stub, id } = await seeded();
    const r = await buildCouncilDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", decisionId: id, action: "override",
      overrideKind: "not_a_kind",
    });
    expect(r.status).toBe(422);
  });

  it("422 override action without overrideKind", async () => {
    const { stub, id } = await seeded();
    const r = await buildCouncilDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", decisionId: id, action: "override",
    });
    expect(r.status).toBe(422);
  });

  it("404 decision_not_found", async () => {
    const stub = makeRepo();
    const r = await buildCouncilDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", decisionId: "missing", action: "accept",
    });
    expect(r.status).toBe(404);
  });

  it("403 cross_org_decision", async () => {
    const { stub, id } = await seeded();
    const r = await buildCouncilDecisionResponse(stub, {
      organizationId: "different", actorUserId: "u", decisionId: id, action: "accept",
    });
    expect(r.status).toBe(403);
  });

  it("409 illegal_transition from accepted (terminal)", async () => {
    const { stub, id } = await seeded();
    await buildCouncilDecisionResponse(stub, { organizationId: "o", actorUserId: "u", decisionId: id, action: "accept" });
    const r = await buildCouncilDecisionResponse(stub, { organizationId: "o", actorUserId: "u", decisionId: id, action: "override", overrideKind: "proceed" });
    expect(r.status).toBe(409);
  });
});
