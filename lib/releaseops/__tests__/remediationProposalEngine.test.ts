import { describe, expect, it } from "vitest";
import {
  generateRemediationProposals,
  REMEDIATION_ENGINE_VERSION,
  type RemediationInputs,
} from "../remediationProposalEngine";

const NOW = new Date("2026-05-28T12:00:00Z");

function baseInput(overrides: Partial<RemediationInputs> = {}): RemediationInputs {
  return {
    triage: {
      priority: "P1",
      suggestedOwnerTeam: "payments",
      recommendedRunbook: "checkout_outage",
      autoEscalate: true,
    },
    incident: {
      id: "inc_1",
      title: "Checkout 500 errors",
      summary: null,
      severity: "high",
      reportedAtIso: NOW.toISOString(),
    },
    release: {
      id: "rel_1",
      status: "deployed",
      releaseTag: "v1.2.3",
      previousSuccessfulTag: "v1.2.2",
      minutesSinceDeploy: 45,
      isProduction: true,
    },
    releaseFeatureFlags: [],
    isCapacitySaturated: false,
    thirdPartyDependencyHint: false,
    highErrorRate: false,
    availableRunbookKeys: [],
    now: NOW,
    ...overrides,
  };
}

describe("generateRemediationProposals — rollback", () => {
  it("proposes rollback when urgent + recent deploy + previous tag exists", () => {
    const out = generateRemediationProposals(baseInput());
    const rb = out.proposals.find((p) => p.kind === "rollback_release");
    expect(rb).toBeDefined();
    expect(rb?.title).toContain("v1.2.2");
    expect(rb?.confidence).toBeGreaterThanOrEqual(70);
    expect(rb?.reversible).toBe(true);
  });

  it("does NOT propose rollback when no previous tag", () => {
    const out = generateRemediationProposals(baseInput({
      release: { ...baseInput().release, previousSuccessfulTag: null },
    }));
    expect(out.proposals.find((p) => p.kind === "rollback_release")).toBeUndefined();
  });

  it("does NOT propose rollback when deploy is too old (> 4 hours)", () => {
    const out = generateRemediationProposals(baseInput({
      release: { ...baseInput().release, minutesSinceDeploy: 300 },
    }));
    expect(out.proposals.find((p) => p.kind === "rollback_release")).toBeUndefined();
  });

  it("does NOT propose rollback for P2/P3 (non-urgent)", () => {
    const out = generateRemediationProposals(baseInput({
      triage: { ...baseInput().triage, priority: "P2" },
    }));
    expect(out.proposals.find((p) => p.kind === "rollback_release")).toBeUndefined();
  });

  it("rollback confidence scales up for very recent deploys", () => {
    const old = generateRemediationProposals(baseInput({
      release: { ...baseInput().release, minutesSinceDeploy: 150 },
    }));
    const fresh = generateRemediationProposals(baseInput({
      release: { ...baseInput().release, minutesSinceDeploy: 10 },
    }));
    const oldRb = old.proposals.find((p) => p.kind === "rollback_release")!.confidence;
    const freshRb = fresh.proposals.find((p) => p.kind === "rollback_release")!.confidence;
    expect(freshRb).toBeGreaterThan(oldRb);
  });
});

describe("generateRemediationProposals — feature flag disable", () => {
  it("proposes flag disable when urgent + flags shipped", () => {
    const out = generateRemediationProposals(baseInput({
      releaseFeatureFlags: ["new_checkout_flow"],
    }));
    const ff = out.proposals.find((p) => p.kind === "disable_feature_flag");
    expect(ff).toBeDefined();
    expect(ff?.title).toContain("new_checkout_flow");
  });

  it("does NOT propose flag disable when no flags", () => {
    const out = generateRemediationProposals(baseInput());
    expect(out.proposals.find((p) => p.kind === "disable_feature_flag")).toBeUndefined();
  });

  it("confidence scales with flag count", () => {
    const one = generateRemediationProposals(baseInput({ releaseFeatureFlags: ["f1"] }));
    const many = generateRemediationProposals(baseInput({ releaseFeatureFlags: ["f1", "f2", "f3", "f4"] }));
    const oneCi = one.proposals.find((p) => p.kind === "disable_feature_flag")!.confidence;
    const manyCi = many.proposals.find((p) => p.kind === "disable_feature_flag")!.confidence;
    expect(manyCi).toBeGreaterThan(oneCi);
  });
});

describe("generateRemediationProposals — capacity / restart / throttle", () => {
  it("proposes increase_replicas on saturation", () => {
    const out = generateRemediationProposals(baseInput({ isCapacitySaturated: true }));
    expect(out.proposals.find((p) => p.kind === "increase_replicas")).toBeDefined();
  });

  it("proposes restart_service in absence of clearer signals", () => {
    const out = generateRemediationProposals(baseInput({
      release: { ...baseInput().release, previousSuccessfulTag: null },
    }));
    const rs = out.proposals.find((p) => p.kind === "restart_service");
    expect(rs).toBeDefined();
  });

  it("does NOT propose restart when capacity is saturated", () => {
    // Capacity is the better signal — restart shouldn't compete.
    const out = generateRemediationProposals(baseInput({
      isCapacitySaturated: true,
      release: { ...baseInput().release, previousSuccessfulTag: null },
    }));
    expect(out.proposals.find((p) => p.kind === "restart_service")).toBeUndefined();
  });

  it("proposes throttle on high error rate without saturation", () => {
    const out = generateRemediationProposals(baseInput({ highErrorRate: true }));
    expect(out.proposals.find((p) => p.kind === "throttle_requests")).toBeDefined();
  });
});

describe("generateRemediationProposals — vendor escalation", () => {
  it("proposes escalate_to_vendor on dependency hint regardless of urgency", () => {
    const out = generateRemediationProposals(baseInput({ thirdPartyDependencyHint: true }));
    expect(out.proposals.find((p) => p.kind === "escalate_to_vendor")).toBeDefined();
  });

  it("does not propose vendor escalation when no dependency signal", () => {
    const out = generateRemediationProposals(baseInput());
    expect(out.proposals.find((p) => p.kind === "escalate_to_vendor")).toBeUndefined();
  });
});

describe("generateRemediationProposals — redirect traffic", () => {
  it("proposes redirect only for P0 + prod + scoped fault pattern", () => {
    const out = generateRemediationProposals(baseInput({
      triage: { ...baseInput().triage, priority: "P0" },
      thirdPartyDependencyHint: true,
    }));
    expect(out.proposals.find((p) => p.kind === "redirect_traffic")).toBeDefined();
  });

  it("does NOT propose redirect for P1 even on prod (too aggressive)", () => {
    const out = generateRemediationProposals(baseInput({
      triage: { ...baseInput().triage, priority: "P1" },
      thirdPartyDependencyHint: true,
    }));
    expect(out.proposals.find((p) => p.kind === "redirect_traffic")).toBeUndefined();
  });
});

describe("generateRemediationProposals — no-action fallback", () => {
  it("emits no_action_recommended when nothing else triggers", () => {
    const out = generateRemediationProposals(baseInput({
      triage: { ...baseInput().triage, priority: "P3" },
      release: { ...baseInput().release, previousSuccessfulTag: null, minutesSinceDeploy: 500 },
    }));
    expect(out.proposals).toHaveLength(1);
    expect(out.proposals[0].kind).toBe("no_action_recommended");
    expect(out.primary).toBeNull();
  });

  it("no-action rationale tailors to triage priority", () => {
    const lowPri = generateRemediationProposals(baseInput({
      triage: { ...baseInput().triage, priority: "P3" },
      release: { ...baseInput().release, previousSuccessfulTag: null, minutesSinceDeploy: 500 },
    }));
    expect(lowPri.proposals[0].rationale.toLowerCase()).toContain("low");
  });
});

describe("generateRemediationProposals — primary selection + ranking", () => {
  it("primary picks the most severe non-no-action proposal", () => {
    const out = generateRemediationProposals(baseInput({
      triage: { ...baseInput().triage, priority: "P0" },
      releaseFeatureFlags: ["f1"],
      isCapacitySaturated: true,
      thirdPartyDependencyHint: true,
    }));
    expect(out.primary).not.toBeNull();
    expect(out.primary?.kind).not.toBe("no_action_recommended");
    // Highest-severity proposals come first.
    const severities = ["critical", "high", "medium", "low"];
    const firstSev = severities.indexOf(out.proposals[0].severity);
    const lastSev = severities.indexOf(out.proposals[out.proposals.length - 1].severity);
    expect(firstSev).toBeLessThanOrEqual(lastSev);
  });

  it("primary is null when only no_action_recommended fires", () => {
    const out = generateRemediationProposals(baseInput({
      triage: { ...baseInput().triage, priority: "P3" },
      release: { ...baseInput().release, previousSuccessfulTag: null, minutesSinceDeploy: 500 },
    }));
    expect(out.primary).toBeNull();
  });
});

describe("generateRemediationProposals — proposal fields", () => {
  it("rollback proposal carries prerequisites + rollback plan + reversibility", () => {
    const out = generateRemediationProposals(baseInput());
    const rb = out.proposals.find((p) => p.kind === "rollback_release")!;
    expect(rb.prerequisites.length).toBeGreaterThan(0);
    expect(rb.rollbackPlan).toBeTruthy();
    expect(rb.expectedImpact).toBeTruthy();
    expect(rb.reversible).toBe(true);
    expect(rb.estimatedMinutes).toBeGreaterThan(0);
  });

  it("output carries pinned engine version + timestamp", () => {
    const out = generateRemediationProposals(baseInput());
    expect(out.engineVersion).toBe(REMEDIATION_ENGINE_VERSION);
    expect(out.generatedAtIso).toBe(NOW.toISOString());
  });
});

describe("generateRemediationProposals — determinism", () => {
  it("same input produces same output", () => {
    const out1 = generateRemediationProposals(baseInput({
      releaseFeatureFlags: ["x"],
      isCapacitySaturated: true,
    }));
    const out2 = generateRemediationProposals(baseInput({
      releaseFeatureFlags: ["x"],
      isCapacitySaturated: true,
    }));
    expect(out1).toEqual(out2);
  });
});
