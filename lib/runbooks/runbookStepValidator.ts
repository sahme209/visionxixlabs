/**
 * Pure runbook step validator.
 *
 * Operators (or agents) propose runbook YAML/JSON with a list of
 * steps. This module flags forbidden patterns BEFORE the runbook
 * lands in review:
 *   - shell:rm -rf / patterns
 *   - aws iam delete-* without manual gate
 *   - direct "apply" / "execute" verbs (must be "stage")
 *   - missing operator-gate step at the end
 *
 * Pure / deterministic. The runbook DSL is intentionally small so the
 * validator can stay strict.
 */

export type RunbookStepKind = "stage" | "notify" | "audit" | "operator_gate" | "verify";

export interface ProposedRunbookStep {
  kind: RunbookStepKind;
  /** Short operator-readable summary. */
  label: string;
  /** Full body — shell commands, IaC fragments, etc. */
  body: string;
}

export interface RunbookValidation {
  valid: boolean;
  warnings: string[];
  errors: string[];
  /** Severity ladder. */
  severity: "ok" | "warn" | "fail";
}

const FORBIDDEN_PATTERNS: ReadonlyArray<{ re: RegExp; reason: string }> = [
  { re: /\brm\s+-rf\s+\//, reason: "destructive 'rm -rf /' pattern in step body" },
  { re: /\baws\s+iam\s+delete[-_]/i, reason: "direct aws iam delete-* call — must go through operator_gate" },
  { re: /\bterraform\s+(destroy|apply)\b/i, reason: "terraform destroy/apply must be staged, not executed in the runbook body" },
  { re: /\bkubectl\s+delete\s+(ns|namespace)\b/i, reason: "kubectl delete namespace is destructive — operator_gate required" },
  { re: /\bDROP\s+(TABLE|DATABASE)\b/i, reason: "SQL DROP statement in runbook body" },
];

const BAD_VERBS = [
  { re: /\bauto[-_ ]apply\b/i, reason: "runbook body must say 'stage' / 'propose', not 'auto-apply'" },
  { re: /\bauto[-_ ]execute\b/i, reason: "runbook body must say 'stage' / 'propose', not 'auto-execute'" },
];

export function validateRunbookSteps(steps: readonly ProposedRunbookStep[]): RunbookValidation {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (steps.length === 0) {
    return { valid: false, warnings: [], errors: ["runbook has zero steps"], severity: "fail" };
  }

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    for (const { re, reason } of FORBIDDEN_PATTERNS) {
      if (re.test(s.body)) errors.push(`step ${i + 1} (${s.kind}): ${reason}`);
    }
    for (const { re, reason } of BAD_VERBS) {
      if (re.test(s.body) || re.test(s.label)) warnings.push(`step ${i + 1} (${s.kind}): ${reason}`);
    }
  }

  // Operator-gate must appear at least once.
  if (!steps.some((s) => s.kind === "operator_gate")) {
    errors.push("runbook missing required 'operator_gate' step (approval_only_no_execution)");
  }

  // Audit step strongly recommended at the end.
  if (steps[steps.length - 1].kind !== "audit") {
    warnings.push("runbook does not end with an 'audit' step — auditor-readability suffers");
  }

  const severity: RunbookValidation["severity"] =
    errors.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "ok";

  return { valid: errors.length === 0, warnings, errors, severity };
}
