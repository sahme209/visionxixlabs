import { describe, expect, it } from "vitest";
import {
  buildLearningLoopResponse,
  type AdvisorRowForLearning,
  type LearningLoopRepo,
  type ProposalRowForLearning,
  type TriageRowForLearning,
} from "../learningLoopResponder";

interface Stub extends LearningLoopRepo {
  _advisor: AdvisorRowForLearning[];
  _proposal: ProposalRowForLearning[];
  _triage: TriageRowForLearning[];
}

function makeRepo(): Stub {
  const stub: Stub = {
    _advisor: [],
    _proposal: [],
    _triage: [],
    advisorRecommendation: {
      async findMany() { return stub._advisor; },
    },
    policyProposal: {
      async findMany() { return stub._proposal; },
    },
    incidentTriage: {
      async findMany() { return stub._triage; },
    },
  };
  return stub;
}

describe("buildLearningLoopResponse", () => {
  it("200 empty when no decisions yet", async () => {
    const stub = makeRepo();
    const r = await buildLearningLoopResponse(stub, "o");
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.totalDecisionsAnalyzed).toBe(0);
    expect(r.body.data.signals).toHaveLength(0);
  });

  it("200 aggregates rows from all three engines + surfaces rejection cluster", async () => {
    const stub = makeRepo();
    const decidedAt = new Date();
    // Three advisor rejections where "maintenance" appears in every note
    // but no other token ties — guarantees a unique top cluster.
    stub._advisor.push({ kind: "propose_freeze", operatorDecision: "rejected", decisionNote: "maintenance scheduled", confidence: 75, decidedAt });
    stub._advisor.push({ kind: "propose_freeze", operatorDecision: "rejected", decisionNote: "maintenance window known", confidence: 75, decidedAt });
    stub._advisor.push({ kind: "propose_freeze", operatorDecision: "rejected", decisionNote: "maintenance acknowledged", confidence: 75, decidedAt });
    const r = await buildLearningLoopResponse(stub, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.totalDecisionsAnalyzed).toBe(3);
    const cluster = r.body.data.signals.find((s) => s.kind === "rejection_cluster");
    expect(cluster).toBeDefined();
    expect(cluster?.engine).toBe("release_advisor");
    expect(cluster?.targetKind).toBe("propose_freeze");
    expect(cluster?.keyword).toBe("maintenance");
  });

  it("triage rows bucket by priority for targeted feedback", async () => {
    const stub = makeRepo();
    const decidedAt = new Date();
    for (let i = 0; i < 2; i++) {
      stub._triage.push({
        priority: "P2",
        operatorDecision: "overridden",
        decisionNote: "data loss — should be P0",
        confidence: 70,
        decidedAt,
      });
    }
    const r = await buildLearningLoopResponse(stub, "o");
    if (!r.body.ok) throw new Error("expected ok");
    const override = r.body.data.signals.find((s) => s.kind === "override_cluster");
    expect(override).toBeDefined();
    expect(override?.engine).toBe("incident_triage");
    expect(override?.targetKind).toBe("P2"); // triage rows bucket by priority
  });

  it("ignores rows with unknown decisions (defensive)", async () => {
    const stub = makeRepo();
    stub._advisor.push({
      kind: "x",
      operatorDecision: "something-weird",
      decisionNote: "maintenance",
      confidence: 70,
      decidedAt: new Date(),
    });
    const r = await buildLearningLoopResponse(stub, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.totalDecisionsAnalyzed).toBe(0);
  });

  it("503 not necessary — missing tables degrade to empty", async () => {
    const stub = makeRepo();
    stub.advisorRecommendation.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    stub.policyProposal.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    stub.incidentTriage.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildLearningLoopResponse(stub, "o");
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.totalDecisionsAnalyzed).toBe(0);
  });

  // ── Phase 515 — council snapshots feed voter-dissent signals ──
  it("voter_dissent_pattern fires when council snapshots show persistent disagreement", async () => {
    const stub = makeRepo();
    const councilRows = Array.from({ length: 3 }, (_, i) => ({
      id: `cd_${i}`,
      consensusKind: "proceed",
      votesJson: [
        { voterId: "rule_based", kind: "proceed", confidence: 70 },
        { voterId: "conservative", kind: "proceed_with_caution", confidence: 60 },
      ],
      generatedAt: new Date(),
    }));
    stub.advisorCouncilDecision = {
      async findMany() { return councilRows; },
    };
    const r = await buildLearningLoopResponse(stub, "o");
    if (!r.body.ok) throw new Error("expected ok");
    const dissent = r.body.data.signals.find((s) => s.kind === "voter_dissent_pattern");
    expect(dissent).toBeDefined();
    expect(dissent?.engine).toBe("advisor_council");
  });

  it("council source absent → no voter_dissent_pattern signals (backwards compat)", async () => {
    const stub = makeRepo();
    // No advisorCouncilDecision on stub — should not crash.
    const r = await buildLearningLoopResponse(stub, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.signals.find((s) => s.kind === "voter_dissent_pattern")).toBeUndefined();
  });
});
