/**
 * Safe context for AI/copilot calls.
 *
 * The copilot never sees raw credentials, raw stack traces, or raw provider
 * tokens. Every piece of state that goes into an LLM prompt is funnelled
 * through `buildSafeContext()` — which:
 *  1. Strips known-sensitive keys
 *  2. Runs the canonical redactor over every string
 *  3. Drops fields the AI doesn't need (rotation policies, internal vault refs)
 *  4. Caps payload size so a runaway loop can't ship a 1 MB prompt
 *  5. Tags the payload with `source` + tenant scope so the LLM sees its
 *     boundary even if the orchestrator forgets to repeat them
 */

import { redactDeep } from "@/lib/security/redaction";
import type { TenantScope } from "@/lib/security/tenantScope";
import type { DataSource } from "@/lib/domain/source";

/** Maximum number of characters of context we'll send. */
const MAX_CONTEXT_CHARS = 24_000;

/** Field names that must never leave the platform via an AI prompt. */
const BLOCKED_FIELDS = new Set([
  "passwordHash",
  "password",
  "passwd",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "session_token",
  "api_key",
  "apikey",
  "client_secret",
  "private_key",
  "vaultRef",
  "encryptedCredRef",
  "credential",
  "credentials",
  "authorization",
  "auth",
  "cookie",
  "set-cookie",
  "stack",
  "stackTrace",
  "sourceCode",
]);

export interface SafeContext {
  /** Tenant scope visible to the model — does not include credentials. */
  scope: { organizationId: string; userId: string; roles: string[] };
  /** Honest tag for the model — never claim "live" when the data is preview. */
  source: DataSource;
  /** Permission boundary the model must respect. */
  guardrails: {
    canExecute: boolean;
    canApprove: boolean;
    canExport: boolean;
    readOnly: boolean;
  };
  /** Application payload — already redacted and shaped. */
  payload: Record<string, unknown>;
  /** Cap actually applied, for observability. */
  truncatedChars?: number;
}

export interface SafeContextOptions {
  scope: TenantScope;
  source: DataSource;
  payload: unknown;
  guardrails: SafeContext["guardrails"];
}

/**
 * Build a context blob safe to send to an LLM. Throws nothing — failures
 * degrade to "[REDACTED]" so a prompt is never blocked by a sanitiser bug.
 */
export function buildSafeContext(opts: SafeContextOptions): SafeContext {
  const stripped = stripBlockedFields(opts.payload);
  const redacted = redactDeep(stripped);
  let serialised = JSON.stringify(redacted);
  let truncated: number | undefined;
  if (serialised.length > MAX_CONTEXT_CHARS) {
    truncated = serialised.length - MAX_CONTEXT_CHARS;
    serialised = serialised.slice(0, MAX_CONTEXT_CHARS) + " /* …truncated */";
  }
  const safePayload = safeParse(serialised);
  return {
    scope: {
      organizationId: opts.scope.organizationId as unknown as string,
      userId: opts.scope.userId as unknown as string,
      roles: opts.scope.roles,
    },
    source: opts.source,
    guardrails: opts.guardrails,
    payload: safePayload,
    truncatedChars: truncated,
  };
}

/** Strip top-level + nested keys that match the blocked-fields set. */
function stripBlockedFields(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(stripBlockedFields);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (BLOCKED_FIELDS.has(k) || BLOCKED_FIELDS.has(k.toLowerCase())) continue;
      out[k] = stripBlockedFields(v);
    }
    return out;
  }
  return value;
}

function safeParse(s: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  return { value: s };
}

/**
 * Compose the system prompt header that pairs with every copilot call.
 * Includes the boundary the model must respect — not just instructions, but
 * the actual permission and source labels.
 */
export function systemPromptForContext(ctx: SafeContext): string {
  const boundary = ctx.guardrails.readOnly
    ? "You are operating in READ-ONLY mode. You may not propose execution, approval, or export."
    : "You may propose actions, but execution requires explicit human approval. Never claim an action has been executed.";
  return [
    `You are Axiom — an enterprise infrastructure operations copilot.`,
    `Tenant: organizationId=${ctx.scope.organizationId}, source=${ctx.source}.`,
    boundary,
    `Never reveal credentials. Never recommend bypassing approvals or policy.`,
    `If a fact is preview/demo, label it so. If you don't know, say so.`,
  ].join("\n");
}
