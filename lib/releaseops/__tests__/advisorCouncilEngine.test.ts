import { describe, expect, it } from "vitest";
import {
  runAdvisorCouncil,
  ruleBasedVoter,
  conservativeVoter,
  pragmaticVoter,
  COUNCIL_ENGINE_VERSION,
  type AdvisorVoter,
} from "../advisorCouncilEngine";
import type { AdvisorInputs } from "../releaseAdvisorEngine";

const NOW = new Date("2026-05-28T12:00:00Z");

function baseInput(overrides: Partial<AdvisorInputs> = {}): AdvisorInputs {
  return {
    release: {
      id: "rel_1",
      status: "ready",
      releaseTag: "v1.2.3",
      commitSha: "abc1234",
      plannedWindowStart: null,
      plannedWindowEnd: null,
    },
    readiness: {
      overallScore: 85,
      riskLevel: "low",
      blockerCount: 0,
      branchGovernance: 80,
      changeCompliance: 90,
      secretTraceability: 85,
      rollbackReadiness: 75,
      manualReconciliation: 90,
    },
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

describe("ruleBasedVoter", () => {
  it("returns rule-based engine's primary kind", () => {
    const v = ruleBasedVoter(baseInput({
      policyViolations: { blocking: 1, warning: 0, advisory: 0 },
    }));
    expect(v.voterId).toBe("rule_based");
    expect(v.kind).toBe("block_deploy");
  });

  it("defaults to proceed on clean state", () => {
    const v = ruleBasedVoter(baseInput());
    expect(v.kind).toBe("proceed");
  });
});

describe("conservativeVoter", () => {
  it("blocks on any blocking violation", () => {
    const v = conservativeVoter(baseInput({
      policyViolations: { blocking: 1, warning: 0, advisory: 0 },
    }));
    expect(v.kind).toBe("block_deploy");
    expect(v.confidence).toBeGreaterThanOrEqual(85);
  });

  it("blocks on critical readiness", () => {
    const v = conservativeVoter(baseInput({
      readiness: { ...baseInput().readiness!, riskLevel: "critical", overallScore: 30 },
    }));
    expect(v.kind).toBe("block_deploy");
  });

  it("recommends rollback when previous release rolled_back", () => {
    const v = conservativeVoter(baseInput({ previousReleaseStatus: "rolled_back" }));
    expect(v.kind).toBe("rollback");
  });

  it("requests evidence on pending prod manual fixes", () => {
    const v = conservativeVoter(baseInput({
      pendingManualFixes: { total: 2, inProd: 2 },
    }));
    expect(v.kind).toBe("needs_evidence");
  });

  it("proposes freeze on open critical incidents", () => {
    const v = conservativeVoter(baseInput({
      recentIncidents: { open: 1, openCritical: 1, mitigated: 0 },
    }));
    expect(v.kind).toBe("propose_freeze");
  });

  it("calls caution on medium readiness even with no blockers", () => {
    const v = conservativeVoter(baseInput({
      readiness: { ...baseInput().readiness!, overallScore: 65 },
    }));
    expect(v.kind).toBe("proceed_with_caution");
  });

  it("concedes to proceed only when readiness is very high (≥90)", () => {
    const v = conservativeVoter(baseInput({
      readiness: { ...baseInput().readiness!, overallScore: 92 },
    }));
    expect(v.kind).toBe("proceed");
  });

  it("dissents from full proceed on mid-readiness — biases toward caution", () => {
    const v = conservativeVoter(baseInput({
      readiness: { ...baseInput().readiness!, overallScore: 80 },
    }));
    // 80 < 90 → caution, not proceed
    expect(v.kind).toBe("proceed_with_caution");
  });
});

describe("pragmaticVoter", () => {
  it("blocks only on ≥2 blocking violations", () => {
    const single = pragmaticVoter(baseInput({
      policyViolations: { blocking: 1, warning: 0, advisory: 0 },
    }));
    const double = pragmaticVoter(baseInput({
      policyViolations: { blocking: 2, warning: 0, advisory: 0 },
    }));
    expect(single.kind).toBe("proceed");
    expect(double.kind).toBe("block_deploy");
  });

  it("proceeds on critical readiness alone (insists on multiple blockers)", () => {
    const v = pragmaticVoter(baseInput({
      readiness: { ...baseInput().readiness!, riskLevel: "critical", blockerCount: 1 },
    }));
    expect(v.kind).toBe("proceed");
  });

  it("blocks on critical + multiple blockers", () => {
    const v = pragmaticVoter(baseInput({
      readiness: { ...baseInput().readiness!, riskLevel: "critical", blockerCount: 3 },
    }));
    expect(v.kind).toBe("block_deploy");
  });

  it("proposes freeze only on ≥2 open critical incidents", () => {
    const one = pragmaticVoter(baseInput({
      recentIncidents: { open: 1, openCritical: 1, mitigated: 0 },
    }));
    const two = pragmaticVoter(baseInput({
      recentIncidents: { open: 2, openCritical: 2, mitigated: 0 },
    }));
    expect(one.kind).toBe("proceed");
    expect(two.kind).toBe("propose_freeze");
  });

  it("proceeds confidently on readiness ≥ 70", () => {
    const v = pragmaticVoter(baseInput({
      readiness: { ...baseInput().readiness!, overallScore: 72 },
    }));
    expect(v.kind).toBe("proceed");
    expect(v.confidence).toBeGreaterThanOrEqual(80);
  });
});

describe("runAdvisorCouncil — consensus", () => {
  it("clean state: all three voters proceed → consensus proceed", () => {
    const out = runAdvisorCouncil(baseInput());
    expect(out.consensusKind).toBe("proceed");
    expect(out.agreementScore).toBeGreaterThan(50);
    expect(out.voterCount).toBe(3);
  });

  it("blocking violation: rule-based + conservative both block; pragmatic proceeds → block wins (2 of 3)", () => {
    const out = runAdvisorCouncil(baseInput({
      policyViolations: { blocking: 1, warning: 0, advisory: 0 },
    }));
    expect(out.consensusKind).toBe("block_deploy");
    expect(out.agreementScore).toBeGreaterThanOrEqual(60);
  });

  it("each vote has a voter id, kind, confidence, and rationale", () => {
    const out = runAdvisorCouncil(baseInput());
    expect(out.votes).toHaveLength(3);
    expect(out.votes.map((v) => v.voterId).sort()).toEqual(["conservative", "pragmatic", "rule_based"]);
    for (const v of out.votes) {
      expect(v.kind).toBeDefined();
      expect(v.confidence).toBeGreaterThanOrEqual(0);
      expect(v.confidence).toBeLessThanOrEqual(100);
      expect(v.rationale).toBeTruthy();
    }
  });

  it("title reflects consensus kind", () => {
    const out = runAdvisorCouncil(baseInput({
      policyViolations: { blocking: 1, warning: 0, advisory: 0 },
    }));
    expect(out.title).toContain("Block deploy");
  });

  it("rationale cites dissent when one voter disagrees", () => {
    const out = runAdvisorCouncil(baseInput({
      policyViolations: { blocking: 1, warning: 0, advisory: 0 },
    }));
    // Pragmatic dissents — should be cited.
    expect(out.rationale.toLowerCase()).toContain("dissent");
    expect(out.rationale).toContain("pragmatic");
  });

  it("rationale notes full agreement when no dissent", () => {
    // Very high readiness — conservative concedes to proceed, all three agree.
    const out = runAdvisorCouncil(baseInput({
      readiness: { ...baseInput().readiness!, overallScore: 95 },
    }));
    expect(out.consensusKind).toBe("proceed");
    expect(out.rationale.toLowerCase()).toContain("all voters agreed");
  });
});

describe("runAdvisorCouncil — no consensus", () => {
  it("three voters each going different kinds → no_consensus", () => {
    const voterA: AdvisorVoter = () => ({ voterId: "a", kind: "block_deploy", confidence: 60, rationale: "x" });
    const voterB: AdvisorVoter = () => ({ voterId: "b", kind: "proceed_with_caution", confidence: 60, rationale: "y" });
    const voterC: AdvisorVoter = () => ({ voterId: "c", kind: "proceed", confidence: 60, rationale: "z" });
    const out = runAdvisorCouncil(baseInput(), [voterA, voterB, voterC]);
    expect(out.consensusKind).toBe("no_consensus");
    expect(out.rationale.toLowerCase()).toContain("no strict majority");
    expect(out.title).toContain("No consensus");
  });

  it("agreement score reflects largest-kind weight share", () => {
    // 100 + 100 vs 50 → block_deploy has 200/250 = 80% agreement
    const v1: AdvisorVoter = () => ({ voterId: "v1", kind: "block_deploy", confidence: 100, rationale: "a" });
    const v2: AdvisorVoter = () => ({ voterId: "v2", kind: "block_deploy", confidence: 100, rationale: "b" });
    const v3: AdvisorVoter = () => ({ voterId: "v3", kind: "proceed", confidence: 50, rationale: "c" });
    const out = runAdvisorCouncil(baseInput(), [v1, v2, v3]);
    expect(out.consensusKind).toBe("block_deploy");
    expect(out.agreementScore).toBe(80);
  });
});

describe("runAdvisorCouncil — defensive", () => {
  it("captures voter exceptions as 'errored_voter' votes", () => {
    const boomVoter: AdvisorVoter = () => { throw new Error("voter bug"); };
    const out = runAdvisorCouncil(baseInput(), [ruleBasedVoter, boomVoter, pragmaticVoter]);
    const errored = out.votes.find((v) => v.voterId === "errored_voter");
    expect(errored).toBeDefined();
    expect(errored?.kind).toBe("proceed");
    expect(errored?.rationale).toContain("voter bug");
  });

  it("clamps invalid kinds to 'proceed'", () => {
    const weirdVoter: AdvisorVoter = () => ({ voterId: "weird", kind: "not_a_real_kind" as never, confidence: 80, rationale: "x" });
    const out = runAdvisorCouncil(baseInput(), [weirdVoter]);
    expect(out.votes[0].kind).toBe("proceed");
  });

  it("clamps confidence to [0, 100]", () => {
    const overVoter: AdvisorVoter = () => ({ voterId: "over", kind: "proceed", confidence: 9999, rationale: "x" });
    const negVoter: AdvisorVoter = () => ({ voterId: "neg", kind: "proceed", confidence: -50, rationale: "y" });
    const out = runAdvisorCouncil(baseInput(), [overVoter, negVoter]);
    expect(out.votes[0].confidence).toBe(100);
    expect(out.votes[1].confidence).toBe(0);
  });

  it("zero voters → no_consensus with zero agreement", () => {
    const out = runAdvisorCouncil(baseInput(), []);
    expect(out.consensusKind).toBe("no_consensus");
    expect(out.agreementScore).toBe(0);
    expect(out.votes).toHaveLength(0);
  });
});

describe("runAdvisorCouncil — engine version + determinism", () => {
  it("output carries pinned engine version", () => {
    const out = runAdvisorCouncil(baseInput());
    expect(out.engineVersion).toBe(COUNCIL_ENGINE_VERSION);
  });

  it("same input → same output across runs (determinism)", () => {
    const out1 = runAdvisorCouncil(baseInput({
      readiness: { ...baseInput().readiness!, overallScore: 75 },
    }));
    const out2 = runAdvisorCouncil(baseInput({
      readiness: { ...baseInput().readiness!, overallScore: 75 },
    }));
    expect(out1).toEqual(out2);
  });
});
