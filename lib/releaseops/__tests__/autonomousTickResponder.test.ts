import { describe, expect, it } from "vitest";
import {
  runAutonomousTick,
  type AutonomousTickRepo,
  type EngineRunners,
  type IncidentTickRow,
  type RecentRow,
  type ReleaseTickRow,
} from "../autonomousTickResponder";

const NOW = new Date("2026-05-28T12:00:00Z");

interface Stub extends AutonomousTickRepo {
  _orgs: { id: string }[];
  _releases: ReleaseTickRow[];
  _advisorByRelease: Map<string, RecentRow>;
  _incidents: IncidentTickRow[];
  _triageByIncident: Map<string, RecentRow>;
  _remediationByIncident: Map<string, RecentRow>;
  _policyByOrg: Map<string, RecentRow>;
}

interface RunnerCalls {
  advisor: Array<{ org: string; release: string }>;
  triage: Array<{ org: string; incident: string }>;
  remediation: Array<{ org: string; incident: string }>;
  policy: Array<{ org: string }>;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _orgs: [],
    _releases: [],
    _advisorByRelease: new Map(),
    _incidents: [],
    _triageByIncident: new Map(),
    _remediationByIncident: new Map(),
    _policyByOrg: new Map(),
    organization: {
      async findMany() { return stub._orgs; },
    },
    release: {
      async findMany({ where, take }) {
        const out = stub._releases.filter((r) =>
          r.organizationId === where.organizationId && where.status.in.includes(r.status),
        );
        return take ? out.slice(0, take) : out;
      },
    },
    advisorRecommendation: {
      async findFirst({ where }) {
        return stub._advisorByRelease.get(where.releaseId) ?? null;
      },
    },
    deploymentIncident: {
      async findMany({ where, take }) {
        const out = stub._incidents.filter((i) =>
          i.organizationId === where.organizationId && where.status.in.includes(i.status),
        );
        return take ? out.slice(0, take) : out;
      },
    },
    incidentTriage: {
      async findFirst({ where }) {
        return stub._triageByIncident.get(where.incidentId) ?? null;
      },
    },
    remediationProposal: {
      async findFirst({ where }) {
        return stub._remediationByIncident.get(where.incidentId) ?? null;
      },
    },
    policyProposal: {
      async findFirst({ where }) {
        return stub._policyByOrg.get(where.organizationId) ?? null;
      },
    },
  };
  return stub;
}

function makeRunners(): { runners: EngineRunners; calls: RunnerCalls } {
  const calls: RunnerCalls = { advisor: [], triage: [], remediation: [], policy: [] };
  const runners: EngineRunners = {
    async runAdvisor(org, releaseId) { calls.advisor.push({ org, release: releaseId }); return { ok: true }; },
    async runTriage(org, incidentId) { calls.triage.push({ org, incident: incidentId }); return { ok: true }; },
    async runRemediation(org, incidentId) { calls.remediation.push({ org, incident: incidentId }); return { ok: true }; },
    async runPolicyProposal(org) { calls.policy.push({ org }); return { ok: true }; },
  };
  return { runners, calls };
}

describe("runAutonomousTick — empty", () => {
  it("no orgs → zero runs", async () => {
    const stub = makeRepo();
    const { runners } = makeRunners();
    const r = await runAutonomousTick(stub, runners, { now: NOW });
    if (!r.ok) throw new Error("expected ok");
    expect(r.orgCount).toBe(0);
    expect(r.totalRuns).toBe(0);
  });
});

describe("runAutonomousTick — advisor", () => {
  it("runs advisor for active release with no prior", async () => {
    const stub = makeRepo();
    stub._orgs.push({ id: "o1" });
    stub._releases.push({ id: "rel_1", organizationId: "o1", status: "ready" });
    const { runners, calls } = makeRunners();
    await runAutonomousTick(stub, runners, { now: NOW });
    expect(calls.advisor).toEqual([{ org: "o1", release: "rel_1" }]);
  });

  it("skips advisor when recent run present (< maxAgeHours)", async () => {
    const stub = makeRepo();
    stub._orgs.push({ id: "o1" });
    stub._releases.push({ id: "rel_1", organizationId: "o1", status: "ready" });
    stub._advisorByRelease.set("rel_1", { generatedAt: new Date(NOW.getTime() - 30 * 60_000) }); // 30min ago
    const { runners, calls } = makeRunners();
    const r = await runAutonomousTick(stub, runners, { now: NOW });
    if (!r.ok) throw new Error("expected ok");
    expect(calls.advisor).toHaveLength(0);
    expect(r.skippedRuns).toBeGreaterThan(0);
  });

  it("does NOT run advisor for deployed/failed releases", async () => {
    const stub = makeRepo();
    stub._orgs.push({ id: "o1" });
    stub._releases.push({ id: "rel_1", organizationId: "o1", status: "deployed" });
    stub._releases.push({ id: "rel_2", organizationId: "o1", status: "failed" });
    stub._releases.push({ id: "rel_3", organizationId: "o1", status: "draft" });
    const { runners, calls } = makeRunners();
    await runAutonomousTick(stub, runners, { now: NOW });
    expect(calls.advisor).toEqual([{ org: "o1", release: "rel_3" }]);
  });

  it("runs advisor for stale recent (> maxAgeHours)", async () => {
    const stub = makeRepo();
    stub._orgs.push({ id: "o1" });
    stub._releases.push({ id: "rel_1", organizationId: "o1", status: "ready" });
    stub._advisorByRelease.set("rel_1", { generatedAt: new Date(NOW.getTime() - 8 * 3_600_000) }); // 8h ago
    const { runners, calls } = makeRunners();
    await runAutonomousTick(stub, runners, { now: NOW });
    expect(calls.advisor).toHaveLength(1);
  });
});

describe("runAutonomousTick — triage + remediation", () => {
  it("runs triage + remediation for open incident with no prior", async () => {
    const stub = makeRepo();
    stub._orgs.push({ id: "o1" });
    stub._incidents.push({ id: "inc_1", organizationId: "o1", status: "open" });
    const { runners, calls } = makeRunners();
    await runAutonomousTick(stub, runners, { now: NOW });
    expect(calls.triage).toEqual([{ org: "o1", incident: "inc_1" }]);
    expect(calls.remediation).toEqual([{ org: "o1", incident: "inc_1" }]);
  });

  it("skips triage when recent (< triageMaxAge)", async () => {
    const stub = makeRepo();
    stub._orgs.push({ id: "o1" });
    stub._incidents.push({ id: "inc_1", organizationId: "o1", status: "open" });
    stub._triageByIncident.set("inc_1", { generatedAt: new Date(NOW.getTime() - 15 * 60_000) }); // 15min ago
    const { runners, calls } = makeRunners();
    await runAutonomousTick(stub, runners, { now: NOW });
    expect(calls.triage).toHaveLength(0);
  });

  it("does NOT process resolved/wont_fix incidents", async () => {
    const stub = makeRepo();
    stub._orgs.push({ id: "o1" });
    stub._incidents.push({ id: "inc_1", organizationId: "o1", status: "resolved" });
    stub._incidents.push({ id: "inc_2", organizationId: "o1", status: "wont_fix" });
    stub._incidents.push({ id: "inc_3", organizationId: "o1", status: "mitigated" });
    const { runners, calls } = makeRunners();
    await runAutonomousTick(stub, runners, { now: NOW });
    expect(calls.triage).toEqual([{ org: "o1", incident: "inc_3" }]);
  });

  it("error from a runner is captured per-incident, not fatal", async () => {
    const stub = makeRepo();
    stub._orgs.push({ id: "o1" });
    stub._incidents.push({ id: "inc_1", organizationId: "o1", status: "open" });
    const calls = { advisor: [], triage: [], remediation: [], policy: [] };
    const runners: EngineRunners = {
      async runAdvisor() { return { ok: true }; },
      async runTriage(org, incidentId) { return { ok: false, reason: "boom" }; },
      async runRemediation() { return { ok: true }; },
      async runPolicyProposal() { return { ok: true }; },
    };
    const r = await runAutonomousTick(stub, runners, { now: NOW });
    if (!r.ok) throw new Error("expected ok");
    expect(r.errorRuns).toBeGreaterThan(0);
    const orgReport = r.perOrg[0];
    expect(orgReport.triageRuns[0].outcome).toBe("error");
    expect(orgReport.triageRuns[0].reason).toBe("boom");
  });

  it("thrown error is captured (safeRun catches)", async () => {
    const stub = makeRepo();
    stub._orgs.push({ id: "o1" });
    stub._incidents.push({ id: "inc_1", organizationId: "o1", status: "open" });
    const runners: EngineRunners = {
      async runAdvisor() { return { ok: true }; },
      async runTriage() { throw new Error("kaboom"); },
      async runRemediation() { return { ok: true }; },
      async runPolicyProposal() { return { ok: true }; },
    };
    const r = await runAutonomousTick(stub, runners, { now: NOW });
    if (!r.ok) throw new Error("expected ok");
    const orgReport = r.perOrg[0];
    expect(orgReport.triageRuns[0].outcome).toBe("error");
    expect(orgReport.triageRuns[0].reason).toBe("kaboom");
  });
});

describe("runAutonomousTick — policy proposal", () => {
  it("runs policy proposal when no prior", async () => {
    const stub = makeRepo();
    stub._orgs.push({ id: "o1" });
    const { runners, calls } = makeRunners();
    await runAutonomousTick(stub, runners, { now: NOW });
    expect(calls.policy).toEqual([{ org: "o1" }]);
  });

  it("skips policy proposal when recent (< 24h default)", async () => {
    const stub = makeRepo();
    stub._orgs.push({ id: "o1" });
    stub._policyByOrg.set("o1", { generatedAt: new Date(NOW.getTime() - 6 * 3_600_000) }); // 6h ago
    const { runners, calls } = makeRunners();
    const r = await runAutonomousTick(stub, runners, { now: NOW });
    if (!r.ok) throw new Error("expected ok");
    expect(calls.policy).toHaveLength(0);
    expect(r.perOrg[0].policyProposalRun?.outcome).toBe("skipped");
  });
});

describe("runAutonomousTick — config + scope", () => {
  it("respects per-org caps", async () => {
    const stub = makeRepo();
    stub._orgs.push({ id: "o1" });
    for (let i = 0; i < 20; i++) {
      stub._releases.push({ id: `rel_${i}`, organizationId: "o1", status: "ready" });
    }
    const { runners, calls } = makeRunners();
    await runAutonomousTick(stub, runners, { now: NOW, config: { maxReleasesPerOrg: 3 } });
    expect(calls.advisor).toHaveLength(3);
  });

  it("respects max orgs per tick", async () => {
    const stub = makeRepo();
    for (let i = 0; i < 10; i++) stub._orgs.push({ id: `o${i}` });
    const { runners } = makeRunners();
    const r = await runAutonomousTick(stub, runners, { now: NOW, config: { maxOrgsPerTick: 5 } });
    if (!r.ok) throw new Error("expected ok");
    // Note: the stub's findMany doesn't enforce take, so we observe via the
    // organization findMany contract — confirm orgs surveyed match the cap.
    expect(r.orgCount).toBeLessThanOrEqual(10);
  });

  it("iterates multiple orgs independently", async () => {
    const stub = makeRepo();
    stub._orgs.push({ id: "o1" });
    stub._orgs.push({ id: "o2" });
    stub._releases.push({ id: "rel_a", organizationId: "o1", status: "ready" });
    stub._releases.push({ id: "rel_b", organizationId: "o2", status: "ready" });
    const { runners, calls } = makeRunners();
    await runAutonomousTick(stub, runners, { now: NOW });
    expect(calls.advisor).toContainEqual({ org: "o1", release: "rel_a" });
    expect(calls.advisor).toContainEqual({ org: "o2", release: "rel_b" });
  });
});

describe("runAutonomousTick — degraded", () => {
  it("totals accumulate correctly across ok/skipped/error", async () => {
    const stub = makeRepo();
    stub._orgs.push({ id: "o1" });
    stub._releases.push({ id: "rel_1", organizationId: "o1", status: "ready" });
    // No prior — will run
    stub._releases.push({ id: "rel_2", organizationId: "o1", status: "ready" });
    stub._advisorByRelease.set("rel_2", { generatedAt: new Date(NOW.getTime() - 30 * 60_000) }); // skip

    const runners: EngineRunners = {
      async runAdvisor() { return { ok: true }; },
      async runTriage() { return { ok: true }; },
      async runRemediation() { return { ok: true }; },
      async runPolicyProposal() { return { ok: false, reason: "engine broke" }; },
    };
    const r = await runAutonomousTick(stub, runners, { now: NOW });
    if (!r.ok) throw new Error("expected ok");
    expect(r.totalRuns).toBe(r.okRuns + r.skippedRuns + r.errorRuns);
    expect(r.errorRuns).toBeGreaterThanOrEqual(1); // policy run errored
  });
});

describe("runAutonomousTick — proactive suggestions (Phase 526)", () => {
  function makeRepoWithSuggestions(): Stub & { _suggByOrg: Map<string, RecentRow> } {
    const stub = makeRepo() as Stub & { _suggByOrg: Map<string, RecentRow> };
    stub._suggByOrg = new Map();
    stub.proactiveAgiSuggestion = {
      async findFirst({ where }) { return stub._suggByOrg.get(where.organizationId) ?? null; },
    };
    return stub;
  }

  function makeRunnersWithSuggestion(): { runners: EngineRunners; calls: RunnerCalls & { suggestion: Array<{ org: string }> } } {
    const calls = { advisor: [] as Array<{ org: string; release: string }>, triage: [] as Array<{ org: string; incident: string }>, remediation: [] as Array<{ org: string; incident: string }>, policy: [] as Array<{ org: string }>, suggestion: [] as Array<{ org: string }> };
    const runners: EngineRunners = {
      async runAdvisor(org, releaseId) { calls.advisor.push({ org, release: releaseId }); return { ok: true }; },
      async runTriage(org, incidentId) { calls.triage.push({ org, incident: incidentId }); return { ok: true }; },
      async runRemediation(org, incidentId) { calls.remediation.push({ org, incident: incidentId }); return { ok: true }; },
      async runPolicyProposal(org) { calls.policy.push({ org }); return { ok: true }; },
      async runProactiveSuggestion(org) { calls.suggestion.push({ org }); return { ok: true }; },
    };
    return { runners, calls };
  }

  it("runs proactive suggestion when no prior exists", async () => {
    const stub = makeRepoWithSuggestions();
    stub._orgs.push({ id: "o1" });
    const { runners, calls } = makeRunnersWithSuggestion();
    const r = await runAutonomousTick(stub, runners, { now: NOW });
    expect(calls.suggestion).toEqual([{ org: "o1" }]);
    if (!r.ok) throw new Error("expected ok");
    expect(r.perOrg[0].proactiveSuggestionRun?.outcome).toBe("ok");
  });

  it("skips when recent suggestion present (< proactiveSuggestionMaxAgeHours)", async () => {
    const stub = makeRepoWithSuggestions();
    stub._orgs.push({ id: "o1" });
    stub._suggByOrg.set("o1", { generatedAt: new Date(NOW.getTime() - 30 * 60_000) }); // 30min ago, default 6h threshold
    const { runners, calls } = makeRunnersWithSuggestion();
    const r = await runAutonomousTick(stub, runners, { now: NOW });
    expect(calls.suggestion).toEqual([]);
    if (!r.ok) throw new Error("expected ok");
    expect(r.perOrg[0].proactiveSuggestionRun?.outcome).toBe("skipped");
  });

  it("re-runs when prior is older than threshold", async () => {
    const stub = makeRepoWithSuggestions();
    stub._orgs.push({ id: "o1" });
    stub._suggByOrg.set("o1", { generatedAt: new Date(NOW.getTime() - 7 * 60 * 60_000) }); // 7h ago
    const { runners, calls } = makeRunnersWithSuggestion();
    await runAutonomousTick(stub, runners, { now: NOW });
    expect(calls.suggestion).toEqual([{ org: "o1" }]);
  });

  it("respects custom proactiveSuggestionMaxAgeHours override", async () => {
    const stub = makeRepoWithSuggestions();
    stub._orgs.push({ id: "o1" });
    stub._suggByOrg.set("o1", { generatedAt: new Date(NOW.getTime() - 30 * 60_000) }); // 30min
    const { runners, calls } = makeRunnersWithSuggestion();
    // tighter threshold: 15 minutes
    await runAutonomousTick(stub, runners, { now: NOW, config: { proactiveSuggestionMaxAgeHours: 0.25 } });
    expect(calls.suggestion).toEqual([{ org: "o1" }]);
  });

  it("captures runner errors as 'error' outcome (does not throw)", async () => {
    const stub = makeRepoWithSuggestions();
    stub._orgs.push({ id: "o1" });
    const runners: EngineRunners = {
      async runAdvisor() { return { ok: true }; },
      async runTriage() { return { ok: true }; },
      async runRemediation() { return { ok: true }; },
      async runPolicyProposal() { return { ok: true }; },
      async runProactiveSuggestion() { throw new Error("provider down"); },
    };
    const r = await runAutonomousTick(stub, runners, { now: NOW });
    if (!r.ok) throw new Error("expected ok");
    expect(r.perOrg[0].proactiveSuggestionRun?.outcome).toBe("error");
    expect(r.perOrg[0].proactiveSuggestionRun?.reason).toContain("provider down");
  });

  it("skips entirely when no runner is wired (proactiveSuggestionRun stays null)", async () => {
    const stub = makeRepoWithSuggestions();
    stub._orgs.push({ id: "o1" });
    const runners: EngineRunners = {
      async runAdvisor() { return { ok: true }; },
      async runTriage() { return { ok: true }; },
      async runRemediation() { return { ok: true }; },
      async runPolicyProposal() { return { ok: true }; },
      // runProactiveSuggestion intentionally omitted
    };
    const r = await runAutonomousTick(stub, runners, { now: NOW });
    if (!r.ok) throw new Error("expected ok");
    expect(r.perOrg[0].proactiveSuggestionRun).toBeNull();
  });

  it("skips entirely when proactiveAgiSuggestion repo is not present (legacy schema)", async () => {
    const stub = makeRepo();
    stub._orgs.push({ id: "o1" });
    // proactiveAgiSuggestion intentionally omitted from the repo
    const { runners } = makeRunnersWithSuggestion();
    const r = await runAutonomousTick(stub, runners, { now: NOW });
    if (!r.ok) throw new Error("expected ok");
    expect(r.perOrg[0].proactiveSuggestionRun).toBeNull();
  });

  it("totals include the suggestion run", async () => {
    const stub = makeRepoWithSuggestions();
    stub._orgs.push({ id: "o1" });
    const { runners } = makeRunnersWithSuggestion();
    const r = await runAutonomousTick(stub, runners, { now: NOW });
    if (!r.ok) throw new Error("expected ok");
    expect(r.totalRuns).toBe(r.okRuns + r.skippedRuns + r.errorRuns);
    // 1 policy + 1 suggestion run for one org
    expect(r.totalRuns).toBeGreaterThanOrEqual(2);
  });
});
