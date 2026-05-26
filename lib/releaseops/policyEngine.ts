/**
 * Phase 443 — policy evaluation engine.
 *
 * Pure function. Given a set of active rules (the runtime view of
 * PolicyRule rows, potentially with org-specific overrides applied)
 * and a release context, produces a structured verdict:
 *
 *   verdict = clean | warnings_only | blocked
 *   violations[] with severity / blocking / exception model
 *
 * No I/O, no Prisma. The repository wrapper persists violations to
 * PolicyViolation rows; this kernel doesn't know about the DB.
 */

import {
  SEED_POLICY_BY_KEY,
  SEED_POLICIES,
  type PolicyEvaluationContext,
  type PolicyRuleSeed,
  type PolicySeverity,
} from "./policies/seed";

/* ──────────────────────────────────────────────────────────────────
   Active-rule shape — what the engine receives at runtime. Reflects
   the PolicyRule row plus the lookup'd evaluator function.
   ────────────────────────────────────────────────────────────── */

export interface ActiveRule {
  key: string;
  label: string;
  severity: PolicySeverity;
  blocking: boolean;
  exceptionAllowed: boolean;
  approverRole: string | null;
  evidenceRequired: boolean;
  autoRemediationKey: string | null;
  enabled: boolean;
  /** Evaluator from the seed catalog. If absent, the rule is unknown and skipped. */
  evaluate: PolicyRuleSeed["evaluate"];
}

/* ──────────────────────────────────────────────────────────────────
   Verdict shapes.
   ────────────────────────────────────────────────────────────── */

export type EngineVerdict = "clean" | "warnings_only" | "blocked";

export interface PolicyViolationDetail {
  ruleKey: string;
  ruleLabel: string;
  severity: PolicySeverity;
  blocking: boolean;
  exceptionAllowed: boolean;
  approverRole: string | null;
  evidenceRequired: boolean;
  message: string;
  remediation?: string;
  autoRemediationKey: string | null;
}

export interface EngineResult {
  verdict: EngineVerdict;
  violations: PolicyViolationDetail[];
  summary: {
    total: number;
    blocking: number;
    bySeverity: Record<PolicySeverity, number>;
    ignoredUnknownRules: number;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export function evaluateReleasePolicy(
  rules: ReadonlyArray<ActiveRule>,
  ctx: PolicyEvaluationContext,
): EngineResult {
  const violations: PolicyViolationDetail[] = [];
  let ignoredUnknownRules = 0;
  const bySeverity: Record<PolicySeverity, number> = { low: 0, medium: 0, high: 0, critical: 0 };

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!rule.evaluate) { ignoredUnknownRules += 1; continue; }
    const result = rule.evaluate(ctx);
    if (!result.violation) continue;
    violations.push({
      ruleKey: rule.key,
      ruleLabel: rule.label,
      severity: rule.severity,
      blocking: rule.blocking,
      exceptionAllowed: rule.exceptionAllowed,
      approverRole: rule.approverRole,
      evidenceRequired: rule.evidenceRequired,
      message: result.message,
      remediation: result.remediation,
      autoRemediationKey: rule.autoRemediationKey,
    });
    bySeverity[rule.severity] += 1;
  }

  const blockingCount = violations.filter((v) => v.blocking).length;
  const verdict: EngineVerdict =
    blockingCount > 0 ? "blocked" :
    violations.length > 0 ? "warnings_only" :
    "clean";

  return {
    verdict,
    violations,
    summary: {
      total: violations.length,
      blocking: blockingCount,
      bySeverity,
      ignoredUnknownRules,
    },
  };
}

/**
 * Composes a runtime ActiveRule list from a row set (e.g. PolicyRule
 * rows from the DB) by joining each row with its evaluator from the
 * seed catalog. Rows whose key isn't in the seed are returned with a
 * no-op evaluator that always passes — the engine counts them as
 * "ignored" via the seed-lookup, surfacing the seed/DB drift.
 */
export function composeActiveRules(rows: ReadonlyArray<ActiveRuleRow>): ActiveRule[] {
  return rows.map((row) => {
    const seed = SEED_POLICY_BY_KEY.get(row.key);
    return {
      key: row.key,
      label: row.label,
      severity: row.severity,
      blocking: row.blocking,
      exceptionAllowed: row.exceptionAllowed,
      approverRole: row.approverRole,
      evidenceRequired: row.evidenceRequired,
      autoRemediationKey: row.autoRemediationKey,
      enabled: row.enabled,
      evaluate: seed ? seed.evaluate : () => ({ violation: false }),
    };
  });
}

/**
 * Shortcut: return the full seed catalog ready to evaluate. Useful
 * when the caller hasn't persisted PolicyRule rows yet (Phase 443
 * runtime before the Phase 450 migration).
 */
export function defaultActiveRulesFromSeed(): ActiveRule[] {
  return SEED_POLICIES.map((p) => ({
    key: p.key,
    label: p.label,
    severity: p.severity,
    blocking: p.blocking,
    exceptionAllowed: p.exceptionAllowed,
    approverRole: p.approverRole,
    evidenceRequired: p.evidenceRequired,
    autoRemediationKey: p.autoRemediationKey,
    enabled: true,
    evaluate: p.evaluate,
  }));
}

/* ──────────────────────────────────────────────────────────────────
   Row shape consumed by composeActiveRules — mirrors PolicyRule
   columns without depending on Prisma types.
   ────────────────────────────────────────────────────────────── */

export interface ActiveRuleRow {
  key: string;
  label: string;
  severity: PolicySeverity;
  blocking: boolean;
  exceptionAllowed: boolean;
  approverRole: string | null;
  evidenceRequired: boolean;
  autoRemediationKey: string | null;
  enabled: boolean;
}
