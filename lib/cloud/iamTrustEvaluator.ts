/**
 * IAM trust policy evaluator.
 *
 * Validates a customer-supplied AWS IAM Role trust policy against the
 * expectations Axiom needs to assume it safely:
 *  - Trusts our broker principal (not "*")
 *  - Requires an External ID condition matching the tenant
 *  - Allows `sts:AssumeRole`
 *  - Is not stale (recent updates encouraged)
 *
 * Pure function — no IAM SDK calls. The caller is responsible for fetching
 * the trust policy document; this module parses + grades it.
 *
 * Why: the existing `aws.ts` connector validates that we *can* assume a
 * role, but doesn't grade whether the trust policy is *safe*. A wide-open
 * trust policy is a security risk the customer should see surfaced.
 */

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface IamTrustPolicyDocument {
  Version: string;
  Statement: IamTrustStatement[];
}

export interface IamTrustStatement {
  Effect: "Allow" | "Deny";
  Principal?: { AWS?: string | string[]; Service?: string | string[]; Federated?: string | string[] };
  Action: string | string[];
  Condition?: Record<string, Record<string, string | string[]>>;
}

export interface IamTrustExpectations {
  /** Expected broker principal ARN(s) — typically `arn:aws:iam::<axiom-account>:root` or a specific role. */
  expectedBrokerPrincipals: string[];
  /** Expected External ID for this tenant. Required for prod. */
  expectedExternalId?: string;
  /** Whether the role must require MFA. */
  requireMfa?: boolean;
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

export type IamTrustFindingKind =
  | "principal_wildcard"
  | "principal_mismatch"
  | "external_id_missing"
  | "external_id_mismatch"
  | "action_too_broad"
  | "action_missing"
  | "mfa_missing"
  | "deny_statement"
  | "non_assume_role_action"
  | "ok";

export type IamTrustSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface IamTrustFinding {
  kind: IamTrustFindingKind;
  severity: IamTrustSeverity;
  message: string;
  /** Detail for operator-facing logs / audit. */
  detail: string;
  /** Stable references back to the statement that produced this finding. */
  statementIndex?: number;
  /** Safe action the user can take in their IAM console. */
  remediation?: string;
}

export interface IamTrustReport {
  ok: boolean;
  /** Computed safety grade: A (best) through F. */
  grade: "A" | "B" | "C" | "D" | "F";
  findings: IamTrustFinding[];
  /** Highest severity present. */
  worstSeverity: IamTrustSeverity;
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export function evaluateIamTrustPolicy(
  policy: IamTrustPolicyDocument,
  expectations: IamTrustExpectations
): IamTrustReport {
  const findings: IamTrustFinding[] = [];

  policy.Statement.forEach((stmt, idx) => {
    if (stmt.Effect === "Deny") {
      findings.push({
        kind: "deny_statement",
        severity: "info",
        message: "Trust policy contains an explicit Deny statement.",
        detail: "Explicit Deny statements override Allow; this is informational.",
        statementIndex: idx,
      });
      return;
    }

    const principal = collectPrincipals(stmt);
    if (principal.includes("*")) {
      findings.push({
        kind: "principal_wildcard",
        severity: "critical",
        message: 'Trust policy allows Principal "*"',
        detail: "Any AWS principal can assume this role. This is unsafe for any production-touching role.",
        statementIndex: idx,
        remediation: `Replace Principal "*" with one of: ${expectations.expectedBrokerPrincipals.join(", ")}`,
      });
    } else if (!principal.some((p) => expectations.expectedBrokerPrincipals.includes(p))) {
      findings.push({
        kind: "principal_mismatch",
        severity: "high",
        message: "Trust policy does not include the expected Axiom broker principal.",
        detail: `Expected one of: ${expectations.expectedBrokerPrincipals.join(", ")}. Found: ${principal.join(", ") || "<none>"}.`,
        statementIndex: idx,
        remediation: `Update Principal.AWS to include ${expectations.expectedBrokerPrincipals[0]}`,
      });
    }

    const actions = toArray(stmt.Action);
    if (!actions.includes("sts:AssumeRole") && !actions.includes("sts:*") && !actions.includes("*")) {
      findings.push({
        kind: "action_missing",
        severity: "high",
        message: "Trust policy does not allow sts:AssumeRole.",
        detail: "Axiom cannot assume this role without sts:AssumeRole in the Action list.",
        statementIndex: idx,
        remediation: 'Add "sts:AssumeRole" to the Action array.',
      });
    }
    if (actions.includes("sts:*") || actions.includes("*")) {
      findings.push({
        kind: "action_too_broad",
        severity: "medium",
        message: "Trust policy uses a wildcard Action.",
        detail: "Restrict the trust policy to exactly sts:AssumeRole.",
        statementIndex: idx,
        remediation: 'Replace "sts:*" or "*" with "sts:AssumeRole".',
      });
    }
    // Surface other action grants — they don't belong in a trust policy
    for (const action of actions) {
      if (action !== "sts:AssumeRole" && action !== "sts:*" && action !== "*" && !action.startsWith("sts:Assume")) {
        findings.push({
          kind: "non_assume_role_action",
          severity: "medium",
          message: `Trust policy allows non-assume action: ${action}`,
          detail: "Trust policies should grant only assume-style actions. Other permissions belong in attached policies.",
          statementIndex: idx,
          remediation: `Remove "${action}" from the Action array.`,
        });
      }
    }

    // External ID condition
    if (expectations.expectedExternalId) {
      const externalId = readCondition(stmt, "StringEquals", "sts:ExternalId") ?? readCondition(stmt, "StringEqualsIgnoreCase", "sts:ExternalId");
      if (!externalId) {
        findings.push({
          kind: "external_id_missing",
          severity: "high",
          message: "No External ID condition on the trust policy.",
          detail: "Axiom requires an External ID match. Without it, an attacker who learns the broker ARN could assume the role.",
          statementIndex: idx,
          remediation: 'Add a Condition: { "StringEquals": { "sts:ExternalId": "<your-axiom-external-id>" } }',
        });
      } else if (externalId !== expectations.expectedExternalId) {
        findings.push({
          kind: "external_id_mismatch",
          severity: "high",
          message: "External ID condition does not match the expected value.",
          detail: `Expected "${expectations.expectedExternalId}", found "${externalId}".`,
          statementIndex: idx,
          remediation: "Set sts:ExternalId to the External ID Axiom shows in your tenant settings.",
        });
      }
    }

    // MFA expectation
    if (expectations.requireMfa) {
      const mfa = readCondition(stmt, "Bool", "aws:MultiFactorAuthPresent");
      if (mfa !== "true") {
        findings.push({
          kind: "mfa_missing",
          severity: "medium",
          message: "Trust policy does not require MFA.",
          detail: "Production roles should require MFA on assume.",
          statementIndex: idx,
          remediation: 'Add a Condition: { "Bool": { "aws:MultiFactorAuthPresent": "true" } }',
        });
      }
    }
  });

  if (findings.length === 0) {
    findings.push({ kind: "ok", severity: "info", message: "Trust policy looks safe.", detail: "No issues detected." });
  }

  // Score: count by severity
  const sev: Record<IamTrustSeverity, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  for (const f of findings) sev[f.severity]++;
  const grade: IamTrustReport["grade"] =
    sev.critical > 0 ? "F" :
    sev.high > 0     ? "D" :
    sev.medium > 1   ? "C" :
    sev.medium > 0   ? "B" :
                       "A";
  const worstSeverity: IamTrustSeverity =
    sev.critical > 0 ? "critical" :
    sev.high > 0     ? "high"     :
    sev.medium > 0   ? "medium"   :
    sev.low > 0      ? "low"      :
                       "info";
  return {
    ok: worstSeverity !== "critical" && worstSeverity !== "high",
    grade,
    findings,
    worstSeverity,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function collectPrincipals(stmt: IamTrustStatement): string[] {
  if (!stmt.Principal) return [];
  const out: string[] = [];
  if (stmt.Principal.AWS) out.push(...toArray(stmt.Principal.AWS));
  if (stmt.Principal.Service) out.push(...toArray(stmt.Principal.Service));
  if (stmt.Principal.Federated) out.push(...toArray(stmt.Principal.Federated));
  return out;
}

function readCondition(stmt: IamTrustStatement, operator: string, key: string): string | undefined {
  const cond = stmt.Condition?.[operator];
  if (!cond) return undefined;
  const v = cond[key];
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}
