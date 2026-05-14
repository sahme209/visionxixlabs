/**
 * Copilot security guard rails.
 *
 * The platform already has `lib/agent/copilotSafety.ts` (forbidden-phrase regex
 * and external-LLM redaction). This module is the *outbound* and *inbound*
 * security envelope around any copilot interaction:
 *
 *   inbound:  classifyUserIntent() — flag risky asks before reasoning
 *   outbound: enforceResponseGuardrails() — sanitize what the model says back
 *
 * The classifier is intentionally conservative — when the user is asking
 * something that could escalate privilege or extract credentials, we
 * downgrade autonomy and append explicit boundary text.
 */

import { redact } from "@/lib/security/redaction";

// ---------------------------------------------------------------------------
// Intent classification
// ---------------------------------------------------------------------------

export type CopilotRiskClass =
  | "informational"        // safe — read-only knowledge
  | "operational_read"     // read of operational data — fine
  | "operational_change"   // user wants something changed — require approval flow
  | "credential_query"     // user is asking about credentials — hard limit
  | "privilege_escalation" // user is asking to bypass policy/approval — hard block
  | "audit_query"          // user wants audit data — require permission
  | "unknown";

export interface CopilotIntent {
  risk: CopilotRiskClass;
  /** Why this risk class was assigned — used in audit trail. */
  reason: string;
  /** Whether the request should be blocked outright. */
  block: boolean;
}

const ESCALATION_PATTERNS = [
  /bypass\s+(approval|policy|governance|review|two[\s-]?factor)/i,
  /disable\s+(audit|logging|approval)/i,
  /turn\s+off\s+(policy|audit|approval|guardrails?)/i,
  /(give|grant)\s+me\s+(admin|owner)/i,
  /elevate\s+my\s+(role|access|privileges?)/i,
  /skip\s+(review|approval)/i,
  /(jailbreak|ignore\s+previous\s+instructions)/i,
];

const CREDENTIAL_PATTERNS = [
  /(show|reveal|print|dump|export)\s+(my\s+)?(secret|password|token|api[\s_-]?key|credential)/i,
  /what(?:'s| is)\s+(my|the)\s+(secret|password|token|api[\s_-]?key|credential)/i,
];

const CHANGE_PATTERNS = [
  /(delete|destroy|terminate|deprovision|tear[\s-]?down)\s+/i,
  /(open|expose|make\s+public)\s+/i,
  /(disable|remove)\s+(firewall|security\s+group|encryption|mfa)/i,
  /grant\s+.*\s+access\s+to/i,
];

const AUDIT_PATTERNS = [
  /(audit\s+log|audit\s+trail|who\s+(did|approved|executed))/i,
];

export function classifyCopilotIntent(input: string): CopilotIntent {
  if (!input || typeof input !== "string") return { risk: "unknown", reason: "empty input", block: false };
  for (const p of ESCALATION_PATTERNS) {
    if (p.test(input)) return { risk: "privilege_escalation", reason: `Matched escalation pattern: ${p}`, block: true };
  }
  for (const p of CREDENTIAL_PATTERNS) {
    if (p.test(input)) return { risk: "credential_query", reason: `Matched credential-query pattern: ${p}`, block: true };
  }
  for (const p of CHANGE_PATTERNS) {
    if (p.test(input)) return { risk: "operational_change", reason: `Matched change pattern: ${p}`, block: false };
  }
  for (const p of AUDIT_PATTERNS) {
    if (p.test(input)) return { risk: "audit_query", reason: `Matched audit pattern: ${p}`, block: false };
  }
  return { risk: "informational", reason: "no risky pattern matched", block: false };
}

// ---------------------------------------------------------------------------
// Outbound guardrail
// ---------------------------------------------------------------------------

const FORBIDDEN_RESPONSE_PHRASES = [
  /\bI('ll| will)\s+execute\b/i,
  /\bI('ve| have)\s+(deleted|terminated|removed)\b/i,
  /\bI bypassed\b/i,
  /\bdisabled the audit log\b/i,
];

export interface ResponseGuardOutcome {
  text: string;
  /** Whether the response was modified by the guardrail. */
  modified: boolean;
  /** Detected violations (patterns matched). */
  violations: string[];
}

/**
 * Sanitize a copilot response before returning to the user:
 *  - run redaction in case the model leaked a value the upstream sanitizer missed
 *  - strip phrases that claim execution happened
 *  - prepend a preview banner when source is not "live"
 */
export function enforceResponseGuardrails(text: string, opts: { source: "live" | "preview" | "demo" }): ResponseGuardOutcome {
  let out = redact(text);
  const violations: string[] = [];
  for (const p of FORBIDDEN_RESPONSE_PHRASES) {
    if (p.test(out)) {
      violations.push(p.source);
      out = out.replace(p, "[REDACTED — Axiom never claims actions were executed without approval]");
    }
  }
  let modified = out !== text;
  if (opts.source !== "live") {
    const banner = opts.source === "preview"
      ? "Note: I'm reasoning over preview data — results aren't from a live connector."
      : "Note: I'm reasoning over demo data — illustrative only.";
    out = `${banner}\n\n${out}`;
    modified = true;
  }
  return { text: out, modified, violations };
}
