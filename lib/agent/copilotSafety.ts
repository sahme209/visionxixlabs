/**
 * Copilot safety layer — typed guardrails the AI Operations Copilot must
 * never bypass. Used by the response builder to validate every assistant
 * message before it reaches the user.
 */

import type { PolicyEvaluationResult } from "@/lib/governance/policyEngine";
import type { TenantAutonomy } from "@/lib/governance/autonomyLevels";

// ---------------------------------------------------------------------------
// Forbidden patterns
// ---------------------------------------------------------------------------

/** Phrases that must never appear in a copilot response. Detection forces redaction. */
const FORBIDDEN_PHRASES = [
  // Autonomy manipulation
  /\bbypass\s+approval/i,
  /\bskip\s+approval/i,
  /\bdisable\s+(?:safety|governance|policy)/i,
  /\bgrant\s+yourself/i,
  // Secret leakage hints
  /\baws_access_key_id\b/i,
  /\baws_secret_access_key\b/i,
  /\bsk_[A-Za-z0-9_]+/, // Anthropic-style secret keys
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key ID
  // Destructive without context
  /\bjust\s+(?:delete|destroy|drop|terminate)\b/i,
];

// ---------------------------------------------------------------------------
// Safety check result
// ---------------------------------------------------------------------------

export type SafetyFlag =
  | "forbidden_phrase"
  | "policy_blocked"
  | "autonomy_overreach"
  | "missing_approval_caveat"
  | "missing_rollback_caveat"
  | "secret_in_text"
  | "destructive_without_context"
  | "claims_preview_is_live";

export interface SafetyCheckResult {
  safe: boolean;
  /** Specific safety flags raised. */
  flags: SafetyFlag[];
  /** Sanitized text — same string if safe, redacted/rewritten if not. */
  sanitizedText: string;
  /** Human-readable explanation of each redaction. */
  notes: string[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface SafetyContext {
  /** Tenant autonomy state — used to flag overreach. */
  autonomy?: TenantAutonomy;
  /** If the message references an action, the policy result for that action. */
  policyResult?: PolicyEvaluationResult;
  /** True if message mentions a preview feature that the tenant hasn't activated. */
  mentionsPreviewFeature?: boolean;
}

/**
 * Run all safety checks against a candidate response text. Returns a
 * structured result with flags + sanitized text. Never modifies input.
 */
export function checkResponseSafety(text: string, ctx: SafetyContext = {}): SafetyCheckResult {
  const flags: SafetyFlag[] = [];
  const notes: string[] = [];
  let sanitized = text;

  // Forbidden phrases
  for (const pattern of FORBIDDEN_PHRASES) {
    if (pattern.test(text)) {
      flags.push("forbidden_phrase");
      sanitized = sanitized.replace(pattern, "[redacted by safety policy]");
      notes.push(`Removed phrase matching ${pattern.source}`);
    }
  }

  // Secret-like tokens — additional belt-and-braces check
  const secretPattern = /\b(?:[A-Za-z0-9_-]{32,}|sk_[a-zA-Z0-9_]+|AKIA[0-9A-Z]{16})\b/g;
  if (secretPattern.test(text)) {
    flags.push("secret_in_text");
    sanitized = sanitized.replace(secretPattern, "[redacted]");
    notes.push("Removed token matching secret-like pattern");
  }

  // Policy-blocked action mentioned without caveats
  if (ctx.policyResult?.blocked && !/blocked|approval required|cannot proceed/i.test(text)) {
    flags.push("policy_blocked");
    sanitized = sanitized + "\n\n_Note: this action is currently blocked by governance policy. " + ctx.policyResult.reason + "_";
    notes.push("Appended policy-blocked caveat");
  }

  // Approval required — must mention
  if (ctx.policyResult?.approvalRequired && !/approval|approver|review/i.test(text)) {
    flags.push("missing_approval_caveat");
    sanitized = sanitized + "\n\n_Note: this action requires approval before it can be applied._";
    notes.push("Appended approval requirement caveat");
  }

  // Rollback required — must mention
  if (ctx.policyResult?.rollbackRequired && !/rollback|revert|restore/i.test(text)) {
    flags.push("missing_rollback_caveat");
    sanitized = sanitized + "\n\n_Note: a verified rollback plan is required before this can apply._";
    notes.push("Appended rollback requirement caveat");
  }

  // Autonomy overreach — message claims an action when autonomy doesn't permit it
  if (ctx.autonomy && ctx.policyResult && !ctx.policyResult.withinAutonomyCeiling) {
    flags.push("autonomy_overreach");
    sanitized = sanitized + `\n\n_Note: this action exceeds the tenant's current autonomy level (Level ${ctx.autonomy.level}). Admin opt-in required to raise the level._`;
    notes.push("Appended autonomy-ceiling caveat");
  }

  // Preview feature presented as live
  if (ctx.mentionsPreviewFeature && /\b(?:available|ready|live|production)\b/i.test(text) && !/(preview|early-access|not yet|coming)/i.test(text)) {
    flags.push("claims_preview_is_live");
    sanitized = sanitized + "\n\n_Note: this capability is currently in preview/early-access — not yet generally available._";
    notes.push("Appended preview-state caveat");
  }

  return {
    safe: flags.length === 0,
    flags,
    sanitizedText: sanitized,
    notes,
  };
}

/**
 * Strip context fields that should never reach external AI providers.
 * Use as a defensive layer before any outbound LLM call.
 */
export function redactForExternalLlm<T extends Record<string, unknown>>(payload: T): T {
  const FORBIDDEN_KEYS = new Set([
    "access_key", "accessKey", "aws_access_key_id", "AWS_ACCESS_KEY_ID",
    "secret_key", "secretKey", "aws_secret_access_key", "AWS_SECRET_ACCESS_KEY",
    "session_token", "sessionToken",
    "password", "passphrase",
    "api_key", "apiKey",
    "private_key", "privateKey",
    "client_secret", "clientSecret",
  ]);

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (FORBIDDEN_KEYS.has(k)) {
      out[k] = "[redacted]";
    } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      out[k] = redactForExternalLlm(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
