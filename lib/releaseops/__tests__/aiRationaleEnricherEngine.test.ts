import { describe, expect, it } from "vitest";
import {
  buildFallbackRationale,
  buildRationalePrompt,
  enrichDecisionRationale,
  isEnrichmentOutcome,
  parseRationaleResponse,
  RATIONALE_ENRICHER_ENGINE_VERSION,
  type RationaleAiFetcher,
} from "../aiRationaleEnricherEngine";
import type { CouncilDecision, CouncilVote } from "../advisorCouncilEngine";
import type { AdvisorInputs } from "../releaseAdvisorEngine";

const NOW = new Date("2026-05-28T12:00:00Z");

function votes(...kinds: Array<CouncilVote["kind"]>): CouncilVote[] {
  return kinds.map((k, i) => ({
    voterId: ["rule_based", "conservative", "pragmatic", "ai_native"][i] ?? `v${i}`,
    kind: k,
    confidence: 80,
    rationale: `voter ${i} says ${k}`,
  }));
}

function decision(overrides: Partial<CouncilDecision> = {}): CouncilDecision {
  return {
    engineVersion: "advisor-council-v1.0.0",
    generatedAtIso: NOW.toISOString(),
    consensusKind: "block_deploy",
    agreementScore: 75,
    title: "Council: Block deploy",
    rationale: "2/3 voters agreed on block_deploy. Dissent: pragmatic voted proceed.",
    votes: votes("block_deploy", "block_deploy", "proceed"),
    voterCount: 3,
    ...overrides,
  };
}

function inputs(overrides: Partial<AdvisorInputs> = {}): AdvisorInputs {
  return {
    release: { id: "rel_1", status: "ready", releaseTag: "v1", commitSha: "abc", plannedWindowStart: null, plannedWindowEnd: null },
    readiness: { overallScore: 60, riskLevel: "high", blockerCount: 2, branchGovernance: 50, changeCompliance: 60, secretTraceability: 70, rollbackReadiness: 50, manualReconciliation: 60 },
    policyViolations: { blocking: 2, warning: 1, advisory: 0 },
    pendingManualFixes: { total: 3, inProd: 1 },
    recentIncidents: { open: 1, openCritical: 0, mitigated: 0 },
    branchProtection: { snapshotsTotal: 1, weakOrNone: 0, forcePushAllowedOnMain: false },
    previousReleaseStatus: null,
    hasEvidencePack: false,
    isInPlannedFreeze: false,
    now: NOW,
    ...overrides,
  };
}

describe("isEnrichmentOutcome", () => {
  it("accepts every closed-union value", () => {
    expect(isEnrichmentOutcome("ai_generated")).toBe(true);
    expect(isEnrichmentOutcome("fallback_rules")).toBe(true);
    expect(isEnrichmentOutcome("error")).toBe(true);
  });
  it("rejects unknown", () => {
    expect(isEnrichmentOutcome("ok")).toBe(false);
    expect(isEnrichmentOutcome("")).toBe(false);
  });
});

describe("buildRationalePrompt", () => {
  it("includes consensus, agreement, voter breakdown, and release state", () => {
    const p = buildRationalePrompt(decision(), inputs());
    expect(p).toContain("Council consensus: block_deploy");
    expect(p).toContain("Agreement: 75%");
    expect(p).toContain("rule_based: block_deploy @ 80%");
    expect(p).toContain("policy violations — blocking: 2");
    expect(p).toContain("Respond with ONLY the JSON object");
  });

  it("handles a no-readiness snapshot defensively", () => {
    const p = buildRationalePrompt(decision(), inputs({ readiness: null }));
    expect(p).toContain("(no readiness snapshot)");
  });

  it("truncates very long voter rationales in the prompt", () => {
    const longRat = "x".repeat(500);
    const p = buildRationalePrompt(
      decision({ votes: [{ voterId: "v", kind: "block_deploy", confidence: 80, rationale: longRat }] }),
      inputs(),
    );
    expect(p).not.toContain(longRat);
  });
});

describe("parseRationaleResponse", () => {
  const valid = JSON.stringify({
    narrative: "The council blocked because two blocking policy violations are present and prior release rolled back.",
    riskFactors: ["2 blocking violations", "Prior rollback risk", "Readiness 60/100"],
    nextActions: ["Resolve policy violations", "Confirm rollback evidence", "Re-run council"],
  });

  it("parses valid JSON", () => {
    const out = parseRationaleResponse(valid);
    expect(out).not.toBeNull();
    expect(out!.narrative).toContain("blocked");
    expect(out!.riskFactors).toHaveLength(3);
    expect(out!.nextActions).toHaveLength(3);
  });

  it("extracts JSON wrapped in prose", () => {
    const wrapped = `Sure — here you go:\n\n${valid}\n\nLet me know if you want more detail.`;
    expect(parseRationaleResponse(wrapped)).not.toBeNull();
  });

  it("returns null for empty / non-JSON input", () => {
    expect(parseRationaleResponse("")).toBeNull();
    expect(parseRationaleResponse("no json here")).toBeNull();
    expect(parseRationaleResponse("{ not parseable")).toBeNull();
  });

  it("requires narrative + non-empty risk + next arrays", () => {
    expect(parseRationaleResponse(JSON.stringify({ narrative: "", riskFactors: ["a"], nextActions: ["b"] }))).toBeNull();
    expect(parseRationaleResponse(JSON.stringify({ narrative: "x", riskFactors: [], nextActions: ["b"] }))).toBeNull();
    expect(parseRationaleResponse(JSON.stringify({ narrative: "x", riskFactors: ["a"], nextActions: [] }))).toBeNull();
  });

  it("truncates list items longer than 140 chars + caps list at 5", () => {
    const longItem = "x".repeat(200);
    const seven = [longItem, "a", "b", "c", "d", "e", "f"];
    const out = parseRationaleResponse(JSON.stringify({
      narrative: "x",
      riskFactors: seven,
      nextActions: seven,
    }));
    expect(out).not.toBeNull();
    expect(out!.riskFactors).toHaveLength(5);
    expect(out!.riskFactors[0].length).toBeLessThanOrEqual(140);
  });

  it("skips non-string array entries", () => {
    const out = parseRationaleResponse(JSON.stringify({
      narrative: "x",
      riskFactors: ["risk1", 123, null, "risk2"],
      nextActions: ["a"],
    }));
    expect(out!.riskFactors).toEqual(["risk1", "risk2"]);
  });
});

describe("buildFallbackRationale", () => {
  it("narrates a strict-majority consensus", () => {
    const out = buildFallbackRationale(decision({ consensusKind: "block_deploy", agreementScore: 75 }), inputs(), "no_ai_fetcher_configured");
    expect(out.outcome).toBe("fallback_rules");
    expect(out.narrative).toContain("75% weighted agreement");
    expect(out.narrative).toContain("block_deploy");
    expect(out.errorMessage).toBe("no_ai_fetcher_configured");
    expect(out.engineVersion).toBe(RATIONALE_ENRICHER_ENGINE_VERSION);
  });

  it("narrates no_consensus", () => {
    const out = buildFallbackRationale(decision({ consensusKind: "no_consensus", agreementScore: 33 }), inputs(), "no_ai");
    expect(out.narrative).toContain("failed to reach a strict majority");
  });

  it("surfaces dissent in the narrative", () => {
    const out = buildFallbackRationale(
      decision({ consensusKind: "block_deploy", votes: votes("block_deploy", "block_deploy", "proceed") }),
      inputs(),
      "no_ai",
    );
    expect(out.narrative).toContain("Dissent:");
    expect(out.narrative).toContain("pragmatic");
  });

  it("derives risk factors from the inputs", () => {
    const out = buildFallbackRationale(decision(), inputs({
      policyViolations: { blocking: 3, warning: 0, advisory: 0 },
      pendingManualFixes: { total: 0, inProd: 2 },
      branchProtection: { snapshotsTotal: 1, weakOrNone: 1, forcePushAllowedOnMain: true },
    }), "test_fixture");
    expect(out.riskFactors.some((r) => r.includes("3 blocking policy violation"))).toBe(true);
    expect(out.riskFactors.some((r) => r.includes("2 unreconciled manual fix"))).toBe(true);
    expect(out.riskFactors.some((r) => r.includes("Force-push is allowed"))).toBe(true);
  });

  it("provides a non-empty default risk factor when nothing alarming", () => {
    const out = buildFallbackRationale(decision({ consensusKind: "proceed" }), inputs({
      policyViolations: { blocking: 0, warning: 0, advisory: 0 },
      pendingManualFixes: { total: 0, inProd: 0 },
      recentIncidents: { open: 0, openCritical: 0, mitigated: 0 },
      branchProtection: { snapshotsTotal: 1, weakOrNone: 0, forcePushAllowedOnMain: false },
      readiness: { overallScore: 95, riskLevel: "low", blockerCount: 0, branchGovernance: 95, changeCompliance: 95, secretTraceability: 95, rollbackReadiness: 95, manualReconciliation: 95 },
      previousReleaseStatus: null,
    }), "test_fixture");
    expect(out.riskFactors.length).toBeGreaterThan(0);
  });

  it("caps risk factors at 5 even with many signals", () => {
    const out = buildFallbackRationale(decision(), inputs({
      policyViolations: { blocking: 3, warning: 0, advisory: 0 },
      pendingManualFixes: { total: 5, inProd: 5 },
      recentIncidents: { open: 5, openCritical: 5, mitigated: 0 },
      branchProtection: { snapshotsTotal: 1, weakOrNone: 1, forcePushAllowedOnMain: true },
      readiness: { overallScore: 30, riskLevel: "critical", blockerCount: 5, branchGovernance: 30, changeCompliance: 30, secretTraceability: 30, rollbackReadiness: 30, manualReconciliation: 30 },
      previousReleaseStatus: "rolled_back",
    }), "test_fixture");
    expect(out.riskFactors.length).toBeLessThanOrEqual(5);
  });

  it("emits next actions tailored to consensus kind", () => {
    expect(buildFallbackRationale(decision({ consensusKind: "block_deploy" }), inputs(), "x").nextActions.join(" ")).toContain("blocking signals");
    expect(buildFallbackRationale(decision({ consensusKind: "rollback" }), inputs(), "x").nextActions.join(" ")).toContain("rollback");
    expect(buildFallbackRationale(decision({ consensusKind: "needs_evidence" }), inputs(), "x").nextActions.join(" ")).toContain("manual fix");
    expect(buildFallbackRationale(decision({ consensusKind: "propose_freeze" }), inputs(), "x").nextActions.join(" ")).toContain("freeze");
    expect(buildFallbackRationale(decision({ consensusKind: "proceed_with_caution" }), inputs(), "x").nextActions.join(" ")).toContain("canary");
    expect(buildFallbackRationale(decision({ consensusKind: "proceed" }), inputs(), "x").nextActions.join(" ")).toContain("deploy");
    expect(buildFallbackRationale(decision({ consensusKind: "no_consensus" }), inputs(), "x").nextActions.join(" ")).toContain("Operator must decide");
  });
});

describe("enrichDecisionRationale", () => {
  const okJson = JSON.stringify({
    narrative: "Critical violations and a high-risk readiness profile led the council to block.",
    riskFactors: ["Blocking violations", "Readiness 60/100"],
    nextActions: ["Resolve violations", "Re-run readiness"],
  });

  it("returns fallback when fetcher is null", async () => {
    const out = await enrichDecisionRationale(decision(), inputs(), null);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("no_ai_fetcher_configured");
  });

  it("returns ai_generated on valid response", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: okJson, modelHint: "claude-opus-4-7" });
    const out = await enrichDecisionRationale(decision(), inputs(), fetcher);
    expect(out.outcome).toBe("ai_generated");
    expect(out.narrative).toContain("block");
    expect(out.modelHint).toBe("claude-opus-4-7");
    expect(out.errorMessage).toBeNull();
  });

  it("falls back when fetcher throws", async () => {
    const fetcher: RationaleAiFetcher = async () => { throw new Error("provider down"); };
    const out = await enrichDecisionRationale(decision(), inputs(), fetcher);
    expect(out.outcome).toBe("error");
    expect(out.errorMessage).toContain("provider down");
    // still emits a usable fallback narrative
    expect(out.narrative.length).toBeGreaterThan(0);
    expect(out.riskFactors.length).toBeGreaterThan(0);
    expect(out.nextActions.length).toBeGreaterThan(0);
  });

  it("falls back when response is empty", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: "   ", modelHint: null });
    const out = await enrichDecisionRationale(decision(), inputs(), fetcher);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("empty_ai_response");
  });

  it("falls back when response is unparseable", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: "i forgot the json sorry", modelHint: null });
    const out = await enrichDecisionRationale(decision(), inputs(), fetcher);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("unparseable_ai_response");
  });

  it("pins the engine version on every enrichment", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: okJson, modelHint: null });
    const out = await enrichDecisionRationale(decision(), inputs(), fetcher);
    expect(out.engineVersion).toBe(RATIONALE_ENRICHER_ENGINE_VERSION);
  });
});
