/**
 * Idempotency framework.
 *
 * Every mutating operation Axiom exposes can take an `Idempotency-Key` header
 * (or generate one server-side from `(tenant, operation, input-hash)`). This
 * module is the store contract + decision engine: given a key and a fresh
 * request, do we (a) replay the previous result, (b) reject as conflicting,
 * or (c) accept as a new attempt?
 *
 * Why typed rather than just-hash-and-pray: replays must return the *same*
 * result the original caller got. Conflicts (same key, different body) must
 * fail loud — not silently overwrite. The store is an interface so prod can
 * back it with Prisma/Redis and tests with an in-memory map.
 */

import { createHash } from "crypto";
import type { IdempotencyKey, OrganizationId } from "@/lib/domain/ids";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

// ---------------------------------------------------------------------------
// Record
// ---------------------------------------------------------------------------

export type IdempotencyOutcome = "in_flight" | "succeeded" | "failed";

export interface IdempotencyRecord {
  key: IdempotencyKey;
  organizationId: OrganizationId;
  /** Operation tag — e.g. "execution_plan.approve" / "connector.connect". */
  operation: string;
  /** SHA-256 of the canonical request body. */
  inputHash: string;
  outcome: IdempotencyOutcome;
  /** Reference to the result (resource id, job id, run id) — opaque string. */
  resultRef?: string;
  /** Stable error code if outcome is "failed". */
  errorCode?: string;
  createdAt: string;
  /** Optional TTL — caller specifies; default 24h. */
  expiresAt: string;
}

export interface IdempotencyStore {
  /**
   * Return the record for `(organizationId, key)` if it exists, else null.
   * Implementations must be tenant-scoped — no cross-tenant lookups.
   */
  get(organizationId: OrganizationId, key: IdempotencyKey): Promise<IdempotencyRecord | null>;
  /**
   * Create an `in_flight` record. Must be atomic: if a record already exists
   * the implementation throws / returns false so the caller can short-circuit.
   */
  begin(record: IdempotencyRecord): Promise<{ created: boolean; existing?: IdempotencyRecord }>;
  /** Finalise an in-flight record with success/failure metadata. */
  finalize(input: {
    organizationId: OrganizationId;
    key: IdempotencyKey;
    outcome: "succeeded" | "failed";
    resultRef?: string;
    errorCode?: string;
  }): Promise<void>;
  /** Purge expired records — called by a background sweeper, not the hot path. */
  sweepExpired(now: Date): Promise<number>;
}

// ---------------------------------------------------------------------------
// In-memory implementation — used in dev / tests until Prisma is wired.
// ---------------------------------------------------------------------------

class InMemoryIdempotencyStore implements IdempotencyStore {
  private records = new Map<string, IdempotencyRecord>();
  private composite(org: OrganizationId, key: IdempotencyKey): string {
    return `${org}::${key}`;
  }
  async get(org: OrganizationId, key: IdempotencyKey): Promise<IdempotencyRecord | null> {
    return this.records.get(this.composite(org, key)) ?? null;
  }
  async begin(record: IdempotencyRecord): Promise<{ created: boolean; existing?: IdempotencyRecord }> {
    const composite = this.composite(record.organizationId, record.key);
    const existing = this.records.get(composite);
    if (existing) return { created: false, existing };
    this.records.set(composite, record);
    return { created: true };
  }
  async finalize(input: {
    organizationId: OrganizationId;
    key: IdempotencyKey;
    outcome: "succeeded" | "failed";
    resultRef?: string;
    errorCode?: string;
  }): Promise<void> {
    const composite = this.composite(input.organizationId, input.key);
    const existing = this.records.get(composite);
    if (!existing) return;
    this.records.set(composite, {
      ...existing,
      outcome: input.outcome,
      resultRef: input.resultRef ?? existing.resultRef,
      errorCode: input.errorCode ?? existing.errorCode,
    });
  }
  async sweepExpired(now: Date): Promise<number> {
    let removed = 0;
    for (const [k, r] of this.records.entries()) {
      if (new Date(r.expiresAt).getTime() < now.getTime()) {
        this.records.delete(k);
        removed++;
      }
    }
    return removed;
  }
}

let _store: IdempotencyStore = new InMemoryIdempotencyStore();
export function configureIdempotencyStore(store: IdempotencyStore): void {
  _store = store;
}
export function idempotencyStore(): IdempotencyStore {
  return _store;
}

// ---------------------------------------------------------------------------
// Input hashing
// ---------------------------------------------------------------------------

/**
 * SHA-256 of a canonical JSON encoding. Stable across runs as long as keys
 * are sorted deterministically — JSON.stringify-with-sorted-keys.
 */
export function hashInput(input: unknown): string {
  return createHash("sha256").update(canonicalJson(input)).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson((value as Record<string, unknown>)[k])).join(",") + "}";
}

// ---------------------------------------------------------------------------
// Decision engine
// ---------------------------------------------------------------------------

export type IdempotencyDecision =
  | { kind: "execute" }                                              // No prior record — proceed
  | { kind: "replay"; resultRef?: string; outcome: "succeeded" | "failed"; errorCode?: string } // Same body — return the prior result
  | { kind: "conflict"; reason: string }                             // Same key, different body — reject
  | { kind: "in_flight"; reason: string };                           // Identical retry while original still running

/**
 * Decide what to do with the incoming request. Pure — does no IO. The route
 * handler is expected to call `begin()` after `decision.kind === "execute"`.
 */
export function decideIdempotency(input: {
  existing: IdempotencyRecord | null;
  operation: string;
  inputHash: string;
}): IdempotencyDecision {
  const existing = input.existing;
  if (!existing) return { kind: "execute" };
  if (existing.operation !== input.operation) {
    return { kind: "conflict", reason: `Idempotency key reused across operations (${existing.operation} vs ${input.operation}).` };
  }
  if (existing.inputHash !== input.inputHash) {
    return { kind: "conflict", reason: "Idempotency key reused with a different request body." };
  }
  if (existing.outcome === "in_flight") {
    return { kind: "in_flight", reason: "Identical request is still in progress." };
  }
  return { kind: "replay", resultRef: existing.resultRef, outcome: existing.outcome, errorCode: existing.errorCode };
}

// ---------------------------------------------------------------------------
// Convenience wrapper
// ---------------------------------------------------------------------------

export interface IdempotentRunInput<T> {
  organizationId: OrganizationId;
  key: IdempotencyKey;
  operation: string;
  body: unknown;
  ttlMs?: number;
  run: () => Promise<{ result: T; resultRef?: string }>;
}

/**
 * High-level helper: load record → decide → execute → finalise. Throws
 * `AxiomError(conflict)` on conflict and re-raises any error from `run` after
 * recording a "failed" outcome.
 */
export async function runIdempotent<T>(input: IdempotentRunInput<T>): Promise<{ result?: T; replayed: boolean; resultRef?: string }> {
  const store = idempotencyStore();
  const inputHash = hashInput(input.body);
  const existing = await store.get(input.organizationId, input.key);
  const decision = decideIdempotency({ existing, operation: input.operation, inputHash });
  if (decision.kind === "conflict") {
    throw AxiomErrors.precondition("idempotency.conflict", decision.reason, { key: input.key });
  }
  if (decision.kind === "in_flight") {
    throw AxiomErrors.precondition("idempotency.in_flight", decision.reason, { key: input.key });
  }
  if (decision.kind === "replay") {
    return { replayed: true, resultRef: decision.resultRef };
  }
  const now = new Date();
  const ttl = input.ttlMs ?? 24 * 60 * 60 * 1000;
  const expiresAt = new Date(now.getTime() + ttl).toISOString();
  const { created } = await store.begin({
    key: input.key,
    organizationId: input.organizationId,
    operation: input.operation,
    inputHash,
    outcome: "in_flight",
    createdAt: now.toISOString(),
    expiresAt,
  });
  if (!created) {
    // Lost the race — re-read and decide based on the now-existing record.
    const fresh = await store.get(input.organizationId, input.key);
    if (fresh && fresh.inputHash === inputHash && fresh.outcome !== "in_flight") {
      return { replayed: true, resultRef: fresh.resultRef };
    }
    throw AxiomErrors.precondition("idempotency.race", "Concurrent identical request still in progress.", { key: input.key });
  }
  try {
    const { result, resultRef } = await input.run();
    await store.finalize({ organizationId: input.organizationId, key: input.key, outcome: "succeeded", resultRef });
    return { result, replayed: false, resultRef };
  } catch (err) {
    const code = (err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string")
      ? (err as { code: string }).code
      : "unknown";
    await store.finalize({ organizationId: input.organizationId, key: input.key, outcome: "failed", errorCode: code });
    throw err;
  }
}
