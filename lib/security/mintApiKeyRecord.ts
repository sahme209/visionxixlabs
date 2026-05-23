/**
 * API-key mint helper — Phase 394.
 *
 * Generates a fresh key, persists the hash + metadata, returns the
 * plaintext to the caller exactly once. The caller MUST hand the
 * plaintext back to the operator and forget it — there is no way to
 * recover it after this function returns.
 *
 * Audits the mint so the operator can later prove "this key was
 * created by X at Y on behalf of workspace Z."
 */

import "server-only";

import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { mintApiKey as mintCrypto, type ApiKeyEnv } from "./apiKeyCrypto";
import { normalizeScopes, type ApiKeyScope } from "./apiKeyScope";

export interface MintInput {
  organizationId: string;
  /** Human-readable label set by the operator. */
  name: string;
  /** Caller-requested scopes — unknowns silently dropped. */
  scopes: ReadonlyArray<unknown>;
  /** "live" | "test". */
  env?: ApiKeyEnv;
  /** Who is minting (admin email or system actor name). */
  createdBy: string;
  /** Optional expiry timestamp; null for no expiry. */
  expiresAt?: Date | null;
  /** Correlation id for the audit trail. */
  correlationId: string;
}

export interface MintResult {
  apiKeyId: string;
  /** Show ONCE — never persisted. */
  plaintext: string;
  prefix: string;
  scopes: ReadonlyArray<ApiKeyScope>;
  env: ApiKeyEnv;
  expiresAt: Date | null;
}

export async function mintApiKeyRecord(input: MintInput): Promise<MintResult> {
  const env: ApiKeyEnv = input.env ?? "live";
  const minted = mintCrypto(env);
  const scopes = normalizeScopes(input.scopes);

  const row = await prisma.apiKey.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      prefix: minted.prefix,
      keyHash: minted.keyHash,
      env,
      scopes: scopes as unknown as object,
      createdBy: input.createdBy,
      expiresAt: input.expiresAt ?? null,
    },
    select: { id: true },
  });

  try {
    await recordAudit({
      organizationId: idFactory.organization(input.organizationId),
      actorKind: "system",
      action: "workforce.api_key_created",
      outcome: "success",
      entityRef: `api_key:${row.id}`,
      correlationId: idFactory.correlation(input.correlationId),
      source: "live",
      detail: {
        name: input.name,
        prefix: minted.prefix,
        env,
        scopes,
        createdBy: input.createdBy,
        expiresAt: input.expiresAt ?? null,
      },
    });
  } catch { /* best-effort */ }

  return {
    apiKeyId: row.id,
    plaintext: minted.plaintext,
    prefix: minted.prefix,
    scopes,
    env,
    expiresAt: input.expiresAt ?? null,
  };
}

export interface RevokeInput {
  apiKeyId: string;
  reason: string;
  revokedBy: string;
  correlationId: string;
}

export async function revokeApiKey(input: RevokeInput): Promise<{ ok: boolean; reason?: string }> {
  // Compare-and-swap: only revoke a row that's currently *not* revoked.
  // Prevents double-revoke audit churn if the admin clicks twice.
  const updated = await prisma.apiKey.updateMany({
    where: { id: input.apiKeyId, revokedAt: null },
    data: {
      revokedAt: new Date(),
      revokedReason: input.reason,
    },
  });

  if (updated.count === 0) {
    return { ok: false, reason: "already_revoked_or_missing" };
  }

  const row = await prisma.apiKey.findUnique({
    where: { id: input.apiKeyId },
    select: { organizationId: true, prefix: true, name: true },
  });

  if (row) {
    try {
      await recordAudit({
        organizationId: idFactory.organization(row.organizationId),
        actorKind: "system",
        action: "workforce.api_key_revoked",
        outcome: "success",
        entityRef: `api_key:${input.apiKeyId}`,
        correlationId: idFactory.correlation(input.correlationId),
        source: "live",
        detail: {
          name: row.name,
          prefix: row.prefix,
          reason: input.reason,
          revokedBy: input.revokedBy,
        },
      });
    } catch { /* best-effort */ }
  }

  return { ok: true };
}
