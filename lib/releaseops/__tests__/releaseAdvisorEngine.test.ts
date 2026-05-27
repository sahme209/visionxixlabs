import { describe, expect, it } from "vitest";
import {
  generateRecommendations,
  ENGINE_VERSION,
  type AdvisorInputs,
} from "../releaseAdvisorEngine";

const NOW = new Date("2026-05-26T12:00:00Z");

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

describe("generateRecommendations — happy path", () => {
  it("clean state yields a single 'proceed' with high confidence", () => {
    const out = generateRecommendations(baseInput());
    expect(out.engineVersion).toBe(ENGINE_VERSION);
    expect(out.recommendations).toHaveLength(1);
    expect(out.recommendations[0].kind).toBe("proceed");
    expect(out.recommendations[0].confidence).toBeGreaterThanOrEqual(80);
    expect(out.primary).toBeNull(); // no non-proceed item
  });
});

describe("generateRecommendations — block_deploy rules", () => {
  it("block_deploy fires on blocking policy violations", () => {
    const out = generateRecommendations(baseInput({
      policyViolations: { blocking: 2, warning: 0, advisory: 0 },
    }));
    const block = out.recommendations.find((r) => r.kind === "block_deploy");
    expect(block).toBeDefined();
    expect(block?.severity).toBe("critical");
    expect(block?.title).toContain("2 blocking policy");
    expect(out.primary?.kind).toBe("block_deploy");
  });

  it("block_deploy fires on critical readiness", () => {
    const out = generateRecommendations(baseInput({
      readiness: { ...baseInput().readiness!, riskLevel: "critical", overallScore: 35, blockerCount: 3 },
    }));
    const block = out.recommendations.find((r) => r.kind === "block_deploy");
    expect(block).toBeDefined();
    expect(block?.rationale).toContain("35");
  });

  it("confidence scales with blocking-violation count", () => {
    const out1 = generateRecommendations(baseInput({
      policyViolations: { blocking: 1, warning: 0, advisory: 0 },
    }));
    const out3 = generateRecommendations(baseInput({
      policyViolations: { blocking: 5, warning: 0, advisory: 0 },
    }));
    const c1 = out1.recommendations.find((r) => r.kind === "block_deploy")!.confidence;
    const c3 = out3.recommendations.find((r) => r.kind === "block_deploy")!.confidence;
    expect(c3).toBeGreaterThan(c1);
    expect(c3).toBeLessThanOrEqual(95);
  });
});

describe("generateRecommendations — rollback consideration", () => {
  it("fires when previous release rolled_back", () => {
    const out = generateRecommendations(baseInput({ previousReleaseStatus: "rolled_back" }));
    expect(out.recommendations.find((r) => r.kind === "rollback")).toBeDefined();
  });

  it("fires when previous release failed", () => {
    const out = generateRecommendations(baseInput({ previousReleaseStatus: "failed" }));
    expect(out.recommendations.find((r) => r.kind === "rollback")).toBeDefined();
  });

  it("does NOT fire when previous release deployed cleanly", () => {
    const out = generateRecommendations(baseInput({ previousReleaseStatus: "deployed" }));
    expect(out.recommendations.find((r) => r.kind === "rollback")).toBeUndefined();
  });
});

describe("generateRecommendations — needs_evidence", () => {
  it("fires when there are pending prod manual fixes", () => {
    const out = generateRecommendations(baseInput({
      pendingManualFixes: { total: 3, inProd: 3 },
    }));
    const ev = out.recommendations.find((r) => r.kind === "needs_evidence");
    expect(ev).toBeDefined();
    expect(ev?.severity).toBe("high");
  });

  it("does NOT fire when pending fixes are only in non-prod", () => {
    const out = generateRecommendations(baseInput({
      pendingManualFixes: { total: 3, inProd: 0 },
    }));
    expect(out.recommendations.find((r) => r.kind === "needs_evidence")).toBeUndefined();
  });
});

describe("generateRecommendations — propose_freeze", () => {
  it("fires when there are open critical incidents and not already in freeze", () => {
    const out = generateRecommendations(baseInput({
      recentIncidents: { open: 2, openCritical: 1, mitigated: 0 },
    }));
    expect(out.recommendations.find((r) => r.kind === "propose_freeze")).toBeDefined();
  });

  it("suppresses when already in planned freeze (avoid double-propose)", () => {
    const out = generateRecommendations(baseInput({
      recentIncidents: { open: 2, openCritical: 1, mitigated: 0 },
      isInPlannedFreeze: true,
    }));
    expect(out.recommendations.find((r) => r.kind === "propose_freeze")).toBeUndefined();
  });
});

describe("generateRecommendations — proceed_with_caution", () => {
  it("fires on high risk with no blockers", () => {
    const out = generateRecommendations(baseInput({
      readiness: { ...baseInput().readiness!, riskLevel: "high", overallScore: 68 },
    }));
    expect(out.recommendations.find((r) => r.kind === "proceed_with_caution")).toBeDefined();
    expect(out.recommendations.find((r) => r.kind === "proceed")).toBeUndefined();
  });

  it("suppressed when a block_deploy is already recommended", () => {
    const out = generateRecommendations(baseInput({
      readiness: { ...baseInput().readiness!, riskLevel: "high", overallScore: 50 },
      policyViolations: { blocking: 1, warning: 0, advisory: 0 },
    }));
    expect(out.recommendations.find((r) => r.kind === "block_deploy")).toBeDefined();
    expect(out.recommendations.find((r) => r.kind === "proceed_with_caution")).toBeUndefined();
  });

  it("triggers on >= 3 warning policy violations", () => {
    const out = generateRecommendations(baseInput({
      policyViolations: { blocking: 0, warning: 3, advisory: 0 },
    }));
    expect(out.recommendations.find((r) => r.kind === "proceed_with_caution")).toBeDefined();
  });
});

describe("generateRecommendations — branch protection hardening", () => {
  it("fires when force-push is allowed on main (high severity)", () => {
    const out = generateRecommendations(baseInput({
      branchProtection: { snapshotsTotal: 3, weakOrNone: 0, forcePushAllowedOnMain: true },
    }));
    const bp = out.recommendations.find((r) => r.kind === "propose_branch_protection_strengthen");
    expect(bp).toBeDefined();
    expect(bp?.severity).toBe("high");
  });

  it("fires on weak protection (medium severity)", () => {
    const out = generateRecommendations(baseInput({
      branchProtection: { snapshotsTotal: 3, weakOrNone: 2, forcePushAllowedOnMain: false },
    }));
    const bp = out.recommendations.find((r) => r.kind === "propose_branch_protection_strengthen");
    expect(bp?.severity).toBe("medium");
  });

  it("does NOT fire when no snapshots exist yet", () => {
    const out = generateRecommendations(baseInput({
      branchProtection: { snapshotsTotal: 0, weakOrNone: 0, forcePushAllowedOnMain: false },
    }));
    expect(out.recommendations.find((r) => r.kind === "propose_branch_protection_strengthen")).toBeUndefined();
  });
});

describe("generateRecommendations — propose_manual_fix_log", () => {
  it("fires after deploy when reconciliation score is low + no pending fixes logged", () => {
    const out = generateRecommendations(baseInput({
      release: { ...baseInput().release, status: "deployed" },
      readiness: { ...baseInput().readiness!, manualReconciliation: 40 },
      pendingManualFixes: { total: 0, inProd: 0 },
    }));
    expect(out.recommendations.find((r) => r.kind === "propose_manual_fix_log")).toBeDefined();
  });

  it("suppressed when fixes are already logged", () => {
    const out = generateRecommendations(baseInput({
      release: { ...baseInput().release, status: "deployed" },
      readiness: { ...baseInput().readiness!, manualReconciliation: 40 },
      pendingManualFixes: { total: 2, inProd: 1 },
    }));
    expect(out.recommendations.find((r) => r.kind === "propose_manual_fix_log")).toBeUndefined();
  });
});

describe("generateRecommendations — ranking", () => {
  it("primary picks the highest-ranked non-proceed recommendation", () => {
    const out = generateRecommendations(baseInput({
      policyViolations: { blocking: 2, warning: 0, advisory: 0 },
      pendingManualFixes: { total: 1, inProd: 1 },
      branchProtection: { snapshotsTotal: 1, weakOrNone: 1, forcePushAllowedOnMain: false },
    }));
    // block_deploy is the top-ranked kind
    expect(out.primary?.kind).toBe("block_deploy");
    expect(out.recommendations[0].kind).toBe("block_deploy");
    // branch_protection_strengthen should be near the bottom
    expect(out.recommendations[out.recommendations.length - 1].kind).toBe("propose_branch_protection_strengthen");
  });

  it("primary is null when only 'proceed' fires", () => {
    const out = generateRecommendations(baseInput());
    expect(out.primary).toBeNull();
  });
});

describe("generateRecommendations — deadlines", () => {
  it("block_deploy gets a tight 4-hour deadline", () => {
    const out = generateRecommendations(baseInput({
      policyViolations: { blocking: 1, warning: 0, advisory: 0 },
    }));
    const block = out.recommendations.find((r) => r.kind === "block_deploy")!;
    expect(block.deadlineIso).not.toBeNull();
    const deadline = new Date(block.deadlineIso!);
    expect(deadline.getTime() - NOW.getTime()).toBe(4 * 3_600_000);
  });

  it("proceed has no deadline", () => {
    const out = generateRecommendations(baseInput());
    expect(out.recommendations[0].deadlineIso).toBeNull();
  });
});

describe("generateRecommendations — engine version", () => {
  it("output always carries the current engine version", () => {
    const out = generateRecommendations(baseInput());
    expect(out.engineVersion).toBe(ENGINE_VERSION);
  });

  it("generatedAtIso matches the input now", () => {
    const out = generateRecommendations(baseInput());
    expect(out.generatedAtIso).toBe(NOW.toISOString());
  });
});
