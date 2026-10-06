/**
 * Platform-level GitHub App credential — IO boundary.
 *
 * The GitHub App Manifest flow produces the App's full credentials at
 * runtime (id, client_id, client_secret, webhook_secret, pem). Those live
 * in the `PlatformGithubAppCredential` singleton row rather than env vars,
 * so the one-time operator setup never requires a redeploy. Env vars
 * (GITHUB_APP_ID / GITHUB_PRIVATE_KEY / etc.) remain a supported fallback
 * for self-hosted/CI deployments that provision the App by hand.
 *
 * Hard rules:
 *  - Only one row ever exists (`singletonKey` is unique; always upserted
 *    on that key).
 *  - `client_secret`, `webhook_secret`, and the private key are encrypted
 *    with the same context-bound AES-GCM v2 envelope
 *    (lib/security/credentialVault.ts) used for
 *    TenantIntegrationConnection.encryptedCredential.
 *  - The decrypted secrets never leave this module except at the single
 *    point of use (JWT signing). Reads intended for API responses / audit
 *    detail must use `readSafePlatformGithubAppCredential`, which returns
 *    presence booleans + non-sensitive identifiers only.
 */

import "server-only";

import { encryptScopedCredential, decryptScopedCredential } from "@/lib/security/credentialVault";
import { prisma } from "@/lib/db";

export const PLATFORM_GITHUB_APP_SINGLETON_KEY = "platform_github_app";

/** AAD context binding — a decrypted secret cannot be replayed into a different field. */
function credentialContext(field: "clientSecret" | "webhookSecret" | "privateKey"): string {
  return `platform_github_app:${PLATFORM_GITHUB_APP_SINGLETON_KEY}:${field}`;
}

export interface PlatformGithubAppCredentialRow {
  id: string;
  appId: number;
  slug: string;
  name: string;
  clientId: string;
  encryptedClientSecret: string;
  encryptedWebhookSecret: string;
  encryptedPrivateKey: string;
  htmlUrl: string;
  createdAt: Date;
  createdByUserId: string;
}

export interface PlatformGithubAppCredentialRepo {
  platformGithubAppCredential: {
    findUnique(args: { where: { singletonKey: string } }): Promise<PlatformGithubAppCredentialRow | null>;
    upsert(args: {
      where: { singletonKey: string };
      create: Omit<PlatformGithubAppCredentialRow, "id" | "createdAt"> & { singletonKey: string };
      update: Omit<PlatformGithubAppCredentialRow, "id" | "createdAt" | "createdByUserId">;
    }): Promise<PlatformGithubAppCredentialRow>;
  };
}

function repo(): PlatformGithubAppCredentialRepo {
  return prisma as unknown as PlatformGithubAppCredentialRepo;
}

/** Safe, non-sensitive view — the only shape allowed in API responses / audit detail / logs. */
export interface SafePlatformGithubAppCredential {
  appId: number;
  slug: string;
  name: string;
  htmlUrl: string;
  createdAt: string;
}

export async function readSafePlatformGithubAppCredential(): Promise<SafePlatformGithubAppCredential | null> {
  const row = await repo().platformGithubAppCredential.findUnique({ where: { singletonKey: PLATFORM_GITHUB_APP_SINGLETON_KEY } });
  if (!row) return null;
  return { appId: row.appId, slug: row.slug, name: row.name, htmlUrl: row.htmlUrl, createdAt: row.createdAt.toISOString() };
}

/** Server-only resolver for the raw row — callers decrypt only the field they need, at point of use. */
export async function readPlatformGithubAppCredentialRow(): Promise<PlatformGithubAppCredentialRow | null> {
  return repo().platformGithubAppCredential.findUnique({ where: { singletonKey: PLATFORM_GITHUB_APP_SINGLETON_KEY } });
}

/** Decrypt the private key at the point of use. Never cache the decrypted value. */
export function decryptPlatformGithubAppPrivateKey(row: Pick<PlatformGithubAppCredentialRow, "encryptedPrivateKey">): string {
  return decryptScopedCredential(row.encryptedPrivateKey, credentialContext("privateKey"));
}

export interface UpsertPlatformGithubAppCredentialInput {
  appId: number;
  slug: string;
  name: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  privateKeyPem: string;
  htmlUrl: string;
  createdByUserId: string;
}

/** Encrypts the three secret fields and upserts the one platform row. */
export async function upsertPlatformGithubAppCredential(
  input: UpsertPlatformGithubAppCredentialInput,
): Promise<SafePlatformGithubAppCredential> {
  const encryptedClientSecret = encryptScopedCredential(input.clientSecret, credentialContext("clientSecret"));
  const encryptedWebhookSecret = encryptScopedCredential(input.webhookSecret, credentialContext("webhookSecret"));
  const encryptedPrivateKey = encryptScopedCredential(input.privateKeyPem, credentialContext("privateKey"));
  const row = await repo().platformGithubAppCredential.upsert({
    where: { singletonKey: PLATFORM_GITHUB_APP_SINGLETON_KEY },
    create: {
      singletonKey: PLATFORM_GITHUB_APP_SINGLETON_KEY,
      appId: input.appId,
      slug: input.slug,
      name: input.name,
      clientId: input.clientId,
      encryptedClientSecret,
      encryptedWebhookSecret,
      encryptedPrivateKey,
      htmlUrl: input.htmlUrl,
      createdByUserId: input.createdByUserId,
    },
    update: {
      appId: input.appId,
      slug: input.slug,
      name: input.name,
      clientId: input.clientId,
      encryptedClientSecret,
      encryptedWebhookSecret,
      encryptedPrivateKey,
      htmlUrl: input.htmlUrl,
    },
  });
  return { appId: row.appId, slug: row.slug, name: row.name, htmlUrl: row.htmlUrl, createdAt: row.createdAt.toISOString() };
}
