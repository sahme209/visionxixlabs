import { describe, expect, it } from "vitest";
import {
  generatePolicyProposals,
  POLICY_PROPOSAL_ENGINE_VERSION,
  type PolicyProposalInputs,
} from "../policyProposalEngine";

const NOW = new Date("2026-05-26T12:00:00Z");

function baseInput(overrides: Partial<PolicyProposalInputs> = {}): PolicyProposalInputs {
  return {
    releasesAnalyzed: 0,
    releasesWithOpenCriticalIncident: 0,
    releasesWithWeakRollbackReadiness: 0,
    releasesWithoutEvidencePack: 0,
    releasesWithUnreconciledManualFix: 0,
    releasesWithoutReleaseNotes: 0,
    weakProtectionMainRepos: 0,
    forcePushAllowedMainRepos: 0,
    releasesWithoutChangeTicket: 0,
    existingActiveRuleKeys: [],
    pendingProposalKeys: [],
    now: NOW,
    ...overrides,
  };
}

describe("generatePolicyProposals — happy path", () => {
  it("clean state produces zero proposals", () => {
    const out = generatePolicyProposals(baseInput({ releasesAnalyzed: 5 }));
    expect(out.proposals).toHaveLength(0);
    expect(out.engineVersion).toBe(POLICY_PROPOSAL_ENGINE_VERSION);
    expect(out.generatedAtIso).toBe(NOW.toISOString());
  });
});

describe("force-push proposal", () => {
  it("fires even on a single repo (security-critical)", () => {
    const out = generatePolicyProposals(baseInput({
      releasesAnalyzed: 5,
      forcePushAllowedMainRepos: 1,
    }));
    const p = out.proposals.find((p) => p.kind === "limit_force_push");
    expect(p).toBeDefined();
    expect(p?.severity).toBe("critical");
    expect(p?.suggestedRuleBody.defaultBlocking).toBe(true);
  });

  it("confidence scales with repo count", () => {
    const small = generatePolicyProposals(baseInput({ forcePushAllowedMainRepos: 1 }));
    const big = generatePolicyProposals(baseInput({ forcePushAllowedMainRepos: 4 }));
    const c1 = small.proposals.find((p) => p.kind === "limit_force_push")!.confidence;
    const c4 = big.proposals.find((p) => p.kind === "limit_force_push")!.confidence;
    expect(c4).toBeGreaterThan(c1);
    expect(c4).toBeLessThanOrEqual(95);
  });
});

describe("strong-protection proposal", () => {
  it("fires when ≥2 repos have weak protection on main", () => {
    const out = generatePolicyProposals(baseInput({ weakProtectionMainRepos: 3 }));
    expect(out.proposals.find((p) => p.kind === "require_strong_branch_protection")).toBeDefined();
  });

  it("does NOT fire on a single weak repo (noise threshold)", () => {
    const out = generatePolicyProposals(baseInput({ weakProtectionMainRepos: 1 }));
    expect(out.proposals.find((p) => p.kind === "require_strong_branch_protection")).toBeUndefined();
  });
});

describe("rollback-rehearsal proposal", () => {
  it("fires when ≥30% of releases have weak rollback readiness AND there's an incident", () => {
    const out = generatePolicyProposals(baseInput({
      releasesAnalyzed: 10,
      releasesWithWeakRollbackReadiness: 4,
      releasesWithOpenCriticalIncident: 2,
    }));
    expect(out.proposals.find((p) => p.kind === "require_rollback_rehearsal")).toBeDefined();
  });

  it("does NOT fire without any open critical incidents (rollback hasn't been needed)", () => {
    const out = generatePolicyProposals(baseInput({
      releasesAnalyzed: 10,
      releasesWithWeakRollbackReadiness: 5,
      releasesWithOpenCriticalIncident: 0,
    }));
    expect(out.proposals.find((p) => p.kind === "require_rollback_rehearsal")).toBeUndefined();
  });
});

describe("evidence-pack proposal", () => {
  it("fires when > 50% releases lack evidence packs", () => {
    const out = generatePolicyProposals(baseInput({
      releasesAnalyzed: 6,
      releasesWithoutEvidencePack: 4,
    }));
    expect(out.proposals.find((p) => p.kind === "require_evidence_pack_signed")).toBeDefined();
  });

  it("does NOT fire on small samples (<3 releases)", () => {
    const out = generatePolicyProposals(baseInput({
      releasesAnalyzed: 2,
      releasesWithoutEvidencePack: 2,
    }));
    expect(out.proposals.find((p) => p.kind === "require_evidence_pack_signed")).toBeUndefined();
  });
});

describe("manual-fix reconciliation proposal", () => {
  it("fires when ≥25% releases ship with unreconciled manual fixes (sample ≥4)", () => {
    const out = generatePolicyProposals(baseInput({
      releasesAnalyzed: 8,
      releasesWithUnreconciledManualFix: 3,
    }));
    expect(out.proposals.find((p) => p.kind === "require_manual_fix_reconciliation")).toBeDefined();
  });

  it("does NOT fire on small samples", () => {
    const out = generatePolicyProposals(baseInput({
      releasesAnalyzed: 3,
      releasesWithUnreconciledManualFix: 2,
    }));
    expect(out.proposals.find((p) => p.kind === "require_manual_fix_reconciliation")).toBeUndefined();
  });
});

describe("release-notes proposal", () => {
  it("fires when ≥50% releases ship without notes (sample ≥4)", () => {
    const out = generatePolicyProposals(baseInput({
      releasesAnalyzed: 6,
      releasesWithoutReleaseNotes: 5,
    }));
    const p = out.proposals.find((p) => p.kind === "require_release_notes_published");
    expect(p).toBeDefined();
    expect(p?.severity).toBe("low");
    expect(p?.suggestedRuleBody.defaultBlocking).toBe(false);
  });
});

describe("change-ticket proposal", () => {
  it("fires when ≥50% releases ship without change tickets (sample ≥4)", () => {
    const out = generatePolicyProposals(baseInput({
      releasesAnalyzed: 8,
      releasesWithoutChangeTicket: 5,
    }));
    expect(out.proposals.find((p) => p.kind === "require_change_ticket")).toBeDefined();
  });
});

describe("suppression — existing + pending", () => {
  it("suppresses a proposal whose rule key already exists in the active rule set", () => {
    const out = generatePolicyProposals(baseInput({
      forcePushAllowedMainRepos: 2,
      existingActiveRuleKeys: ["limit_force_push_on_main"],
    }));
    expect(out.proposals.find((p) => p.kind === "limit_force_push")).toBeUndefined();
    expect(out.summary.suppressedExisting).toBe(1);
  });

  it("suppresses a proposal whose key is already pending operator decision", () => {
    const out = generatePolicyProposals(baseInput({
      forcePushAllowedMainRepos: 2,
      pendingProposalKeys: ["limit_force_push_on_main"],
    }));
    expect(out.proposals.find((p) => p.kind === "limit_force_push")).toBeUndefined();
    expect(out.summary.suppressedPending).toBe(1);
  });

  it("multiple proposals can fire simultaneously when nothing is suppressed", () => {
    const out = generatePolicyProposals(baseInput({
      releasesAnalyzed: 10,
      forcePushAllowedMainRepos: 1,
      weakProtectionMainRepos: 4,
      releasesWithWeakRollbackReadiness: 4,
      releasesWithOpenCriticalIncident: 2,
      releasesWithoutEvidencePack: 6,
    }));
    expect(out.proposals.length).toBeGreaterThanOrEqual(4);
    expect(out.proposals[0].severity).toBe("critical"); // force-push wins by severity
  });
});

describe("ranking", () => {
  it("higher-severity proposals come first; ties broken by confidence desc", () => {
    const out = generatePolicyProposals(baseInput({
      releasesAnalyzed: 10,
      forcePushAllowedMainRepos: 1,           // critical
      weakProtectionMainRepos: 4,              // high
      releasesWithoutReleaseNotes: 6,          // low
    }));
    expect(out.proposals[0].kind).toBe("limit_force_push");
    expect(out.proposals[out.proposals.length - 1].severity).toBe("low");
  });
});

describe("engine version + timestamp", () => {
  it("output carries the engine version + input now timestamp", () => {
    const out = generatePolicyProposals(baseInput());
    expect(out.engineVersion).toBe(POLICY_PROPOSAL_ENGINE_VERSION);
    expect(out.generatedAtIso).toBe(NOW.toISOString());
  });
});

describe("evidence projection", () => {
  it("each fired proposal lists the metric + threshold it tripped", () => {
    const out = generatePolicyProposals(baseInput({
      forcePushAllowedMainRepos: 2,
    }));
    const p = out.proposals[0];
    expect(p.evidence.length).toBeGreaterThan(0);
    expect(p.evidence[0]).toHaveProperty("metric");
    expect(p.evidence[0]).toHaveProperty("value");
    expect(p.evidence[0]).toHaveProperty("threshold");
  });
});
