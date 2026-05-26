import { describe, expect, it } from "vitest";
import {
  composeActiveRules,
  defaultActiveRulesFromSeed,
  evaluateReleasePolicy,
  type ActiveRule,
  type ActiveRuleRow,
} from "../policyEngine";
import { SEED_POLICIES, type PolicyEvaluationContext } from "../policies/seed";
import type { ReleaseRow } from "../releaseRepo";

/* ──────────────────────────────────────────────────────────────────
   Phase 443 — engine matrix tests.
   ────────────────────────────────────────────────────────────── */

const NOW = new Date("2026-06-01T22:30:00Z");

function makeRelease(over: Partial<ReleaseRow> = {}): PolicyEvaluationContext["release"] {
  return {
    id: "rel_1",
    organizationId: "o",
    applicationId: "app_1",
    status: "ready",
    releaseTag: "v2.7.0",
    commitSha: "deadbeef",
    scopeFinalizedAt: NOW,
    rollbackReferenceReleaseId: "rel_prev",
    plannedWindowStart: new Date("2026-06-01T22:00:00Z"),
    plannedWindowEnd: new Date("2026-06-01T23:30:00Z"),
    actualDeployStart: null,
    actualDeployEnd: null,
    ...over,
  };
}

/**
 * Clean prod context — every rule passes against this. Each test then
 * mutates ONE field to trigger ONE rule, proving the rule fires when
 * expected and stays silent otherwise.
 */
function cleanProdContext(over: Partial<PolicyEvaluationContext> = {}): PolicyEvaluationContext {
  return {
    release: makeRelease(),
    environmentTier: "prod",
    changeTicket: {
      id: "CHG-0001",
      state: "approved",
      hasCommitSha: true,
      hasArtifactTag: true,
      hasRollbackPlan: true,
    },
    branchValidation: { status: "passing", failingChecks: 0 },
    helmDeployment: { hasPreviousRevision: true },
    databaseChange: { hasRollbackOrDocumentedRecovery: true },
    newSecrets: [],
    manualFixes: [],
    cherryPick: null,
    lastMinutePr: null,
    comms: { lastSentIncludesTicketAndTag: true },
    runtimeConfigOutsideGitDetected: false,
    now: NOW,
    ...over,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Baseline — clean context passes everything.
   ────────────────────────────────────────────────────────────── */

describe("evaluateReleasePolicy — clean context against full seed catalog", () => {
  it("returns clean verdict with zero violations on a fully-compliant prod release", () => {
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), cleanProdContext());
    expect(result.verdict).toBe("clean");
    expect(result.violations).toEqual([]);
    expect(result.summary.total).toBe(0);
    expect(result.summary.blocking).toBe(0);
  });

  it("non-prod environment skips the production-only rules even when they would fire on prod", () => {
    const ctx = cleanProdContext({
      environmentTier: "dev",
      release: makeRelease({ releaseTag: null, rollbackReferenceReleaseId: null }),
      branchValidation: { status: "failing", failingChecks: 3 },
      changeTicket: null,
    });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    // None of the prod_* rules should fire.
    const firedKeys = result.violations.map((v) => v.ruleKey);
    expect(firedKeys).not.toContain("prod_requires_release_tag");
    expect(firedKeys).not.toContain("prod_requires_change_ticket");
    expect(firedKeys).not.toContain("prod_requires_rollback_plan");
    expect(firedKeys).not.toContain("prod_requires_branch_validation_pass");
  });
});

/* ──────────────────────────────────────────────────────────────────
   Per-rule fire test. One assertion per seed rule's violation path.
   ────────────────────────────────────────────────────────────── */

describe("seed rules — each fires when its specific precondition is broken", () => {
  it("prod_requires_release_tag fires when releaseTag is null", () => {
    const ctx = cleanProdContext({ release: makeRelease({ releaseTag: null }) });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).toContain("prod_requires_release_tag");
  });

  it("prod_requires_change_ticket fires when ticket is null", () => {
    const ctx = cleanProdContext({ changeTicket: null });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).toContain("prod_requires_change_ticket");
  });

  it("prod_requires_change_ticket fires when ticket is in non-approved state", () => {
    const ctx = cleanProdContext({
      changeTicket: { id: "CHG-1", state: "draft", hasCommitSha: true, hasArtifactTag: true, hasRollbackPlan: true },
    });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).toContain("prod_requires_change_ticket");
  });

  it("prod_requires_rollback_plan fires when rollbackReferenceReleaseId is null", () => {
    const ctx = cleanProdContext({ release: makeRelease({ rollbackReferenceReleaseId: null }) });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).toContain("prod_requires_rollback_plan");
  });

  it("prod_requires_branch_validation_pass fires when status is not_run", () => {
    const ctx = cleanProdContext({ branchValidation: { status: "not_run", failingChecks: 0 } });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).toContain("prod_requires_branch_validation_pass");
  });

  it("prod_requires_branch_validation_pass fires when status is failing", () => {
    const ctx = cleanProdContext({ branchValidation: { status: "failing", failingChecks: 2 } });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).toContain("prod_requires_branch_validation_pass");
  });

  it("ticket_must_include_commit_sha fires when ticket lacks SHA", () => {
    const ctx = cleanProdContext({
      changeTicket: { id: "CHG-1", state: "approved", hasCommitSha: false, hasArtifactTag: true, hasRollbackPlan: true },
    });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).toContain("ticket_must_include_commit_sha");
  });

  it("ticket_must_include_artifact_tag fires when ticket lacks artifact tag", () => {
    const ctx = cleanProdContext({
      changeTicket: { id: "CHG-1", state: "approved", hasCommitSha: true, hasArtifactTag: false, hasRollbackPlan: true },
    });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).toContain("ticket_must_include_artifact_tag");
  });

  it("new_secret_requires_owner_and_regen fires for any new secret missing owner or regen", () => {
    const ctx = cleanProdContext({
      newSecrets: [
        { key: "STRIPE_KEY",  hasOwner: true,  hasRegenInstructions: true },
        { key: "OPENAI_KEY",  hasOwner: false, hasRegenInstructions: true },
      ],
    });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    const v = result.violations.find((vv) => vv.ruleKey === "new_secret_requires_owner_and_regen");
    expect(v).toBeDefined();
    expect(v!.message).toMatch(/OPENAI_KEY/);
  });

  it("manual_fix_requires_reconciliation fires for any unreconciled manual fix", () => {
    const ctx = cleanProdContext({
      manualFixes: [
        { id: "mf_1", hasReconciliationTask: true },
        { id: "mf_2", hasReconciliationTask: false },
      ],
    });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).toContain("manual_fix_requires_reconciliation");
  });

  it("helm_requires_previous_revision fires when hasPreviousRevision is false", () => {
    const ctx = cleanProdContext({ helmDeployment: { hasPreviousRevision: false } });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).toContain("helm_requires_previous_revision");
  });

  it("helm_requires_previous_revision does NOT fire when there is no helm deployment in this release", () => {
    const ctx = cleanProdContext({ helmDeployment: null });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).not.toContain("helm_requires_previous_revision");
  });

  it("liquibase_requires_rollback_or_recovery fires when DB change lacks rollback", () => {
    const ctx = cleanProdContext({ databaseChange: { hasRollbackOrDocumentedRecovery: false } });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).toContain("liquibase_requires_rollback_or_recovery");
  });

  it("comms_must_include_ticket_and_tag fires when comms missing ticket+tag", () => {
    const ctx = cleanProdContext({ comms: { lastSentIncludesTicketAndTag: false } });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).toContain("comms_must_include_ticket_and_tag");
  });

  it("last_minute_pr_requires_exception_approval fires when no exception is granted", () => {
    const ctx = cleanProdContext({
      lastMinutePr: { wasMergedAfterReadinessApproval: true, hasExceptionApproval: false },
    });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).toContain("last_minute_pr_requires_exception_approval");
  });

  it("last_minute_pr_requires_exception_approval does NOT fire when exception IS granted", () => {
    const ctx = cleanProdContext({
      lastMinutePr: { wasMergedAfterReadinessApproval: true, hasExceptionApproval: true },
    });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).not.toContain("last_minute_pr_requires_exception_approval");
  });

  it("cherry_pick_requires_final_commit_validation fires when validation is missing", () => {
    const ctx = cleanProdContext({ cherryPick: { hasFinalCommitValidation: false } });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).toContain("cherry_pick_requires_final_commit_validation");
  });

  it("runtime_config_outside_git_is_drift_risk fires when flag is set", () => {
    const ctx = cleanProdContext({ runtimeConfigOutsideGitDetected: true });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).toContain("runtime_config_outside_git_is_drift_risk");
  });

  it("actual_deploy_within_approved_window fires when actualDeployStart is before window", () => {
    const ctx = cleanProdContext({
      release: makeRelease({
        actualDeployStart: new Date("2026-06-01T20:00:00Z"), // before 22:00 window start
      }),
    });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).toContain("actual_deploy_within_approved_window");
  });

  it("actual_deploy_within_approved_window fires when actualDeployStart is after window", () => {
    const ctx = cleanProdContext({
      release: makeRelease({
        actualDeployStart: new Date("2026-06-02T00:00:00Z"), // after 23:30 window end
      }),
    });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).toContain("actual_deploy_within_approved_window");
  });

  it("actual_deploy_within_approved_window does NOT fire when actualDeployStart is null (not yet deployed)", () => {
    const ctx = cleanProdContext({ release: makeRelease({ actualDeployStart: null }) });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.violations.map((v) => v.ruleKey)).not.toContain("actual_deploy_within_approved_window");
  });
});

/* ──────────────────────────────────────────────────────────────────
   Verdict aggregation.
   ────────────────────────────────────────────────────────────── */

describe("evaluateReleasePolicy — verdict aggregation", () => {
  it("any blocking violation → verdict blocked", () => {
    const ctx = cleanProdContext({ release: makeRelease({ releaseTag: null }) });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.verdict).toBe("blocked");
    expect(result.summary.blocking).toBeGreaterThan(0);
  });

  it("only non-blocking violations → verdict warnings_only", () => {
    // ticket missing commit SHA is medium + non-blocking; everything else clean.
    const ctx = cleanProdContext({
      changeTicket: { id: "CHG-1", state: "approved", hasCommitSha: false, hasArtifactTag: true, hasRollbackPlan: true },
    });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.verdict).toBe("warnings_only");
    expect(result.summary.blocking).toBe(0);
    expect(result.summary.total).toBeGreaterThan(0);
  });

  it("summary.bySeverity buckets each violation by severity", () => {
    const ctx = cleanProdContext({
      release: makeRelease({ releaseTag: null, rollbackReferenceReleaseId: null }), // critical + high
      changeTicket: { id: "CHG-1", state: "approved", hasCommitSha: false, hasArtifactTag: true, hasRollbackPlan: true }, // medium
    });
    const result = evaluateReleasePolicy(defaultActiveRulesFromSeed(), ctx);
    expect(result.summary.bySeverity.critical).toBeGreaterThanOrEqual(1);
    expect(result.summary.bySeverity.high).toBeGreaterThanOrEqual(1);
    expect(result.summary.bySeverity.medium).toBeGreaterThanOrEqual(1);
  });
});

/* ──────────────────────────────────────────────────────────────────
   composeActiveRules — row → ActiveRule projection.
   ────────────────────────────────────────────────────────────── */

describe("composeActiveRules", () => {
  it("attaches the seed evaluator to a row whose key matches the seed catalog", () => {
    const row: ActiveRuleRow = {
      key: "prod_requires_release_tag",
      label: "Production deployment requires release tag",
      severity: "critical", blocking: true, exceptionAllowed: true,
      approverRole: "manager", evidenceRequired: true,
      autoRemediationKey: "create_release_tag", enabled: true,
    };
    const [rule] = composeActiveRules([row]);
    const verdict = rule.evaluate(cleanProdContext({ release: makeRelease({ releaseTag: null }) }));
    expect(verdict.violation).toBe(true);
  });

  it("attaches a no-op evaluator for an unknown rule key (seed/DB drift safety)", () => {
    const row: ActiveRuleRow = {
      key: "future_rule_we_have_not_shipped_yet",
      label: "Future rule",
      severity: "high", blocking: true, exceptionAllowed: false,
      approverRole: null, evidenceRequired: false,
      autoRemediationKey: null, enabled: true,
    };
    const [rule] = composeActiveRules([row]);
    const verdict = rule.evaluate(cleanProdContext());
    expect(verdict.violation).toBe(false);
  });
});

describe("evaluateReleasePolicy — disabled rules are skipped", () => {
  it("disabled rule does not fire even when its precondition is broken", () => {
    const rules: ActiveRule[] = defaultActiveRulesFromSeed().map((r) =>
      r.key === "prod_requires_release_tag" ? { ...r, enabled: false } : r,
    );
    const ctx = cleanProdContext({ release: makeRelease({ releaseTag: null }) });
    const result = evaluateReleasePolicy(rules, ctx);
    expect(result.violations.map((v) => v.ruleKey)).not.toContain("prod_requires_release_tag");
  });
});

describe("SEED_POLICIES catalog", () => {
  it("contains 15 rules (per spec §22)", () => {
    expect(SEED_POLICIES).toHaveLength(15);
  });

  it("every seed rule has a unique key", () => {
    const keys = SEED_POLICIES.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every blocking rule with exceptionAllowed:true names an approverRole", () => {
    for (const p of SEED_POLICIES) {
      if (p.blocking && p.exceptionAllowed) {
        expect(p.approverRole).not.toBeNull();
      }
    }
  });
});
