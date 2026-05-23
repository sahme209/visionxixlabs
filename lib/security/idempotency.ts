/**
 * Pure idempotency-record kernels — Phase 402.
 *
 * Stripe-style. Engineer POSTs `/api/v1/pipelines/runs` with header
 * `Idempotency-Key: <client-uuid>`; if the network retries the same
 * call (timeout, partition), the second call returns the cached
 * response instead of firing a second pipeline run.
 *
 * Two pure kernels here + an IO boundary in idempotencyStore.ts:
 *
 *   hashRequestBody(s)            — SHA-256 hex of the canonical body
 *   parseIdempotencyKeyHeader(s)  — validates header format
 *   compareIdempotencyRecord(...) — decides replay / conflict / fresh
 *
 * Closed-union outcomes so route handlers can return the precise
 * HTTP status and the audit trail records the precise reason.
 *
 * Pure / deterministic. Uses node:crypto for hashing.
 */

import { createHash } from "node:crypto";

// ============================ key validation ============================

const KEY_RE = /^[A-Za-z0-9_\-./:]{8,255}$/;

export type ParseKeyFailureKind =
  | "missing"
  | "too_short"
  | "too_long"
  | "invalid_characters";

export type ParseIdempotencyKeyResult =
  | { ok: true; key: string }
  | { ok: false; reason: ParseKeyFailureKind };

/**
 * Validate the structure of the `Idempotency-Key` header value.
 * Returns the trimmed key or a closed-union failure reason.
 *
 * Accepts 8-255 chars from [A-Za-z0-9_\-./:] — covers UUIDs (with
 * hyphens), nanoid-style IDs, ULIDs, ISO timestamps, and namespaced
 * keys like "ci_job:12345". Rejects whitespace + everything else.
 */
export function parseIdempotencyKeyHeader(raw: string | null): ParseIdempotencyKeyResult {
  if (raw === null || raw === undefined) return { ok: false, reason: "missing" };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: "missing" };
  if (trimmed.length < 8) return { ok: false, reason: "too_short" };
  if (trimmed.length > 255) return { ok: false, reason: "too_long" };
  if (!KEY_RE.test(trimmed)) return { ok: false, reason: "invalid_characters" };
  return { ok: true, key: trimmed };
}

// ============================ body hashing ============================

/** SHA-256 hex of the raw request body. Used to detect key-reuse-with-mismatched-body. */
export function hashRequestBody(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

// ============================ record comparison ============================

export type IdempotencyDecisionKind =
  | "no_record"             // fresh — create the row + process normally
  | "replay_completed"      // return the cached response body verbatim
  | "in_flight"             // 409 — earlier call still processing
  | "body_mismatch"         // 422 — same key, different body (Stripe behavior)
  | "expired";              // treat as fresh (caller should overwrite the row)

export interface IdempotencyDecision {
  kind: IdempotencyDecisionKind;
  /** HTTP status the route should return when kind ≠ "no_record" / "expired". */
  httpStatus?: 200 | 409 | 422;
  /** When kind="replay_completed" — the cached response (httpStatus + JSON body). */
  cachedResponse?: { httpStatus: number; body: unknown };
  /** Operator-readable message. */
  message: string;
}

export interface StoredIdempotencyRecord {
  status: "in_flight" | "completed" | "failed";
  requestBodyHash: string;
  responseStatus: number | null;
  responseBody: unknown;
  expiresAt: Date | null;
}

export interface CompareIdempotencyInput {
  stored: StoredIdempotencyRecord | null;
  currentBodyHash: string;
  /** Pass for deterministic tests; defaults to Date.now(). */
  now?: Date;
}

export function compareIdempotencyRecord(input: CompareIdempotencyInput): IdempotencyDecision {
  if (input.stored === null) {
    return { kind: "no_record", message: "No prior request with this idempotency key." };
  }

  const stored = input.stored;
  const now = input.now ?? new Date();

  if (stored.expiresAt !== null && stored.expiresAt.getTime() < now.getTime()) {
    return { kind: "expired", message: "Prior record expired; treating as fresh." };
  }

  if (stored.requestBodyHash !== input.currentBodyHash) {
    return {
      kind: "body_mismatch",
      httpStatus: 422,
      message: "Idempotency key was previously used with a different request body.",
    };
  }

  if (stored.status === "in_flight") {
    return {
      kind: "in_flight",
      httpStatus: 409,
      message: "Earlier request with this idempotency key is still processing.",
    };
  }

  // status="completed" OR "failed" — replay either way. A failed
  // outcome is itself the canonical response; client should see the
  // same error rather than retry-causing-another-attempt.
  if (typeof stored.responseStatus === "number") {
    return {
      kind: "replay_completed",
      httpStatus: 200,
      cachedResponse: {
        httpStatus: stored.responseStatus,
        body: stored.responseBody,
      },
      message: "Replaying cached response from prior identical request.",
    };
  }

  // Sanity: completed/failed status but no response stored — treat as fresh.
  return { kind: "no_record", message: "Record present but response absent; treating as fresh." };
}
