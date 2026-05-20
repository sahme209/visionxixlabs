/**
 * Production env validator.
 *
 * Pure-function check that the current process.env has the
 * minimum-viable set of variables for a production deployment.
 * Designed to run in CI (or at boot) BEFORE the autonomy scheduler
 * starts processing, so misconfig surfaces as a clear list instead
 * of one runtime crash at a time.
 *
 * Hard rules:
 *   - Pure: reads process.env, returns a typed report.
 *   - Per-rule severity: required (deploy is broken) vs recommended
 *     (degraded operation but boots).
 *   - Never logs the value — only presence + length-hash signal.
 *   - The autonomy loop, dashboards, and dev mode keep working even
 *     when the report has 'fail' rules. This is an early-warning,
 *     not an enforcement gate.
 */

import { createHash } from "node:crypto";

export type EnvRuleSeverity = "required" | "recommended";

export interface EnvRuleReport {
  key: string;
  severity: EnvRuleSeverity;
  pass: boolean;
  /** Why this rule exists. */
  rationale: string;
  /** Short hint when failed. */
  hint: string;
  /** 8-char hash of the value (presence + uniqueness signal without leaking the value). */
  valueHash?: string;
}

export interface EnvValidationReport {
  generatedAt: string;
  pass: boolean;
  requiredFailures: number;
  recommendedFailures: number;
  passed: number;
  rules: EnvRuleReport[];
}

interface RuleDefinition {
  key: string;
  severity: EnvRuleSeverity;
  rationale: string;
  hint: string;
  /** Custom predicate. Default: present + non-empty. */
  check?: (value: string | undefined) => boolean;
}

const RULES: RuleDefinition[] = [
  {
    key: "DATABASE_URL",
    severity: "required",
    rationale: "Prisma needs a Postgres URL to persist rationale, runbooks, billing.",
    hint: "Set DATABASE_URL to a postgres:// connection string.",
  },
  {
    key: "NEXTAUTH_SECRET",
    severity: "required",
    rationale: "NextAuth signs the session cookie with this secret.",
    hint: "Generate with `openssl rand -hex 32` and set NEXTAUTH_SECRET.",
    check: (v) => Boolean(v && v.length >= 32),
  },
  {
    key: "NEXTAUTH_URL",
    severity: "required",
    rationale: "NextAuth callback URLs need the canonical site origin.",
    hint: "Set NEXTAUTH_URL to https://<your-host> (no trailing slash).",
    check: (v) => Boolean(v && /^https?:\/\//.test(v)),
  },
  {
    key: "CRON_SECRET",
    severity: "required",
    rationale: "Every cron route validates Bearer ${CRON_SECRET}.",
    hint: "Generate with `openssl rand -hex 32` and set CRON_SECRET.",
    check: (v) => Boolean(v && v.length >= 16),
  },
  {
    key: "AUTONOMY_SCHEDULER_ENABLED",
    severity: "recommended",
    rationale: "When unset, the */15 scheduler refuses to run unattended.",
    hint: "Set AUTONOMY_SCHEDULER_ENABLED=true once you've verified observer mode is desired by default.",
  },
  {
    key: "AUTONOMY_SCHEDULER_TENANTS",
    severity: "recommended",
    rationale: "Cron routes loop over this comma-separated list. Empty = nothing runs.",
    hint: "Set AUTONOMY_SCHEDULER_TENANTS=ws_<sha-prefix>,ws_<sha-prefix>...",
  },
  {
    key: "SLACK_WEBHOOK_URL",
    severity: "recommended",
    rationale: "Without an outbound channel, autonomy halts + critical signals never reach humans.",
    hint: "Set SLACK_WEBHOOK_URL or TEAMS_WEBHOOK_URL (or both).",
    check: (v) => Boolean(v && /^https?:\/\/hooks\.slack\.com\//.test(v)),
  },
  {
    key: "ADMIN_EMAILS",
    severity: "recommended",
    rationale: "Cross-tenant /dashboard/admin-* surfaces require this set.",
    hint: "Set ADMIN_EMAILS=ops@yourdomain.com,founder@yourdomain.com",
  },
  {
    key: "STRIPE_SECRET_KEY",
    severity: "recommended",
    rationale: "Without a Stripe key, the upgrade flow stays gracefully inert.",
    hint: "Set STRIPE_SECRET_KEY once your Stripe products + prices exist.",
    check: (v) => Boolean(v && /^sk_(test|live)_/.test(v)),
  },
  {
    key: "FIELD_ENCRYPTION_KEY",
    severity: "recommended",
    rationale: "Rationale + halt-reason blobs persist plaintext without this.",
    hint: "Generate 32 random bytes (`openssl rand -hex 32`) and set FIELD_ENCRYPTION_KEY.",
    check: (v) => Boolean(v && v.length >= 16),
  },
];

export function validateProductionEnv(env: NodeJS.ProcessEnv = process.env): EnvValidationReport {
  const rules: EnvRuleReport[] = RULES.map((rule) => {
    const value = env[rule.key]?.trim();
    const check = rule.check ?? ((v: string | undefined) => Boolean(v && v.length > 0));
    const pass = check(value);
    return {
      key: rule.key,
      severity: rule.severity,
      pass,
      rationale: rule.rationale,
      hint: rule.hint,
      valueHash: value ? createHash("sha256").update(value).digest("hex").slice(0, 8) : undefined,
    };
  });

  const requiredFailures = rules.filter((r) => !r.pass && r.severity === "required").length;
  const recommendedFailures = rules.filter((r) => !r.pass && r.severity === "recommended").length;
  const passed = rules.filter((r) => r.pass).length;

  return {
    generatedAt: new Date().toISOString(),
    pass: requiredFailures === 0,
    requiredFailures,
    recommendedFailures,
    passed,
    rules,
  };
}
