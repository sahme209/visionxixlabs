import { describe, expect, it } from "vitest";
import {
  buildTriageFallbackRationale,
  buildTriageRationalePrompt,
  enrichTriageRationale,
  TRIAGE_RATIONALE_ENGINE_VERSION,
} from "../aiTriageRationaleEngine";
import type { RationaleAiFetcher } from "../aiRationaleEnricherEngine";
import type { IncidentTriageInputs, IncidentTriageOutput } from "../incidentTriageEngine";

const NOW = new Date("2026-05-28T12:00:00Z");

function output(overrides: Partial<IncidentTriageOutput> = {}): IncidentTriageOutput {
  return {
    engineVersion: "incident-triage-v1.0.0",
    generatedAtIso: NOW.toISOString(),
    priority: "P1",
    suggestedOwnerTeam: "platform-sre",
    estimatedTimeToMitigateMinutes: 45,
    recommendedRunbook: "elevated_error_rate",
    autoEscalate: true,
    confidence: 80,
    rationale: "Elevated 5xx after a recent release. Routing to platform-sre.",
    responseDeadlineIso: new Date(NOW.getTime() + 30 * 60_000).toISOString(),
    ...overrides,
  };
}

function inputs(overrides: Partial<IncidentTriageInputs> = {}): IncidentTriageInputs {
  return {
    incident: {
      id: "inc_1",
      severity: "high",
      title: "Checkout 5xx spike",
      summary: "p99 5xx jumped from 0.1% to 4.2% in the last 10 minutes",
      reportedAtIso: NOW.toISOString(),
    },
    release: {
      id: "rel_1",
      status: "deployed",
      releaseTag: "v3.4.1",
      isProduction: true,
      deployedAtIso: new Date(NOW.getTime() - 30 * 60_000).toISOString(),
    },
    openCriticalIncidentsOnThisRelease: 0,
    pendingAdvisorBlockKinds: [],
    similarHistoricalIncidents: 1,
    medianHistoricalMitigationMinutes: 30,
    businessImpactHint: null,
    isInPlannedFreeze: false,
    now: NOW,
    ...overrides,
  };
}

describe("buildTriageRationalePrompt", () => {
  it("includes priority, owner, runbook, and incident state", () => {
    const p = buildTriageRationalePrompt(output(), inputs());
    expect(p).toContain("Triage priority: P1");
    expect(p).toContain("Suggested owner team: platform-sre");
    expect(p).toContain("Recommended runbook: elevated_error_rate");
    expect(p).toContain("title: Checkout 5xx spike");
    expect(p).toContain("Respond with ONLY the JSON object");
  });

  it("handles null runbook + null summary defensively", () => {
    const p = buildTriageRationalePrompt(output({ recommendedRunbook: null }), inputs({
      incident: { ...inputs().incident, summary: null },
    }));
    expect(p).toContain("Recommended runbook: (none)");
    expect(p).toContain("summary: (no summary)");
  });

  it("truncates long engine rationale", () => {
    const big = "x".repeat(500);
    const p = buildTriageRationalePrompt(output({ rationale: big }), inputs());
    expect(p).not.toContain(big);
  });
});

describe("buildTriageFallbackRationale", () => {
  it("narrates priority + confidence + owner", () => {
    const out = buildTriageFallbackRationale(output(), inputs(), "no_ai");
    expect(out.narrative).toContain("P1");
    expect(out.narrative).toContain("80%");
    expect(out.narrative).toContain("platform-sre");
    expect(out.engineVersion).toBe(TRIAGE_RATIONALE_ENGINE_VERSION);
  });

  it("notes auto-escalate state", () => {
    expect(buildTriageFallbackRationale(output({ autoEscalate: true }), inputs(), "x").narrative).toContain("Auto-escalate is on");
    expect(buildTriageFallbackRationale(output({ autoEscalate: false }), inputs(), "x").narrative).toContain("Auto-escalate is off");
  });

  it("surfaces co-incidents + advisor signals + history in risk factors", () => {
    const out = buildTriageFallbackRationale(output(), inputs({
      openCriticalIncidentsOnThisRelease: 3,
      pendingAdvisorBlockKinds: ["rollback", "block_deploy"],
      similarHistoricalIncidents: 5,
      businessImpactHint: "Checkout broken for EU users",
    }), "x");
    expect(out.riskFactors.some((r) => r.includes("3 other open critical incident"))).toBe(true);
    expect(out.riskFactors.some((r) => r.includes("rollback + block_deploy"))).toBe(true);
    expect(out.riskFactors.some((r) => r.includes("5 similar"))).toBe(true);
    expect(out.riskFactors.some((r) => r.includes("Checkout broken"))).toBe(true);
  });

  it("emits page-oncall action when autoEscalate", () => {
    const out = buildTriageFallbackRationale(output({ autoEscalate: true, suggestedOwnerTeam: "payments-team" }), inputs(), "x");
    expect(out.nextActions.some((a) => a.includes("Page on-call for payments-team"))).toBe(true);
  });

  it("emits notify-only action when autoEscalate=false", () => {
    const out = buildTriageFallbackRationale(output({ autoEscalate: false, suggestedOwnerTeam: "platform-sre" }), inputs(), "x");
    expect(out.nextActions.some((a) => a.startsWith("Notify platform-sre"))).toBe(true);
  });

  it("suggests rollback coordination when advisor signals overlap", () => {
    const out = buildTriageFallbackRationale(output(), inputs({ pendingAdvisorBlockKinds: ["rollback"] }), "x");
    expect(out.nextActions.some((a) => a.includes("release advisor"))).toBe(true);
  });

  it("caps lists at 5 items", () => {
    const out = buildTriageFallbackRationale(output(), inputs({
      openCriticalIncidentsOnThisRelease: 5,
      pendingAdvisorBlockKinds: ["rollback", "block_deploy"],
      similarHistoricalIncidents: 5,
      businessImpactHint: "broken",
      isInPlannedFreeze: true,
    }), "x");
    expect(out.riskFactors.length).toBeLessThanOrEqual(5);
    expect(out.nextActions.length).toBeLessThanOrEqual(5);
  });
});

describe("enrichTriageRationale", () => {
  const validJson = JSON.stringify({
    narrative: "5xx spike on a fresh prod release — P1 + page payments oncall.",
    riskFactors: ["Fresh prod release", "EU customers seeing 502s"],
    nextActions: ["Page payments oncall", "Pull recent deploy diff"],
  });

  it("returns fallback when fetcher is null", async () => {
    const out = await enrichTriageRationale(output(), inputs(), null);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("no_ai_fetcher_configured");
  });

  it("returns ai_generated on valid response", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: validJson, modelHint: "claude-opus-4-7" });
    const out = await enrichTriageRationale(output(), inputs(), fetcher);
    expect(out.outcome).toBe("ai_generated");
    expect(out.narrative).toContain("P1");
    expect(out.modelHint).toBe("claude-opus-4-7");
  });

  it("returns error outcome when fetcher throws", async () => {
    const fetcher: RationaleAiFetcher = async () => { throw new Error("provider down"); };
    const out = await enrichTriageRationale(output(), inputs(), fetcher);
    expect(out.outcome).toBe("error");
    expect(out.errorMessage).toContain("provider down");
    // still emits usable fallback content
    expect(out.narrative.length).toBeGreaterThan(0);
  });

  it("falls back on empty response", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: "   ", modelHint: null });
    const out = await enrichTriageRationale(output(), inputs(), fetcher);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("empty_ai_response");
  });

  it("falls back on unparseable response", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: "i forgot the json", modelHint: null });
    const out = await enrichTriageRationale(output(), inputs(), fetcher);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("unparseable_ai_response");
  });

  it("pins triage engine version on every enrichment", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: validJson, modelHint: null });
    const out = await enrichTriageRationale(output(), inputs(), fetcher);
    expect(out.engineVersion).toBe(TRIAGE_RATIONALE_ENGINE_VERSION);
  });
});
