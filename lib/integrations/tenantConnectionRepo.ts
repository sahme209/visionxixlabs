/**
 * Persistence boundary for tenant OAuth authorization attempts.
 *
 * The callback must consume state exactly once before it exchanges a provider
 * code. This makes browser-return replay harmless even if a callback URL is
 * copied from history or a proxy log.
 */

import {
  authorizationCredentialContext,
  createAuthorizationState,
  digestAuthorizationState,
  type TenantIntegrationProvider,
} from "./tenantAuthorization";
import { encryptScopedCredential } from "@/lib/security/credentialVault";

export interface AuthorizationAttemptRow {
  id: string;
  organizationId: string;
  provider: string;
  stateDigest: string;
  redirectUri: string;
  encryptedPkceVerifier: string | null;
  initiatedByUserId: string;
  expiresAt: Date;
  consumedAt: Date | null;
}

interface AuthorizationAttemptDelegate {
  create(args: {
    data: Omit<AuthorizationAttemptRow, "id" | "consumedAt"> & { consumedAt?: Date | null };
  }): Promise<AuthorizationAttemptRow>;
  findUnique(args: { where: { stateDigest: string } }): Promise<AuthorizationAttemptRow | null>;
  updateMany(args: {
    where: { id: string; consumedAt: null; expiresAt: { gt: Date } };
    data: { consumedAt: Date };
  }): Promise<{ count: number }>;
}

export interface TenantConnectionRepo {
  tenantIntegrationAuthorizationAttempt: AuthorizationAttemptDelegate;
}

export interface StartAuthorizationInput {
  organizationId: string;
  provider: TenantIntegrationProvider;
  redirectUri: string;
  initiatedByUserId: string;
  /** Microsoft PKCE verifier. It is encrypted here only after state exists. */
  pkceVerifier?: string;
  now?: Date;
}

export async function startTenantIntegrationAuthorization(
  repo: TenantConnectionRepo,
  input: StartAuthorizationInput,
): Promise<{ state: string; expiresAt: Date }> {
  if (!input.organizationId.trim() || !input.redirectUri.trim() || !input.initiatedByUserId.trim()) {
    throw new Error("Tenant authorization requires an organization, redirect URI, and initiating user.");
  }
  const now = input.now ?? new Date();
  const authorization = createAuthorizationState({ now });
  const encryptedPkceVerifier = input.pkceVerifier
    ? encryptScopedCredential(input.pkceVerifier, authorizationCredentialContext({
      organizationId: input.organizationId,
      provider: input.provider,
      stateDigest: authorization.stateDigest,
    }))
    : null;
  await repo.tenantIntegrationAuthorizationAttempt.create({
    data: {
      organizationId: input.organizationId,
      provider: input.provider,
      stateDigest: authorization.stateDigest,
      redirectUri: input.redirectUri,
      encryptedPkceVerifier,
      initiatedByUserId: input.initiatedByUserId,
      expiresAt: authorization.expiresAt,
    },
  });
  return { state: authorization.state, expiresAt: authorization.expiresAt };
}

export type ConsumeAuthorizationResult =
  | { ok: true; attempt: AuthorizationAttemptRow }
  | { ok: false; reason: "missing" | "expired" | "consumed" };

export async function consumeTenantIntegrationAuthorization(
  repo: TenantConnectionRepo,
  input: { state: string; provider: TenantIntegrationProvider; now?: Date },
): Promise<ConsumeAuthorizationResult> {
  let stateDigest: string;
  try {
    stateDigest = digestAuthorizationState(input.state);
  } catch {
    return { ok: false, reason: "missing" };
  }
  const attempt = await repo.tenantIntegrationAuthorizationAttempt.findUnique({ where: { stateDigest } });
  if (!attempt || attempt.provider !== input.provider) return { ok: false, reason: "missing" };
  const now = input.now ?? new Date();
  if (attempt.consumedAt) return { ok: false, reason: "consumed" };
  if (attempt.expiresAt <= now) return { ok: false, reason: "expired" };

  const claimed = await repo.tenantIntegrationAuthorizationAttempt.updateMany({
    where: { id: attempt.id, consumedAt: null, expiresAt: { gt: now } },
    data: { consumedAt: now },
  });
  return claimed.count === 1 ? { ok: true, attempt } : { ok: false, reason: "consumed" };
}
