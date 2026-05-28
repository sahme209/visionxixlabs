import { describe, expect, it } from "vitest";
import {
  triageDeploymentIncident,
  INCIDENT_TRIAGE_ENGINE_VERSION,
  type IncidentTriageInputs,
} from "../incidentTriageEngine";

const NOW = new Date("2026-05-26T12:00:00Z");

function baseInput(overrides: Partial<IncidentTriageInputs> = {}): IncidentTriageInputs {
  return {
    incident: {
      id: "inc_1",
      severity: "medium",
      title: "Latency spike on /pay",
      summary: null,
      reportedAtIso: NOW.toISOString(),
    },
    release: {
      id: "rel_1",
      status: "deployed",
      releaseTag: "v1.2.3",
      isProduction: true,
      deployedAtIso: NOW.toISOString(),
    },
    openCriticalIncidentsOnThisRelease: 0,
    pendingAdvisorBlockKinds: [],
    similarHistoricalIncidents: 0,
    medianHistoricalMitigationMinutes: 0,
    businessImpactHint: null,
    isInPlannedFreeze: false,
    now: NOW,
    ...overrides,
  };
}

describe("triageDeploymentIncident — priority from severity", () => {
  it("critical → P0", () => {
    const out = triageDeploymentIncident(baseInput({ incident: { ...baseInput().incident, severity: "critical" } }));
    expect(out.priority).toBe("P0");
  });
  it("high → P1", () => {
    const out = triageDeploymentIncident(baseInput({ incident: { ...baseInput().incident, severity: "high" } }));
    expect(out.priority).toBe("P1");
  });
  it("medium → P2", () => {
    const out = triageDeploymentIncident(baseInput());
    expect(out.priority).toBe("P2");
  });
  it("low → P3 (non-prod)", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, severity: "low" },
      release: { ...baseInput().release, isProduction: false },
    }));
    expect(out.priority).toBe("P3");
  });
});

describe("priority upgrades", () => {
  it("multiple critical incidents on same release upgrades by one tier", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, severity: "medium" },
      openCriticalIncidentsOnThisRelease: 3,
    }));
    expect(out.priority).toBe("P1");
    expect(out.rationale).toContain("Upgraded to P1");
  });

  it("advisor block_deploy upgrades to at least P1", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, severity: "low" },
      release: { ...baseInput().release, isProduction: false },
      pendingAdvisorBlockKinds: ["block_deploy"],
    }));
    expect(out.priority).toBe("P1");
  });

  it("business-impact hint with 'revenue' word upgrades to P0", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, severity: "medium" },
      businessImpactHint: "Paying customers cannot checkout — revenue impact.",
    }));
    expect(out.priority).toBe("P0");
  });

  it("incident during planned freeze upgrades one tier", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, severity: "medium" },
      isInPlannedFreeze: true,
    }));
    expect(out.priority).toBe("P1");
    expect(out.rationale).toContain("planned freeze");
  });

  it("does not upgrade above P0", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, severity: "critical" },
      openCriticalIncidentsOnThisRelease: 5,
      pendingAdvisorBlockKinds: ["block_deploy", "rollback"],
      isInPlannedFreeze: true,
    }));
    expect(out.priority).toBe("P0");
  });
});

describe("owner team routing", () => {
  it("checkout/payment keywords route to payments", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, title: "Checkout 500 errors" },
    }));
    expect(out.suggestedOwnerTeam).toBe("payments");
  });
  it("auth keywords route to identity", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, title: "Sign-in loop on Safari" },
    }));
    expect(out.suggestedOwnerTeam).toBe("identity");
  });
  it("kubernetes keywords route to platform-sre", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, title: "k8s pod crash loop" },
    }));
    expect(out.suggestedOwnerTeam).toBe("platform-sre");
  });
  it("database keywords route to data-platform", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, title: "Postgres migration failed" },
    }));
    expect(out.suggestedOwnerTeam).toBe("data-platform");
  });
  it("fallback to platform-sre for prod when no keyword matches", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, title: "Generic problem" },
    }));
    expect(out.suggestedOwnerTeam).toBe("platform-sre");
  });
  it("fallback to release-captain for non-prod when no keyword matches", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, title: "Generic problem" },
      release: { ...baseInput().release, isProduction: false },
    }));
    expect(out.suggestedOwnerTeam).toBe("release-captain");
  });
});

describe("runbook recommendation", () => {
  it("checkout → checkout_outage", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, title: "Checkout 500 spike" },
    }));
    expect(out.recommendedRunbook).toBe("checkout_outage");
  });
  it("latency keyword → perf_regression", () => {
    // Note: a path like "/pay" would also match the payments regex first.
    // Use a non-conflicting title so the latency rule wins.
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, title: "Search API p99 latency regression" },
    }));
    expect(out.recommendedRunbook).toBe("perf_regression");
  });
  it("'500 / error rate' → elevated_error_rate", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, title: "500 errors spike on edge" },
    }));
    expect(out.recommendedRunbook).toBe("elevated_error_rate");
  });
  it("generic title → null runbook", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, title: "Generic problem" },
    }));
    expect(out.recommendedRunbook).toBeNull();
  });
});

describe("estimated mitigation minutes", () => {
  it("uses default when no historical data", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, severity: "critical" },
    }));
    expect(out.estimatedTimeToMitigateMinutes).toBe(30); // P0 default
  });
  it("respects historical median when available", () => {
    const out = triageDeploymentIncident(baseInput({
      similarHistoricalIncidents: 5,
      medianHistoricalMitigationMinutes: 180,
    }));
    expect(out.estimatedTimeToMitigateMinutes).toBe(180);
  });
  it("enforces priority floor", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, severity: "critical" },
      similarHistoricalIncidents: 4,
      medianHistoricalMitigationMinutes: 5, // unrealistically low
    }));
    expect(out.estimatedTimeToMitigateMinutes).toBeGreaterThanOrEqual(15); // P0 floor
  });
});

describe("autoEscalate", () => {
  it("P0 always auto-escalates", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, severity: "critical" },
    }));
    expect(out.autoEscalate).toBe(true);
  });
  it("P1 + production → auto-escalate", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, severity: "high" },
    }));
    expect(out.autoEscalate).toBe(true);
  });
  it("P1 + non-prod → no auto-escalate", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, severity: "high" },
      release: { ...baseInput().release, isProduction: false },
    }));
    expect(out.autoEscalate).toBe(false);
  });
  it("P2 → no auto-escalate even on prod", () => {
    const out = triageDeploymentIncident(baseInput());
    expect(out.autoEscalate).toBe(false);
  });
});

describe("confidence + deadline", () => {
  it("higher confidence when history + runbook + advisor signals are present", () => {
    const baseline = triageDeploymentIncident(baseInput());
    const enriched = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, title: "Checkout 500 errors" },
      similarHistoricalIncidents: 5,
      pendingAdvisorBlockKinds: ["block_deploy"],
      businessImpactHint: "user impact",
    }));
    expect(enriched.confidence).toBeGreaterThan(baseline.confidence);
    expect(enriched.confidence).toBeLessThanOrEqual(95);
  });
  it("response deadline tight for P0 (15 min)", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, severity: "critical" },
    }));
    const delta = new Date(out.responseDeadlineIso).getTime() - NOW.getTime();
    expect(delta).toBe(15 * 60_000);
  });
  it("response deadline relaxed for P3 (1 day)", () => {
    const out = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, severity: "low" },
      release: { ...baseInput().release, isProduction: false },
    }));
    const delta = new Date(out.responseDeadlineIso).getTime() - NOW.getTime();
    expect(delta).toBe(1440 * 60_000);
  });
});

describe("engine version + determinism", () => {
  it("output carries pinned engine version", () => {
    const out = triageDeploymentIncident(baseInput());
    expect(out.engineVersion).toBe(INCIDENT_TRIAGE_ENGINE_VERSION);
  });
  it("same input → same output (determinism)", () => {
    const out1 = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, title: "Checkout outage" },
      similarHistoricalIncidents: 3,
      medianHistoricalMitigationMinutes: 60,
    }));
    const out2 = triageDeploymentIncident(baseInput({
      incident: { ...baseInput().incident, title: "Checkout outage" },
      similarHistoricalIncidents: 3,
      medianHistoricalMitigationMinutes: 60,
    }));
    expect(out1).toEqual(out2);
  });
});
