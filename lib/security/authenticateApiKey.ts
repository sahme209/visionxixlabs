/**
 * API-key authentication boundary — Phase 394.
 *
 * The single place that turns an inbound `Authorization: Bearer ...`
 * header into a (workspace, scopes) authority. Wraps the pure crypto
 * kernels + Prisma + rate limiting + audit emission. Every public
 * v1 route MUST call this and check the result before doing work.
 *
 * Closed-union failure shape so the route handler can render
 * specific 401/403 messages without leaking which step failed
 * (we collapse "no row" + "bad hash" into one outcome to stop
 * username-enumeration-style probes).
 *
 * Side-effects on success:
 *   - lastUsedAt + lastUsedIp + useCount updated (best-effort).
 *   - workforce.api_key_authenticated audit emitted.
 *
 * Side-effects on failure:
 *   - workforce.api_key_denied audit emitted with reason.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { parseApiKey, hashApiKey, verifyKeyHash } from "./apiKeyCrypto";
import {
  assertScope,
  normalizeScopes,
  type ApiKeyScope,
  type RequiredScope,
} from "./apiKeyScope";
import { checkRateLimit } from "@/lib/rateLimit";

export type AuthFailureKind =
  | "no_bearer_token"
  | "malformed_token"
  | "unknown_token"     // intentionally vague — covers "no row" + "hash mismatch"
  | "token_expired"
  | "token_revoked"
  | "missing_scope"
  | "rate_limited";

export interface AuthFailure {
  ok: false;
  reason: AuthFailureKind;
  /** When reason="missing_scope" — which scope was required. */
  requiredScope?: RequiredScope;
  /** HTTP status the caller should return. */
  httpStatus: 401 | 403 | 429;
}

export interface AuthSuccess {
  ok: true;
  apiKeyId: string;
  organizationId: string;
  scopes: ReadonlyArray<ApiKeyScope>;
  env: "live" | "test";
}

export type AuthResult = AuthSuccess | AuthFailure;

export interface AuthenticateInput {
  /** Full `Authorization` header value, or null when absent. */
  authorizationHeader: string | null;
  /** Source IP from the request. Used for last-used tracking + rate-limit key. */
  sourceIp: string | null;
  /** Required scope for this route. Pass the most specific scope possible. */
  requiredScope: RequiredScope;
  /** Correlation id for the audit trail. */
  correlationId: string;
  /** Route name for the audit detail (e.g. "GET /api/v1/release-gate"). */
  route: string;
}

function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

async function emitDeniedAudit(
  reason: AuthFailureKind,
  input: AuthenticateInput,
  apiKeyId: string | null,
  organizationId: string | null,
): Promise<void> {
  try {
    await recordAudit({
      organizationId: idFactory.organization(organizationId ?? "ws_unknown"),
      actorKind: "system",
      action: "workforce.api_key_denied",
      outcome: "blocked",
      entityRef: apiKeyId ? `api_key:${apiKeyId}` : `route:${input.route}`,
      correlationId: idFactory.correlation(input.correlationId),
      source: "live",
      detail: {
        reason,
        route: input.route,
        sourceIp: input.sourceIp,
        requiredScope: input.requiredScope,
      },
    });
  } catch { /* best-effort */ }
}

export async function authenticateApiKey(input: AuthenticateInput): Promise<AuthResult> {
  const plaintext = bearerToken(input.authorizationHeader);
  if (!plaintext) {
    await emitDeniedAudit("no_bearer_token", input, null, null);
    return { ok: false, reason: "no_bearer_token", httpStatus: 401 };
  }

  // Cheap structural check first — never hit the DB for obvious garbage.
  const parsed = parseApiKey(plaintext);
  if (!parsed.ok) {
    await emitDeniedAudit("malformed_token", input, null, null);
    return { ok: false, reason: "malformed_token", httpStatus: 401 };
  }

  // Per-prefix rate limit so a probe with a constant prefix can't brute
  // the keyHash. Source-IP fallback for keys not yet successfully bound.
  const rateKey = input.sourceIp ? `apikey:${parsed.prefix}:${input.sourceIp}` : `apikey:${parsed.prefix}`;
  if (!checkRateLimit(rateKey)) {
    await emitDeniedAudit("rate_limited", input, null, null);
    return { ok: false, reason: "rate_limited", httpStatus: 429 };
  }

  // Prefix-indexed lookup. Could be > 1 row if prefix collides (24-byte
  // suffix entropy makes that astronomically unlikely, but iterate
  // anyway so the timing channel stays closed).
  const candidates = await prisma.apiKey.findMany({
    where: { prefix: parsed.prefix },
    select: {
      id: true,
      organizationId: true,
      keyHash: true,
      env: true,
      scopes: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  const candidateHash = hashApiKey(plaintext);
  let matched: typeof candidates[number] | null = null;
  // Constant-time over the candidate set (always loops all rows).
  for (const row of candidates) {
    if (verifyKeyHash(candidateHash, row.keyHash)) matched = row;
  }

  if (!matched) {
    await emitDeniedAudit("unknown_token", input, null, null);
    return { ok: false, reason: "unknown_token", httpStatus: 401 };
  }

  if (matched.revokedAt !== null) {
    await emitDeniedAudit("token_revoked", input, matched.id, matched.organizationId);
    return { ok: false, reason: "token_revoked", httpStatus: 401 };
  }

  if (matched.expiresAt !== null && matched.expiresAt.getTime() < Date.now()) {
    await emitDeniedAudit("token_expired", input, matched.id, matched.organizationId);
    return { ok: false, reason: "token_expired", httpStatus: 401 };
  }

  // Narrow stored JSON to ApiKeyScope[] via the validator. Anything that
  // somehow got into the column unknown to the current code gets dropped,
  // so a stale schema can't accidentally widen authority.
  const rawScopes = Array.isArray(matched.scopes) ? matched.scopes : [];
  const scopes = normalizeScopes(rawScopes);

  const scopeCheck = assertScope(input.requiredScope, scopes);
  if (!scopeCheck.allowed) {
    await emitDeniedAudit("missing_scope", input, matched.id, matched.organizationId);
    return {
      ok: false,
      reason: "missing_scope",
      requiredScope: scopeCheck.required,
      httpStatus: 403,
    };
  }

  // Best-effort usage tracking. Failures here NEVER block auth.
  try {
    await prisma.apiKey.update({
      where: { id: matched.id },
      data: {
        lastUsedAt: new Date(),
        lastUsedIp: input.sourceIp ?? null,
        useCount: { increment: 1 },
      },
    });
  } catch { /* best-effort */ }

  try {
    await recordAudit({
      organizationId: idFactory.organization(matched.organizationId),
      actorKind: "system",
      action: "workforce.api_key_authenticated",
      outcome: "success",
      entityRef: `api_key:${matched.id}`,
      correlationId: idFactory.correlation(input.correlationId),
      source: "live",
      detail: {
        route: input.route,
        sourceIp: input.sourceIp,
        scope: input.requiredScope,
        env: matched.env,
      },
    });
  } catch { /* best-effort */ }

  return {
    ok: true,
    apiKeyId: matched.id,
    organizationId: matched.organizationId,
    scopes,
    env: (matched.env === "test" ? "test" : "live"),
  };
}
