import { describe, expect, it } from "vitest";
import {
  buildPolicyEvaluateResponse,
  type PolicyEvaluateRepo,
  type EvalReleaseRow,
  type EvalEnvironmentRow,
  type EvalCherryPickRow,
  type EvalChangeTicketRow,
  type EvalPolicyRuleRow,
  type EvalExistingViolationRow,
} from "../policyEvaluateResponder";

type RepoStub = PolicyEvaluateRepo & {
  _release: EvalReleaseRow | null;
  _environment: EvalEnvironmentRow | null;
  _cherryPick: EvalCherryPickRow | null;
  _changeTicket: EvalChangeTicketRow | null;
  _rules: EvalPolicyRuleRow[];
  _violations: Map<string, EvalExistingViolationRow>;
  _creates: Array<{ ruleId: string; message: string }>;
  _updates: Array<{ id: string; status?: string; message?: string }>;
};

function makeRepo(): RepoStub {
  let nextId = 1;
  const stub: RepoStub = {
    _release: null,
    _environment: null,
    _cherryPick: null,
    _changeTicket: null,
    _rules: [],
    _violations: new Map(),
    _creates: [],
    _updates: [],
    release: { async findUnique() { return stub._release; } },
    environment: { async findUnique() { return stub._environment; } },
    cherryPickException: { async findFirst() { return stub._cherryPick; } },
    changeTicket: { async findFirst() { return stub._changeTicket; } },
    policyRule: { async findMany() { return stub._rules; } },
    policyViolation: {
      async findMany() { return Array.from(stub._violations.values()); },
      async create({ data }) {
        const id = `pv_${nextId++}`;
        stub._violations.set(id, { id, ruleId: data.ruleId, status: data.status });
        stub._creates.push({ ruleId: data.ruleId, message: data.message });
        return { id };
      },
      async update({ where, data }) {
        const existing = stub._violations.get(where.id);
        if (existing && data.status) stub._violations.set(where.id, { ...existing, status: data.status });
        stub._updates.push({ id: where.id, status: data.status, message: data.message });
        return { id: where.id };
      },
    },
  };
  return stub;
}

function makeRelease(over: Partial<EvalReleaseRow> = {}): EvalReleaseRow {
  return {
    id: "rel_1", organizationId: "o", applicationId: "app", status: "ready",
    releaseTag: "v1.0.0", commitSha: "abc",
    scopeFinalizedAt: new Date("2026-05-23T10:00:00Z"),
    rollbackReferenceReleaseId: "rel_prev",
    plannedWindowStart: null, plannedWindowEnd: null,
    actualDeployStart: null, actualDeployEnd: null,
    targetEnvironmentId: null,
    ...over,
  };
}

const NOW = new Date("2026-05-25T12:00:00Z");

describe("buildPolicyEvaluateResponse", () => {
  it("404 when release missing", async () => {
    const repo = makeRepo();
    const r = await buildPolicyEvaluateResponse(repo, { organizationId: "o", releaseId: "missing" }, { now: NOW });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("release_not_found");
  });

  it("403 cross_org_release", async () => {
    const repo = makeRepo();
    repo._release = makeRelease({ organizationId: "other" });
    const r = await buildPolicyEvaluateResponse(repo, { organizationId: "o", releaseId: "rel_1" }, { now: NOW });
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_release");
  });

  it("no rules configured → 200 with verdict=clean", async () => {
    const repo = makeRepo();
    repo._release = makeRelease();
    const r = await buildPolicyEvaluateResponse(repo, { organizationId: "o", releaseId: "rel_1" }, { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.verdict).toBe("clean");
    expect(r.body.data.evaluatedRuleCount).toBe(0);
    expect(r.body.data.opened).toBe(0);
    expect(r.body.data.refreshed).toBe(0);
    expect(r.body.data.resolved).toBe(0);
  });

  it("environment tier comes from environment row when targetEnvironmentId set", async () => {
    const repo = makeRepo();
    repo._release = makeRelease({ targetEnvironmentId: "env_prod" });
    repo._environment = { id: "env_prod", tier: "prod" };
    const r = await buildPolicyEvaluateResponse(repo, { organizationId: "o", releaseId: "rel_1" }, { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.environmentTier).toBe("prod");
  });

  it("falls back to provided tier when env lookup misses", async () => {
    const repo = makeRepo();
    repo._release = makeRelease();
    const r = await buildPolicyEvaluateResponse(
      repo,
      { organizationId: "o", releaseId: "rel_1", fallbackEnvironmentTier: "preprod" },
      { now: NOW },
    );
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.environmentTier).toBe("preprod");
  });

  it("unknown rules (key not in seed) get a no-op evaluator → no violations, no writes", async () => {
    const repo = makeRepo();
    repo._release = makeRelease({ targetEnvironmentId: "env_prod" });
    repo._environment = { id: "env_prod", tier: "prod" };
    repo._rules.push({
      id: "r_unknown", key: "some_unknown_rule_not_in_seed",
      label: "X", severity: "high", blocking: true,
      exceptionAllowed: true, approverRole: null, evidenceRequired: false,
      autoRemediationKey: null, enabled: true,
    });
    const r = await buildPolicyEvaluateResponse(repo, { organizationId: "o", releaseId: "rel_1" }, { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    // composeActiveRules gives unknown keys a no-op evaluator that
    // always returns { violation: false }, so the engine's
    // ignoredUnknownRules counter stays at 0 (it only counts rules
    // with no evaluator at all — which doesn't happen post-compose).
    expect(r.body.data.evaluatedRuleCount).toBe(1);
    expect(r.body.data.violations).toEqual([]);
    expect(repo._creates).toEqual([]);
  });

  it("previously-open violation whose rule now passes → marked resolved", async () => {
    const repo = makeRepo();
    repo._release = makeRelease();
    repo._violations.set("pv_old", { id: "pv_old", ruleId: "r_obsolete", status: "open" });
    const r = await buildPolicyEvaluateResponse(repo, { organizationId: "o", releaseId: "rel_1" }, { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.resolved).toBe(1);
    const resolveUpdate = repo._updates.find((u) => u.id === "pv_old" && u.status === "resolved");
    expect(resolveUpdate).toBeDefined();
  });

  it("503 migration_pending when table missing", async () => {
    const repo = makeRepo();
    repo._release = makeRelease();
    repo.policyRule.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildPolicyEvaluateResponse(repo, { organizationId: "o", releaseId: "rel_1" }, { now: NOW });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
