import { describe, expect, it } from "vitest";
import {
  buildAgiMemoryListResponse,
  buildEnrichmentGenerateResponse,
  buildEnrichmentReadResponse,
  enrichDecisionBestEffort,
  type EnrichmentRepo,
  type EnrichmentRow,
} from "../aiRationaleEnricherResponder";
import type { RationaleAiFetcher } from "../aiRationaleEnricherEngine";
import type { CouncilDecision } from "../advisorCouncilEngine";
import type { AdvisorInputs } from "../releaseAdvisorEngine";

const NOW = new Date("2026-05-28T12:00:00Z");

interface Stub extends EnrichmentRepo {
  _rows: EnrichmentRow[];
  _failNext?: "missing_table" | "boom";
}

function makeRepo(): Stub {
  const stub: Stub = {
    _rows: [],
    aiRationaleEnrichment: {
      async findUnique({ where }) {
        if (stub._failNext === "missing_table") {
          stub._failNext = undefined;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e: any = new Error("relation does not exist");
          e.code = "P2021";
          throw e;
        }
        if (stub._failNext === "boom") {
          stub._failNext = undefined;
          throw new Error("db down");
        }
        const k = where.organizationId_targetKind_targetId;
        return stub._rows.find((r) =>
          r.organizationId === k.organizationId && r.targetKind === k.targetKind && r.targetId === k.targetId,
        ) ?? null;
      },
      async findMany({ where, take }) {
        if (stub._failNext === "missing_table") {
          stub._failNext = undefined;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e: any = new Error("relation does not exist");
          e.code = "P2021";
          throw e;
        }
        if (stub._failNext === "boom") {
          stub._failNext = undefined;
          throw new Error("db down");
        }
        const filtered = stub._rows.filter((r) => {
          if (r.organizationId !== where.organizationId) return false;
          if (where.targetKind && r.targetKind !== where.targetKind) return false;
          return true;
        }).sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
        return typeof take === "number" ? filtered.slice(0, take) : filtered;
      },
      async upsert({ where, create, update }) {
        if (stub._failNext === "missing_table") {
          stub._failNext = undefined;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e: any = new Error("relation does not exist");
          e.code = "P2021";
          throw e;
        }
        if (stub._failNext === "boom") {
          stub._failNext = undefined;
          throw new Error("db down");
        }
        const k = where.organizationId_targetKind_targetId;
        const existing = stub._rows.find((r) =>
          r.organizationId === k.organizationId && r.targetKind === k.targetKind && r.targetId === k.targetId,
        );
        if (existing) {
          Object.assign(existing, update, { updatedAt: NOW });
          return existing;
        }
        const row: EnrichmentRow = {
          id: `enr_${stub._rows.length + 1}`,
          organizationId: create.organizationId,
          targetKind: create.targetKind,
          targetId: create.targetId,
          narrative: create.narrative,
          riskFactorsJson: create.riskFactorsJson,
          nextActionsJson: create.nextActionsJson,
          outcome: create.outcome,
          errorMessage: create.errorMessage,
          modelHint: create.modelHint,
          engineVersion: create.engineVersion,
          generatedAt: NOW,
          updatedAt: NOW,
        };
        stub._rows.push(row);
        return row;
      },
    },
  };
  return stub;
}

function decision(overrides: Partial<CouncilDecision> = {}): CouncilDecision {
  return {
    engineVersion: "advisor-council-v1.0.0",
    generatedAtIso: NOW.toISOString(),
    consensusKind: "block_deploy",
    agreementScore: 75,
    title: "Council: Block deploy",
    rationale: "Two voters blocked.",
    votes: [
      { voterId: "rule_based", kind: "block_deploy", confidence: 85, rationale: "blocking violations" },
      { voterId: "conservative", kind: "block_deploy", confidence: 90, rationale: "risk averse" },
      { voterId: "pragmatic", kind: "proceed", confidence: 80, rationale: "ship it" },
    ],
    voterCount: 3,
    ...overrides,
  };
}

function inputs(): AdvisorInputs {
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
  };
}

const VALID_AI = JSON.stringify({
  narrative: "Council blocked due to blocking violations + readiness 60.",
  riskFactors: ["Blocking violations", "Manual fix in prod"],
  nextActions: ["Resolve violations", "Reconcile manual fixes"],
});

describe("buildEnrichmentGenerateResponse", () => {
  it("200 + ai_generated on valid fetcher", async () => {
    const stub = makeRepo();
    const fetcher: RationaleAiFetcher = async () => ({ text: VALID_AI, modelHint: "claude-opus-4-7" });
    const r = await buildEnrichmentGenerateResponse(stub, {
      organizationId: "o", decisionId: "d1",
      decision: decision(), inputs: inputs(), fetcher,
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.enrichment.outcome).toBe("ai_generated");
    expect(r.body.data.enrichment.modelHint).toBe("claude-opus-4-7");
    expect(stub._rows.length).toBe(1);
  });

  it("200 + fallback_rules when fetcher is null", async () => {
    const stub = makeRepo();
    const r = await buildEnrichmentGenerateResponse(stub, {
      organizationId: "o", decisionId: "d1",
      decision: decision(), inputs: inputs(), fetcher: null,
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.enrichment.outcome).toBe("fallback_rules");
    expect(r.body.data.enrichment.narrative.length).toBeGreaterThan(0);
    expect(r.body.data.enrichment.riskFactors.length).toBeGreaterThan(0);
  });

  it("upserts on second call (no duplicate row)", async () => {
    const stub = makeRepo();
    await buildEnrichmentGenerateResponse(stub, {
      organizationId: "o", decisionId: "d1",
      decision: decision(), inputs: inputs(), fetcher: null,
    });
    await buildEnrichmentGenerateResponse(stub, {
      organizationId: "o", decisionId: "d1",
      decision: decision(), inputs: inputs(),
      fetcher: async () => ({ text: VALID_AI, modelHint: "claude-haiku-4-5" }),
    });
    expect(stub._rows.length).toBe(1);
    expect(stub._rows[0].outcome).toBe("ai_generated");
    expect(stub._rows[0].modelHint).toBe("claude-haiku-4-5");
  });

  it("503 migration_pending when table missing", async () => {
    const stub = makeRepo();
    stub._failNext = "missing_table";
    const r = await buildEnrichmentGenerateResponse(stub, {
      organizationId: "o", decisionId: "d1",
      decision: decision(), inputs: inputs(), fetcher: null,
    });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });

  it("500 persist_failed on generic db error", async () => {
    const stub = makeRepo();
    stub._failNext = "boom";
    const r = await buildEnrichmentGenerateResponse(stub, {
      organizationId: "o", decisionId: "d1",
      decision: decision(), inputs: inputs(), fetcher: null,
    });
    expect(r.status).toBe(500);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("persist_failed");
  });
});

describe("buildEnrichmentReadResponse", () => {
  it("200 + null when nothing persisted", async () => {
    const stub = makeRepo();
    const r = await buildEnrichmentReadResponse(stub, "o", "d1");
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.enrichment).toBeNull();
  });

  it("200 + cached row after a generate", async () => {
    const stub = makeRepo();
    await buildEnrichmentGenerateResponse(stub, {
      organizationId: "o", decisionId: "d1",
      decision: decision(), inputs: inputs(), fetcher: null,
    });
    const r = await buildEnrichmentReadResponse(stub, "o", "d1");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.enrichment).not.toBeNull();
    expect(r.body.data.enrichment!.narrative.length).toBeGreaterThan(0);
  });

  it("503 migration_pending when table missing", async () => {
    const stub = makeRepo();
    stub._failNext = "missing_table";
    const r = await buildEnrichmentReadResponse(stub, "o", "d1");
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });

  it("500 read_failed on generic db error", async () => {
    const stub = makeRepo();
    stub._failNext = "boom";
    const r = await buildEnrichmentReadResponse(stub, "o", "d1");
    expect(r.status).toBe(500);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("read_failed");
  });
});

describe("enrichDecisionBestEffort", () => {
  it("returns view + persists on success", async () => {
    const stub = makeRepo();
    const out = await enrichDecisionBestEffort(stub, {
      organizationId: "o", decisionId: "d1",
      decision: decision(), inputs: inputs(),
      fetcher: async () => ({ text: VALID_AI, modelHint: "claude-opus-4-7" }),
    });
    expect(out).not.toBeNull();
    expect(out!.outcome).toBe("ai_generated");
    expect(stub._rows.length).toBe(1);
  });

  it("returns null when persistence fails (never throws)", async () => {
    const stub = makeRepo();
    stub._failNext = "boom";
    const out = await enrichDecisionBestEffort(stub, {
      organizationId: "o", decisionId: "d1",
      decision: decision(), inputs: inputs(), fetcher: null,
    });
    expect(out).toBeNull();
    // No row was persisted.
    expect(stub._rows.length).toBe(0);
  });

  it("returns fallback view when fetcher is null", async () => {
    const stub = makeRepo();
    const out = await enrichDecisionBestEffort(stub, {
      organizationId: "o", decisionId: "d1",
      decision: decision(), inputs: inputs(), fetcher: null,
    });
    expect(out).not.toBeNull();
    expect(out!.outcome).toBe("fallback_rules");
  });
});

describe("buildAgiMemoryListResponse", () => {
  function seed(stub: ReturnType<typeof makeRepo>) {
    // Insert 5 enrichments across 3 target kinds with staggered timestamps.
    const items: Array<Omit<EnrichmentRow, "id" | "updatedAt">> = [
      { organizationId: "o", targetKind: "council",     targetId: "c1", narrative: "n1", riskFactorsJson: ["r"], nextActionsJson: ["a"], outcome: "ai_generated",   errorMessage: null, modelHint: "claude-opus-4-7",   engineVersion: "v1", generatedAt: new Date("2026-05-28T10:00:00Z") },
      { organizationId: "o", targetKind: "council",     targetId: "c2", narrative: "n2", riskFactorsJson: ["r"], nextActionsJson: ["a"], outcome: "fallback_rules", errorMessage: null, modelHint: null,                 engineVersion: "v1", generatedAt: new Date("2026-05-28T11:00:00Z") },
      { organizationId: "o", targetKind: "triage",      targetId: "t1", narrative: "n3", riskFactorsJson: ["r"], nextActionsJson: ["a"], outcome: "ai_generated",   errorMessage: null, modelHint: "claude-sonnet-4-6", engineVersion: "v1", generatedAt: new Date("2026-05-28T12:00:00Z") },
      { organizationId: "o", targetKind: "remediation", targetId: "p1", narrative: "n4", riskFactorsJson: ["r"], nextActionsJson: ["a"], outcome: "error",          errorMessage: "boom", modelHint: null,               engineVersion: "v1", generatedAt: new Date("2026-05-28T13:00:00Z") },
      { organizationId: "o2", targetKind: "council",    targetId: "x1", narrative: "x",  riskFactorsJson: [],    nextActionsJson: [],    outcome: "ai_generated",   errorMessage: null, modelHint: "claude-opus-4-7",   engineVersion: "v1", generatedAt: new Date("2026-05-28T14:00:00Z") },
    ];
    for (const item of items) stub._rows.push({ id: `enr_${stub._rows.length + 1}`, ...item, updatedAt: item.generatedAt });
  }

  it("200 returns entries sorted newest-first + scoped to org", async () => {
    const stub = makeRepo();
    seed(stub);
    const r = await buildAgiMemoryListResponse(stub, { organizationId: "o" });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.entries).toHaveLength(4);
    // newest first
    expect(r.body.data.entries[0].targetKind).toBe("remediation");
    expect(r.body.data.entries[3].targetKind).toBe("council");
    // other org excluded
    expect(r.body.data.entries.every((e) => e.targetId !== "x1")).toBe(true);
  });

  it("summary tallies per outcome + per targetKind + model set", async () => {
    const stub = makeRepo();
    seed(stub);
    const r = await buildAgiMemoryListResponse(stub, { organizationId: "o" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.summary.total).toBe(4);
    expect(r.body.data.summary.aiGenerated).toBe(2);
    expect(r.body.data.summary.fallbackRules).toBe(1);
    expect(r.body.data.summary.errored).toBe(1);
    expect(r.body.data.summary.byTargetKind).toEqual({ council: 2, triage: 1, remediation: 1 });
    expect(r.body.data.summary.modelsUsed).toEqual(["claude-opus-4-7", "claude-sonnet-4-6"]);
  });

  it("filters by targetKind when provided", async () => {
    const stub = makeRepo();
    seed(stub);
    const r = await buildAgiMemoryListResponse(stub, { organizationId: "o", targetKind: "council" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.entries).toHaveLength(2);
    expect(r.body.data.entries.every((e) => e.targetKind === "council")).toBe(true);
  });

  it("clamps take to [1, 500] and respects pagination", async () => {
    const stub = makeRepo();
    seed(stub);
    const r1 = await buildAgiMemoryListResponse(stub, { organizationId: "o", take: 2 });
    if (!r1.body.ok) throw new Error("expected ok");
    expect(r1.body.data.entries).toHaveLength(2);

    const r2 = await buildAgiMemoryListResponse(stub, { organizationId: "o", take: 0 });
    if (!r2.body.ok) throw new Error("expected ok");
    expect(r2.body.data.entries.length).toBeGreaterThanOrEqual(1);

    const r3 = await buildAgiMemoryListResponse(stub, { organizationId: "o", take: 9999 });
    if (!r3.body.ok) throw new Error("expected ok");
    expect(r3.body.data.entries).toHaveLength(4);
  });

  it("200 empty when org has no enrichments yet", async () => {
    const stub = makeRepo();
    const r = await buildAgiMemoryListResponse(stub, { organizationId: "empty-org" });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.entries).toHaveLength(0);
    expect(r.body.data.summary.total).toBe(0);
  });

  it("503 migration_pending when table missing", async () => {
    const stub = makeRepo();
    stub._failNext = "missing_table";
    const r = await buildAgiMemoryListResponse(stub, { organizationId: "o" });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });

  it("500 read_failed on generic db error", async () => {
    const stub = makeRepo();
    stub._failNext = "boom";
    const r = await buildAgiMemoryListResponse(stub, { organizationId: "o" });
    expect(r.status).toBe(500);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("read_failed");
  });
});
