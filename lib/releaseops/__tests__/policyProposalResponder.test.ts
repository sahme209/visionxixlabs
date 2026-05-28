import { describe, expect, it } from "vitest";
import {
  buildProposalGenerateResponse,
  buildProposalListResponse,
  buildProposalDecisionResponse,
  planProposalDecision,
  type PolicyProposalRepo,
  type PolicyRuleRow,
  type ProposalRow,
} from "../policyProposalResponder";
import type { PolicyProposalInputs } from "../policyProposalEngine";

interface Stub extends PolicyProposalRepo {
  _proposals: ProposalRow[];
  _rules: PolicyRuleRow[];
  _nextProposalId: number;
  _nextRuleId: number;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _proposals: [],
    _rules: [],
    _nextProposalId: 1,
    _nextRuleId: 1,
    policyProposal: {
      async findUnique({ where }) {
        return stub._proposals.find((p) => p.id === where.id) ?? null;
      },
      async findMany({ where, take }) {
        const out = stub._proposals.filter((p) => {
          if (p.organizationId !== where.organizationId) return false;
          if (where.operatorDecision !== undefined && p.operatorDecision !== where.operatorDecision) return false;
          return true;
        }).sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
        return take ? out.slice(0, take) : out;
      },
      async createMany({ data, skipDuplicates }) {
        const now = new Date();
        let count = 0;
        for (let i = 0; i < data.length; i++) {
          const d = data[i];
          if (skipDuplicates) {
            const dup = stub._proposals.find(
              (p) => p.organizationId === d.organizationId && p.suggestedRuleKey === d.suggestedRuleKey && p.operatorDecision === d.operatorDecision,
            );
            if (dup) continue;
          }
          stub._proposals.push({
            id: `prop_${stub._nextProposalId++}`,
            organizationId: d.organizationId,
            kind: d.kind,
            suggestedRuleKey: d.suggestedRuleKey,
            title: d.title,
            rationale: d.rationale,
            confidence: d.confidence,
            severity: d.severity,
            evidenceJson: d.evidenceJson,
            suggestedRuleBodyJson: d.suggestedRuleBodyJson,
            operatorDecision: d.operatorDecision,
            decidedByUserId: null,
            decidedAt: null,
            decisionNote: null,
            acceptedRuleId: null,
            engineVersion: d.engineVersion,
            generatedAt: new Date(now.getTime() + count),
            updatedAt: now,
          });
          count += 1;
        }
        return { count };
      },
      async update({ where, data }) {
        const idx = stub._proposals.findIndex((p) => p.id === where.id);
        if (idx < 0) throw new Error("not found");
        stub._proposals[idx] = {
          ...stub._proposals[idx],
          operatorDecision: data.operatorDecision,
          decidedByUserId: data.decidedByUserId,
          decidedAt: data.decidedAt,
          decisionNote: data.decisionNote ?? null,
          acceptedRuleId: data.acceptedRuleId ?? null,
          updatedAt: new Date(),
        };
        return stub._proposals[idx];
      },
    },
    policyRule: {
      async upsert({ where, create, update }) {
        const k = where.organizationId_key;
        const idx = stub._rules.findIndex((r) => r.organizationId === k.organizationId && r.key === k.key);
        if (idx >= 0) {
          // Just rewrite; the stub doesn't model individual fields.
          void update;
          return stub._rules[idx];
        }
        const row: PolicyRuleRow = {
          id: `rule_${stub._nextRuleId++}`,
          organizationId: create.organizationId,
          key: create.key,
        };
        stub._rules.push(row);
        return row;
      },
    },
  };
  return stub;
}

const NOW = new Date("2026-05-26T12:00:00Z");

function baseInputs(overrides: Partial<PolicyProposalInputs> = {}): PolicyProposalInputs {
  return {
    releasesAnalyzed: 10,
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

describe("planProposalDecision", () => {
  it("pending → accepted on accept", () => {
    expect(planProposalDecision("pending", "accept")).toEqual({ ok: true, next: "accepted" });
  });
  it("rejects any transition from accepted (terminal)", () => {
    expect(planProposalDecision("accepted", "reject").ok).toBe(false);
  });
});

describe("buildProposalGenerateResponse", () => {
  it("200 persists fresh proposals", async () => {
    const stub = makeRepo();
    const r = await buildProposalGenerateResponse(stub, {
      organizationId: "o",
      engineInputs: baseInputs({ forcePushAllowedMainRepos: 1 }),
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.newProposalCount).toBeGreaterThan(0);
    expect(stub._proposals.length).toBeGreaterThan(0);
    expect(stub._proposals[0].operatorDecision).toBe("pending");
  });

  it("200 idempotent — re-run does not duplicate the same pending rule key", async () => {
    const stub = makeRepo();
    await buildProposalGenerateResponse(stub, {
      organizationId: "o",
      engineInputs: baseInputs({ forcePushAllowedMainRepos: 1 }),
    });
    const firstSize = stub._proposals.length;
    await buildProposalGenerateResponse(stub, {
      organizationId: "o",
      // Re-pass with the prior pending key listed so the engine suppresses.
      engineInputs: baseInputs({
        forcePushAllowedMainRepos: 1,
        pendingProposalKeys: stub._proposals.map((p) => p.suggestedRuleKey),
      }),
    });
    expect(stub._proposals.length).toBe(firstSize);
  });

  it("503 migration_pending", async () => {
    const stub = makeRepo();
    stub.policyProposal.createMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildProposalGenerateResponse(stub, {
      organizationId: "o",
      engineInputs: baseInputs({ forcePushAllowedMainRepos: 1 }),
    });
    expect(r.status).toBe(503);
  });
});

describe("buildProposalListResponse", () => {
  it("200 reports per-decision summary", async () => {
    const stub = makeRepo();
    await buildProposalGenerateResponse(stub, {
      organizationId: "o",
      engineInputs: baseInputs({
        releasesAnalyzed: 10,
        forcePushAllowedMainRepos: 1,
        weakProtectionMainRepos: 4,
      }),
    });
    const r = await buildProposalListResponse(stub, { organizationId: "o" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.summary.pending).toBeGreaterThanOrEqual(2);
  });
});

describe("buildProposalDecisionResponse", () => {
  async function seeded(): Promise<{ stub: Stub; id: string }> {
    const stub = makeRepo();
    await buildProposalGenerateResponse(stub, {
      organizationId: "o",
      engineInputs: baseInputs({ forcePushAllowedMainRepos: 1 }),
    });
    return { stub, id: stub._proposals[0].id };
  }

  it("200 accept upserts a PolicyRule + records acceptedRuleId", async () => {
    const { stub, id } = await seeded();
    const r = await buildProposalDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", proposalId: id, action: "accept",
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.decision).toBe("accepted");
    expect(r.body.data.acceptedRuleId).not.toBeNull();
    expect(stub._rules.length).toBe(1);
    expect(stub._rules[0].key).toBe("limit_force_push_on_main");
  });

  it("200 reject does not create a PolicyRule", async () => {
    const { stub, id } = await seeded();
    const r = await buildProposalDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", proposalId: id, action: "reject",
      note: "We use a compensating control elsewhere.",
    });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.decision).toBe("rejected");
    expect(stub._rules.length).toBe(0);
    expect(stub._proposals.find((p) => p.id === id)?.decisionNote).toContain("compensating");
  });

  it("200 accept honors ruleKeyOverride", async () => {
    const { stub, id } = await seeded();
    await buildProposalDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", proposalId: id, action: "accept",
      ruleKeyOverride: "company_no_force_push",
    });
    expect(stub._rules[0].key).toBe("company_no_force_push");
  });

  it("404 proposal_not_found", async () => {
    const stub = makeRepo();
    const r = await buildProposalDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", proposalId: "missing", action: "accept",
    });
    expect(r.status).toBe(404);
  });

  it("403 cross_org_proposal", async () => {
    const { stub, id } = await seeded();
    const r = await buildProposalDecisionResponse(stub, {
      organizationId: "different", actorUserId: "u", proposalId: id, action: "accept",
    });
    expect(r.status).toBe(403);
  });

  it("409 illegal_transition from accepted (terminal)", async () => {
    const { stub, id } = await seeded();
    await buildProposalDecisionResponse(stub, { organizationId: "o", actorUserId: "u", proposalId: id, action: "accept" });
    const r = await buildProposalDecisionResponse(stub, { organizationId: "o", actorUserId: "u", proposalId: id, action: "reject" });
    expect(r.status).toBe(409);
  });

  it("422 invalid_rule_body when suggestedRuleBody lacks shape", async () => {
    const { stub, id } = await seeded();
    // mutate the proposal to have a junk body
    const idx = stub._proposals.findIndex((p) => p.id === id);
    stub._proposals[idx] = { ...stub._proposals[idx], suggestedRuleBodyJson: { broken: true } };
    const r = await buildProposalDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", proposalId: id, action: "accept",
    });
    expect(r.status).toBe(422);
  });

  it("503 migration_pending on findUnique failure", async () => {
    const { stub, id } = await seeded();
    stub.policyProposal.findUnique = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildProposalDecisionResponse(stub, {
      organizationId: "o", actorUserId: "u", proposalId: id, action: "accept",
    });
    expect(r.status).toBe(503);
  });
});
