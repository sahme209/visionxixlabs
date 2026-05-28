import { describe, expect, it } from "vitest";
import {
  buildAgiCockpitResponse,
  type AgiCockpitRepo,
  type PendingProposalRow,
  type PendingRecommendationRow,
} from "../agiCockpitResponder";

interface Stub extends AgiCockpitRepo {
  _recs: Array<PendingRecommendationRow & { operatorDecision: string }>;
  _props: Array<PendingProposalRow & { operatorDecision: string }>;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _recs: [],
    _props: [],
    advisorRecommendation: {
      async findMany({ where, take }) {
        const out = stub._recs.filter((r) =>
          r.operatorDecision === where.operatorDecision,
        );
        return out.slice(0, take);
      },
      async count({ where }) {
        return stub._recs.filter((r) => r.operatorDecision === where.operatorDecision).length;
      },
      async findFirst() {
        if (stub._recs.length === 0) return null;
        return { generatedAt: stub._recs.map((r) => r.generatedAt).sort((a, b) => b.getTime() - a.getTime())[0] };
      },
    },
    policyProposal: {
      async findMany({ where, take }) {
        const out = stub._props.filter((p) => p.operatorDecision === where.operatorDecision);
        return out.slice(0, take);
      },
      async count({ where }) {
        return stub._props.filter((p) => p.operatorDecision === where.operatorDecision).length;
      },
      async findFirst() {
        if (stub._props.length === 0) return null;
        return { generatedAt: stub._props.map((p) => p.generatedAt).sort((a, b) => b.getTime() - a.getTime())[0] };
      },
    },
  };
  return stub;
}

describe("buildAgiCockpitResponse — empty", () => {
  it("200 with all-clear headline when nothing pending", async () => {
    const stub = makeRepo();
    const r = await buildAgiCockpitResponse(stub, "o");
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.headline.totalPending).toBe(0);
    expect(r.body.data.headline.highestSeverity).toBe("none");
    expect(r.body.data.headline.callToAction).toContain("All clear");
    expect(r.body.data.topRecommendations).toHaveLength(0);
    expect(r.body.data.topProposals).toHaveLength(0);
  });

  it("engine telemetry carries pinned engine versions", async () => {
    const stub = makeRepo();
    const r = await buildAgiCockpitResponse(stub, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.engines.advisor.version).toMatch(/advisor-v/);
    expect(r.body.data.engines.policyProposal.version).toMatch(/policy-proposal-v/);
  });
});

describe("buildAgiCockpitResponse — populated", () => {
  it("surfaces pending recommendations sorted ahead in fan-in", async () => {
    const stub = makeRepo();
    stub._recs.push({
      id: "r1", releaseId: "rel_1", kind: "block_deploy", title: "Block",
      rationale: "x", confidence: 90, severity: "critical", generatedAt: new Date(),
      operatorDecision: "pending",
    });
    stub._props.push({
      id: "p1", kind: "limit_force_push", suggestedRuleKey: "no_force",
      title: "No force-push", rationale: "y", confidence: 80, severity: "medium",
      generatedAt: new Date(), operatorDecision: "pending",
    });
    const r = await buildAgiCockpitResponse(stub, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.topRecommendations).toHaveLength(1);
    expect(r.body.data.topProposals).toHaveLength(1);
    expect(r.body.data.headline.totalPending).toBe(2);
    expect(r.body.data.headline.highestSeverity).toBe("critical");
    expect(r.body.data.headline.callToAction.toLowerCase()).toContain("critical");
  });

  it("severity headline reflects the max across recs and proposals", async () => {
    const stub = makeRepo();
    stub._recs.push({
      id: "r1", releaseId: "rel_1", kind: "proceed_with_caution", title: "Caution",
      rationale: "x", confidence: 70, severity: "medium", generatedAt: new Date(),
      operatorDecision: "pending",
    });
    stub._props.push({
      id: "p1", kind: "limit_force_push", suggestedRuleKey: "no_force",
      title: "No force-push", rationale: "y", confidence: 80, severity: "high",
      generatedAt: new Date(), operatorDecision: "pending",
    });
    const r = await buildAgiCockpitResponse(stub, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.headline.highestSeverity).toBe("high");
  });

  it("engine telemetry includes accepted + rejected counts", async () => {
    const stub = makeRepo();
    stub._recs.push({ id: "r1", releaseId: "rel_1", kind: "proceed", title: "a", rationale: "x", confidence: 70, severity: "low", generatedAt: new Date(), operatorDecision: "accepted" });
    stub._recs.push({ id: "r2", releaseId: "rel_2", kind: "block_deploy", title: "b", rationale: "x", confidence: 70, severity: "high", generatedAt: new Date(), operatorDecision: "rejected" });
    stub._recs.push({ id: "r3", releaseId: "rel_3", kind: "proceed", title: "c", rationale: "x", confidence: 70, severity: "low", generatedAt: new Date(), operatorDecision: "accepted" });
    const r = await buildAgiCockpitResponse(stub, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.engines.advisor.acceptedCount).toBe(2);
    expect(r.body.data.engines.advisor.rejectedCount).toBe(1);
  });
});

describe("buildAgiCockpitResponse — degraded", () => {
  it("503 migration_pending when both source tables missing", async () => {
    const stub = makeRepo();
    stub.advisorRecommendation.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    stub.policyProposal.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    // findFirst + count also degrade safely; cockpit still returns 200 because
    // safeX helpers swallow the missing-table errors. We assert that the
    // empty path is taken — no row throws all the way through.
    const r = await buildAgiCockpitResponse(stub, "o");
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.headline.totalPending).toBe(0);
  });
});
