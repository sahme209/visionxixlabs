/**
 * IdempotencyRecord IO boundary — Phase 402.
 *
 * Two operations:
 *
 *   claimIdempotencySlot(...)  — atomic "I'm going to process this
 *                                key" claim. Returns the closed-union
 *                                comparison result (replay / conflict
 *                                / fresh / expired) from the pure
 *                                kernel + (when freshly claimed) an
 *                                opaque ticket the caller uses to
 *                                finalize.
 *
 *   completeIdempotencySlot(...) — finalize a claim with the response
 *                                  the route is about to return. Stores
 *                                  status + responseStatus + responseBody
 *                                  for future replays.
 *
 * All decision logic lives in the pure `compareIdempotencyRecord`
 * kernel; this module just talks to Postgres + audits.
 *
 * Atomic claim semantics:
 *   - Use prisma.create() and catch P2002 (unique violation) on race.
 *   - Re-fetch on conflict so we can decide replay/in_flight/body_mismatch
 *     against the row the OTHER concurrent caller just inserted.
 *
 * Failure mode: if Postgres is down, the kernel returns "no_record"
 * (best-effort) so the route still processes — better to potentially
 * double-fire than to lock customers out.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import {
  compareIdempotencyRecord,
  type IdempotencyDecision,
  type StoredIdempotencyRecord,
} from "./idempotency";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface ClaimInput {
  organizationId: string;
  idempotencyKey: string;
  routePath: string;
  requestBodyHash: string;
  /** Override TTL for tests. */
  ttlMs?: number;
}

export interface ClaimResult {
  decision: IdempotencyDecision;
  /** The DB row id; pass back to completeIdempotencySlot. Null when
   *  decision is replay / conflict / fresh-but-not-claimed. */
  recordId: string | null;
}

function nowPlus(ms: number): Date {
  return new Date(Date.now() + ms);
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  return (err as { code?: string }).code === "P2002";
}

function toStored(row: {
  status: string;
  requestBodyHash: string;
  responseStatus: number | null;
  responseBody: unknown;
  expiresAt: Date | null;
}): StoredIdempotencyRecord {
  const status: StoredIdempotencyRecord["status"] =
    row.status === "completed" ? "completed" :
    row.status === "failed"    ? "failed" :
    "in_flight";
  return {
    status,
    requestBodyHash: row.requestBodyHash,
    responseStatus: row.responseStatus,
    responseBody: row.responseBody,
    expiresAt: row.expiresAt,
  };
}

export async function claimIdempotencySlot(input: ClaimInput): Promise<ClaimResult> {
  const ttl = input.ttlMs ?? DEFAULT_TTL_MS;
  const expiresAt = nowPlus(ttl);

  // Optimistic path: try to insert a fresh "in_flight" row. P2002 unique
  // violation means a concurrent caller already inserted one; we then
  // re-fetch and let the kernel decide replay/conflict/body_mismatch.
  try {
    const row = await prisma.idempotencyRecord.create({
      data: {
        organizationId: input.organizationId,
        idempotencyKey: input.idempotencyKey,
        routePath: input.routePath,
        requestBodyHash: input.requestBodyHash,
        status: "in_flight",
        expiresAt,
      },
      select: { id: true },
    });
    return {
      decision: { kind: "no_record", message: "Slot freshly claimed." },
      recordId: row.id,
    };
  } catch (err) {
    if (!isUniqueViolation(err)) {
      // Treat any unexpected error as "no record" — fail-open so a DB
      // blip doesn't lock customers out of their v1 surface.
      return {
        decision: { kind: "no_record", message: "Idempotency lookup failed; treating as fresh." },
        recordId: null,
      };
    }
  }

  // We raced. Re-fetch and let the kernel decide.
  const existing = await prisma.idempotencyRecord.findUnique({
    where: {
      organizationId_idempotencyKey_routePath: {
        organizationId: input.organizationId,
        idempotencyKey: input.idempotencyKey,
        routePath: input.routePath,
      },
    },
    select: {
      id: true,
      status: true,
      requestBodyHash: true,
      responseStatus: true,
      responseBody: true,
      expiresAt: true,
    },
  });

  if (!existing) {
    // Vanishingly unlikely — row vanished between conflict and fetch.
    // Treat as fresh and recurse one level by claiming again.
    return claimIdempotencySlot(input);
  }

  const decision = compareIdempotencyRecord({
    stored: toStored(existing),
    currentBodyHash: input.requestBodyHash,
  });

  // On "expired", the kernel says "treat as fresh" — overwrite the
  // expired row in place so the caller can proceed with the new request.
  if (decision.kind === "expired") {
    try {
      await prisma.idempotencyRecord.update({
        where: { id: existing.id },
        data: {
          requestBodyHash: input.requestBodyHash,
          status: "in_flight",
          responseStatus: null,
          responseBody: undefined as unknown as object,
          expiresAt,
        },
      });
    } catch { /* best-effort */ }
    return {
      decision: { kind: "no_record", message: "Expired record overwritten." },
      recordId: existing.id,
    };
  }

  return { decision, recordId: null };
}

export interface CompleteInput {
  recordId: string;
  status: "completed" | "failed";
  responseStatus: number;
  responseBody: unknown;
  organizationId: string;
  correlationId: string;
}

export async function completeIdempotencySlot(input: CompleteInput): Promise<void> {
  try {
    await prisma.idempotencyRecord.update({
      where: { id: input.recordId },
      data: {
        status: input.status,
        responseStatus: input.responseStatus,
        responseBody: (input.responseBody ?? null) as unknown as object,
      },
    });
  } catch {
    // Best-effort. A failed finalize means future retries see in_flight
    // until the row expires; that's safer than losing the response.
  }

  try {
    await recordAudit({
      organizationId: idFactory.organization(input.organizationId),
      actorKind: "system",
      action: "workforce.idempotency_slot_completed",
      outcome: "success",
      entityRef: `idempotency_record:${input.recordId}`,
      correlationId: idFactory.correlation(input.correlationId),
      source: "live",
      detail: {
        status: input.status,
        responseStatus: input.responseStatus,
      },
    });
  } catch { /* best-effort */ }
}
