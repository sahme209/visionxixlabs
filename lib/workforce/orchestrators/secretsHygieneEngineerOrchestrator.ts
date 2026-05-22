/**
 * Secrets Hygiene Engineer — runtime-gated orchestrator.
 *
 * Wraps `scanForSecrets()`. Two distinct gated actions:
 *   - planAndRequestSecretRotation   → action: "rotate_secret", risk: critical
 *   - planAndRequestSecretQuarantine → action: "quarantine_file", risk: high
 *
 * Both pass through `recordEngineerActionAttempt` so live rotations
 * can never auto-fire — they always require two-step approval at the
 * critical-risk floor.
 */

import "server-only";

import { scanForSecrets, type ScanOptions, type ScanResult, type SecretFinding } from "@/lib/agents/secretsHygieneScanner";
import { recordEngineerActionAttempt } from "@/lib/workforce/engineerActionRecorder";
import type { ActionVerdict, ActionRiskLevel } from "@/lib/workforce/runtimeActionGate";

const ENGINEER_ID = "secrets_hygiene_engineer";

export interface RotateInput {
  workspaceId: string;
  requestedBy: string;
  /** Raw text scanned (will be redacted before audit storage). */
  input: string;
  options?: ScanOptions;
  /** Caller picks a specific finding to act on — by (kind, line, column). */
  selector: { kind: SecretFinding["kind"]; line: number; column: number };
  connector?: "github" | "aws" | "azure" | "gcp" | "vault";
  correlationId?: string;
}

export type RotateResult =
  | { ok: false; reason: "finding_not_found"; scan: ScanResult }
  | { ok: true; finding: SecretFinding; verdict: ActionVerdict; attemptId: string; correlationId: string; approvalRequestId?: string };

function findingMatchesSelector(f: SecretFinding, sel: RotateInput["selector"]) {
  return f.kind === sel.kind && f.line === sel.line && f.column === sel.column;
}

function riskFor(finding: SecretFinding): ActionRiskLevel {
  switch (finding.severity) {
    case "critical": return "critical";
    case "high":     return "high";
    case "warn":     return "medium";
    case "info":     return "low";
  }
}

export async function planAndRequestSecretRotation(input: RotateInput): Promise<RotateResult> {
  const scan = scanForSecrets(input.input, input.options);
  const finding = scan.findings.find((f) => findingMatchesSelector(f, input.selector));
  if (!finding) return { ok: false, reason: "finding_not_found", scan };

  const recorded = await recordEngineerActionAttempt({
    workspaceId: input.workspaceId,
    engineerId: ENGINEER_ID,
    action: `rotate_secret:${finding.kind}`,
    riskLevel: riskFor(finding),
    isReadOnly: false,
    module: "security",
    connector: input.connector ?? "github",
    requestedBy: input.requestedBy,
    correlationId: input.correlationId,
    metadata: {
      kind: finding.kind,
      severity: finding.severity,
      line: finding.line,
      column: finding.column,
      recommendation: finding.recommendedAction.kind,
    },
  });
  return {
    ok: true,
    finding,
    verdict: recorded.verdict,
    attemptId: recorded.attemptId,
    correlationId: recorded.correlationId,
    approvalRequestId: recorded.approvalRequestId,
  };
}

export async function planAndRequestSecretQuarantine(input: RotateInput): Promise<RotateResult> {
  const scan = scanForSecrets(input.input, input.options);
  const finding = scan.findings.find((f) => findingMatchesSelector(f, input.selector));
  if (!finding) return { ok: false, reason: "finding_not_found", scan };

  const recorded = await recordEngineerActionAttempt({
    workspaceId: input.workspaceId,
    engineerId: ENGINEER_ID,
    action: `quarantine_file:${finding.kind}`,
    riskLevel: "high",
    isReadOnly: false,
    module: "security",
    connector: input.connector ?? "github",
    requestedBy: input.requestedBy,
    correlationId: input.correlationId,
    metadata: { kind: finding.kind, severity: finding.severity, line: finding.line, column: finding.column },
  });
  return {
    ok: true,
    finding,
    verdict: recorded.verdict,
    attemptId: recorded.attemptId,
    correlationId: recorded.correlationId,
    approvalRequestId: recorded.approvalRequestId,
  };
}
