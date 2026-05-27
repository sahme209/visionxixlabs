import { describe, expect, it } from "vitest";
import {
  evaluateReleaseReadiness,
  riskLevelFromScore,
  type ReadinessEvalInput,
} from "../releaseReadinessEvaluator";

function input(over: Partial<ReadinessEvalInput> = {}): ReadinessEvalInput {
  return {
    release: {
      id: "rel_1",
      releaseTag: "v1.0.0",
      commitSha: "abc",
      scopeFinalizedAt: new Date("2026-05-23"),
      rollbackReferenceReleaseId: "rel_prev",
      summary: "Security patch + perf improvements across checkout.",
    },
    branchValidation: { total: 18, passing: 16, failing: 0, notApplicable: 2, unknown: 0 },
    cherryPicks: [],
    policyViolations: [],
    linkedTickets: [{ status: "implemented" }],
    hasManualProdFixes: false,
    ...over,
  };
}

describe("riskLevelFromScore", () => {
  it("80+ → low", () => expect(riskLevelFromScore(85)).toBe("low"));
  it("60-79 → medium", () => expect(riskLevelFromScore(70)).toBe("medium"));
  it("40-59 → high", () => expect(riskLevelFromScore(50)).toBe("high"));
  it("<40 → critical", () => expect(riskLevelFromScore(20)).toBe("critical"));
});

describe("evaluateReleaseReadiness", () => {
  it("clean release → high score + no blockers + low risk", () => {
    const r = evaluateReleaseReadiness(input());
    expect(r.overallScore).toBeGreaterThanOrEqual(80);
    expect(r.riskLevel).toBe("low");
    expect(r.blockers).toEqual([]);
  });

  it("branch validation failing → adds branch_governance blocker + lowers score", () => {
    const r = evaluateReleaseReadiness(input({
      branchValidation: { total: 18, passing: 12, failing: 4, notApplicable: 2, unknown: 0 },
    }));
    const b = r.blockers.find((x) => x.category === "branch_governance");
    expect(b).toBeDefined();
    expect(b?.severity).toBe("critical"); // failing >= 3
    expect(r.branchGovernance).toBeLessThan(80);
  });

  it("no rollback reference → rollback_readiness blocker", () => {
    const r = evaluateReleaseReadiness(input({
      release: { ...input().release, rollbackReferenceReleaseId: null },
    }));
    expect(r.blockers.some((x) => x.category === "rollback_readiness")).toBe(true);
    expect(r.rollbackReadiness).toBe(30);
  });

  it("no commit SHA → artifact_traceability blocker", () => {
    const r = evaluateReleaseReadiness(input({
      release: { ...input().release, commitSha: null },
    }));
    expect(r.blockers.some((x) => x.category === "artifact_traceability")).toBe(true);
    expect(r.artifactTraceability).toBeLessThan(80);
  });

  it("no ticket linked → change_compliance blocker, score = 40", () => {
    const r = evaluateReleaseReadiness(input({ linkedTickets: [] }));
    expect(r.blockers.some((x) => x.category === "change_compliance")).toBe(true);
    expect(r.changeCompliance).toBe(40);
  });

  it("open blocking violation → drift_risk critical blocker + score collapses", () => {
    const r = evaluateReleaseReadiness(input({
      policyViolations: [
        { severity: "blocker", status: "open", blocking: true },
        { severity: "blocker", status: "open", blocking: true },
      ],
    }));
    const drift = r.blockers.find((x) => x.category === "drift_risk");
    expect(drift?.severity).toBe("critical");
    expect(r.driftRisk).toBeLessThan(40);
  });

  it("approved cherry-pick without final commit validation → manual_reconciliation blocker", () => {
    const r = evaluateReleaseReadiness(input({
      cherryPicks: [{ status: "approved", hasFinalCommitValidation: false }],
    }));
    expect(r.blockers.some((x) => x.category === "manual_reconciliation")).toBe(true);
    expect(r.manualReconciliation).toBe(60);
  });

  it("manual prod fix flag → reconciliation blocker overrides cherry-pick", () => {
    const r = evaluateReleaseReadiness(input({ hasManualProdFixes: true }));
    expect(r.blockers.some((x) => x.category === "manual_reconciliation")).toBe(true);
    expect(r.manualReconciliation).toBe(40);
  });

  it("missing summary → communication_readiness blocker", () => {
    const r = evaluateReleaseReadiness(input({
      release: { ...input().release, summary: null },
    }));
    expect(r.blockers.some((x) => x.category === "communication_readiness")).toBe(true);
    expect(r.communicationReadiness).toBe(50);
  });

  it("all 8 dimensions averaged into overallScore", () => {
    const r = evaluateReleaseReadiness(input());
    const expected = Math.round(
      (r.branchGovernance + r.changeCompliance + r.artifactTraceability + r.secretTraceability +
        r.rollbackReadiness + r.communicationReadiness + r.driftRisk + r.manualReconciliation) / 8,
    );
    expect(r.overallScore).toBe(expected);
  });
});
