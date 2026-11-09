import "server-only";

import { prisma } from "@/lib/db";
import { decryptScopedCredential } from "@/lib/security/credentialVault";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
import { BATCH_DESCRIPTORS, type BatchClient, type BatchMetadata, type BatchProvider } from "./batchProviders";

/**
 * Loads the tenant's active read-only Batches connection. The base URL is
 * re-validated (DNS can change) and the connection is re-read before the
 * credential is decrypted, so a disconnect or replacement during validation
 * never yields the old credential. Read-only: no mutation authority exists.
 */
export async function loadBatchClient(organizationId: string, provider: BatchProvider): Promise<{ client: BatchClient; connectionId: string; connectionUpdatedAt: Date; metadata: BatchMetadata }> {
  const where = { organizationId_provider: { organizationId, provider } };
  const row = await prisma.tenantIntegrationConnection.findUnique({ where });
  if (!row || row.organizationId !== organizationId || row.provider !== provider || row.status !== "active" || row.revokedAt) throw new Error(`${provider}_not_connected`);
  const metadata = row.scopesJson as Partial<BatchMetadata> | null;
  if (typeof metadata?.baseUrl !== "string" || !(row.updatedAt instanceof Date)) throw new Error(`${provider}_connection_invalid`);
  const descriptor = BATCH_DESCRIPTORS[provider];
  // Re-validate the stored URL through the same boundary used at connect time.
  const { baseUrl } = await descriptor.parse({ baseUrl: metadata.baseUrl, token: "revalidate", namespace: metadata.namespace });
  const current = await prisma.tenantIntegrationConnection.findUnique({ where });
  if (!current || current.id !== row.id || current.status !== "active" || current.revokedAt || current.updatedAt.getTime() !== row.updatedAt.getTime() || current.encryptedCredential !== row.encryptedCredential) throw new Error(`${provider}_connection_changed`);
  const raw = decryptScopedCredential(row.encryptedCredential, connectionCredentialContext({ organizationId, provider, connectionId: row.id }));
  const { token } = JSON.parse(raw) as { token?: unknown };
  if (typeof token !== "string" || !token) throw new Error(`${provider}_connection_invalid`);
  return {
    client: descriptor.client(baseUrl, token, metadata.namespace),
    connectionId: row.id,
    connectionUpdatedAt: new Date(row.updatedAt.getTime()),
    metadata: { baseUrl, ...(metadata.namespace ? { namespace: metadata.namespace } : {}), inventoryCount: Number(metadata.inventoryCount) || 0 },
  };
}
