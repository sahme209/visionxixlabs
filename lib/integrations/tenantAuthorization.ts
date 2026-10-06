/**
 * Security primitives shared by tenant OAuth integrations.
 *
 * Browser authorization state is a high-entropy bearer secret. Only its
 * SHA-256 digest is persisted, so a database reader cannot finish a pending
 * Slack or Microsoft consent flow. Callers must consume each digest once.
 */

import { createHash, randomBytes } from "node:crypto";

export const TENANT_INTEGRATION_PROVIDERS = ["github", "slack", "teams"] as const;
export type TenantIntegrationProvider = (typeof TENANT_INTEGRATION_PROVIDERS)[number];

export function isTenantIntegrationProvider(value: string): value is TenantIntegrationProvider {
  return (TENANT_INTEGRATION_PROVIDERS as readonly string[]).includes(value);
}

export interface AuthorizationState {
  state: string;
  stateDigest: string;
  expiresAt: Date;
}

export function createAuthorizationState(input: {
  now?: Date;
  ttlMs?: number;
  random?: () => Buffer;
} = {}): AuthorizationState {
  const now = input.now ?? new Date();
  const ttlMs = input.ttlMs ?? 10 * 60_000;
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 60_000 || ttlMs > 30 * 60_000) {
    throw new Error("Authorization state lifetime must be between one and thirty minutes.");
  }
  const entropy = (input.random ?? (() => randomBytes(32)))();
  if (!Buffer.isBuffer(entropy) || entropy.length < 32) throw new Error("Authorization state requires at least 256 bits of entropy.");
  const state = entropy.toString("base64url");
  return {
    state,
    stateDigest: digestAuthorizationState(state),
    expiresAt: new Date(now.getTime() + ttlMs),
  };
}

export function digestAuthorizationState(state: string): string {
  if (!state || state.length < 40) throw new Error("Authorization state is malformed.");
  return createHash("sha256").update(state, "utf8").digest("hex");
}

/** Binds an authorization-flow secret to the exact org and integration. */
export function authorizationCredentialContext(input: {
  organizationId: string;
  provider: TenantIntegrationProvider;
  stateDigest: string;
}): string {
  return `tenant-integration-auth-v1:${input.organizationId}:${input.provider}:${input.stateDigest}`;
}

/** Binds a persisted credential to its immutable connection record. */
export function connectionCredentialContext(input: {
  organizationId: string;
  provider: TenantIntegrationProvider;
  connectionId: string;
}): string {
  return `tenant-integration-credential-v1:${input.organizationId}:${input.provider}:${input.connectionId}`;
}
