import { describe, expect, it } from "vitest";
import {
  buildRemediationFallbackRationale,
  buildRemediationRationalePrompt,
  enrichRemediationRationale,
  REMEDIATION_RATIONALE_ENGINE_VERSION,
} from "../aiRemediationRationaleEngine";
import type { RationaleAiFetcher } from "../aiRationaleEnricherEngine";
import type { RemediationInputs, RemediationProposal } from "../remediationProposalEngine";

const NOW = new Date("2026-05-28T12:00:00Z");

function proposal(overrides: Partial<RemediationProposal> = {}): RemediationProposal {
  return {
    kind: "rollback_release",
    title: "Roll back to v3.4.0",
    description: "Most recent release v3.4.1 introduced the 5xx regression. Roll back to v3.4.0.",
    confidence: 80,
    severity: "high",
    prerequisites: ["Confirm v3.4.0 release artifacts are available"],
    expectedImpact: "Returns error rates to pre-deploy baseline within ~10 minutes",
    rollbackPlan: "Re-deploy v3.4.1 once the regression is patched",
    estimatedMinutes: 15,
    reversible: true,
    rationale: "Recent prod release, error spike, capacity not saturated.",
    ...overrides,
  };
}

function inputs(overrides: Partial<RemediationInputs> = {}): RemediationInputs {
  return {
    triage: {
      priority: "P1",
      suggestedOwnerTeam: "platform-sre",
      recommendedRunbook: "elevated_error_rate",
      autoEscalate: true,
    },
    incident: {
      id: "inc_1",
      title: "Checkout 5xx spike",
      summary: "p99 5xx jumped from 0.1% to 4.2%",
      severity: "high",
      reportedAtIso: NOW.toISOString(),
    },
    release: {
      id: "rel_1",
      status: "deployed",
      releaseTag: "v3.4.1",
      previousSuccessfulTag: "v3.4.0",
      minutesSinceDeploy: 25,
      isProduction: true,
    },
    releaseFeatureFlags: [],
    isCapacitySaturated: false,
    thirdPartyDependencyHint: false,
    highErrorRate: true,
    availableRunbookKeys: ["elevated_error_rate"],
    now: NOW,
    ...overrides,
  };
}

describe("buildRemediationRationalePrompt", () => {
  it("includes proposal kind, title, prerequisites, and release context", () => {
    const p = buildRemediationRationalePrompt(proposal(), inputs());
    expect(p).toContain("Proposal kind: rollback_release");
    expect(p).toContain("Proposal title: Roll back to v3.4.0");
    expect(p).toContain("Reversible: true");
    expect(p).toContain("Prerequisites: Confirm v3.4.0");
    expect(p).toContain("previousSuccessfulTag: v3.4.0");
    expect(p).toContain("Respond with ONLY the JSON object");
  });

  it("handles empty prerequisites + feature flags + runbooks", () => {
    const p = buildRemediationRationalePrompt(
      proposal({ prerequisites: [] }),
      inputs({ releaseFeatureFlags: [], availableRunbookKeys: [] }),
    );
    expect(p).toContain("Prerequisites: (none)");
    expect(p).toContain("featureFlags: (none)");
    expect(p).toContain("available runbooks: (none)");
  });

  it("truncates long description + rationale", () => {
    const big = "x".repeat(500);
    const p = buildRemediationRationalePrompt(
      proposal({ description: big, rationale: big }),
      inputs(),
    );
    expect(p).not.toContain(big);
  });
});

describe("buildRemediationFallbackRationale", () => {
  it("narrates kind + confidence + reversibility + estimate", () => {
    const out = buildRemediationFallbackRationale(proposal(), inputs(), "x");
    expect(out.narrative).toContain("Roll back to v3.4.0");
    expect(out.narrative).toContain("80%");
    expect(out.narrative).toContain("reversible");
    expect(out.narrative).toContain("15 minute");
    expect(out.engineVersion).toBe(REMEDIATION_RATIONALE_ENGINE_VERSION);
  });

  it("flags non-reversible actions", () => {
    const out = buildRemediationFallbackRationale(
      proposal({ reversible: false, kind: "redirect_traffic" }),
      inputs(),
      "x",
    );
    expect(out.narrative).toContain("NOT reversible");
    expect(out.riskFactors.some((r) => r.includes("NOT reversible"))).toBe(true);
  });

  it("flags missing rollback target for rollback_release", () => {
    const out = buildRemediationFallbackRationale(
      proposal({ kind: "rollback_release" }),
      inputs({ release: { ...inputs().release, previousSuccessfulTag: null } }),
      "x",
    );
    expect(out.riskFactors.some((r) => r.includes("No previous successful release tag"))).toBe(true);
  });

  it("flags long minutes-since-deploy for rollback_release", () => {
    const out = buildRemediationFallbackRationale(
      proposal({ kind: "rollback_release" }),
      inputs({ release: { ...inputs().release, minutesSinceDeploy: 240 } }),
      "x",
    );
    expect(out.riskFactors.some((r) => r.includes("240m ago"))).toBe(true);
  });

  it("warns on adjacent capacity / 3p hints", () => {
    const out = buildRemediationFallbackRationale(
      proposal({ kind: "restart_service" }),
      inputs({ isCapacitySaturated: true, thirdPartyDependencyHint: true }),
      "x",
    );
    expect(out.riskFactors.some((r) => r.includes("Capacity already saturated"))).toBe(true);
    expect(out.riskFactors.some((r) => r.includes("third-party fault"))).toBe(true);
  });

  it("emits kind-specific next actions for rollback_release", () => {
    const out = buildRemediationFallbackRationale(proposal({ kind: "rollback_release" }), inputs(), "x");
    expect(out.nextActions.some((a) => a.includes("rollback automation"))).toBe(true);
  });

  it("emits kind-specific next actions for disable_feature_flag", () => {
    const out = buildRemediationFallbackRationale(proposal({ kind: "disable_feature_flag" }), inputs(), "x");
    expect(out.nextActions.some((a) => a.includes("flag system"))).toBe(true);
  });

  it("emits kind-specific next actions for restart_service", () => {
    const out = buildRemediationFallbackRationale(proposal({ kind: "restart_service" }), inputs(), "x");
    expect(out.nextActions.some((a) => a.includes("rolling fashion"))).toBe(true);
  });

  it("emits kind-specific next actions for escalate_to_vendor", () => {
    const out = buildRemediationFallbackRationale(proposal({ kind: "escalate_to_vendor" }), inputs(), "x");
    expect(out.nextActions.some((a) => a.includes("vendor support ticket"))).toBe(true);
  });

  it("always notifies the owner team in the last action", () => {
    const out = buildRemediationFallbackRationale(
      proposal({ kind: "no_action_recommended" }),
      inputs({ triage: { ...inputs().triage, suggestedOwnerTeam: "payments-team" } }),
      "x",
    );
    expect(out.nextActions.some((a) => a.includes("payments-team"))).toBe(true);
  });

  it("caps lists at 5 items", () => {
    const out = buildRemediationFallbackRationale(
      proposal({
        kind: "redirect_traffic",
        reversible: false,
        prerequisites: ["a", "b", "c"],
        severity: "critical",
      }),
      inputs({
        isCapacitySaturated: true,
        thirdPartyDependencyHint: true,
        release: { ...inputs().release, isProduction: true },
      }),
      "x",
    );
    expect(out.riskFactors.length).toBeLessThanOrEqual(5);
    expect(out.nextActions.length).toBeLessThanOrEqual(5);
  });
});

describe("enrichRemediationRationale", () => {
  const validJson = JSON.stringify({
    narrative: "Recent prod release with 5xx spike — rollback is the safest reversible action.",
    riskFactors: ["State drift risk", "Vendor not yet ruled out"],
    nextActions: ["Confirm v3.4.0 artifacts", "Run rollback automation", "Notify platform-sre"],
  });

  it("returns fallback when fetcher is null", async () => {
    const out = await enrichRemediationRationale(proposal(), inputs(), null);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("no_ai_fetcher_configured");
  });

  it("returns ai_generated on valid response", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: validJson, modelHint: "claude-opus-4-7" });
    const out = await enrichRemediationRationale(proposal(), inputs(), fetcher);
    expect(out.outcome).toBe("ai_generated");
    expect(out.narrative).toContain("rollback");
    expect(out.modelHint).toBe("claude-opus-4-7");
  });

  it("returns error outcome when fetcher throws", async () => {
    const fetcher: RationaleAiFetcher = async () => { throw new Error("provider down"); };
    const out = await enrichRemediationRationale(proposal(), inputs(), fetcher);
    expect(out.outcome).toBe("error");
    expect(out.errorMessage).toContain("provider down");
    expect(out.narrative.length).toBeGreaterThan(0);
  });

  it("pins remediation engine version", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: validJson, modelHint: null });
    const out = await enrichRemediationRationale(proposal(), inputs(), fetcher);
    expect(out.engineVersion).toBe(REMEDIATION_RATIONALE_ENGINE_VERSION);
  });
});
