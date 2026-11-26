import "server-only";

import { prisma } from "@/lib/db";
import { decryptScopedCredential } from "@/lib/security/credentialVault";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
import { SIGNAL_DESCRIPTORS, type SignalProvider, type SignalSettings } from "./signalProviders";

/**
 * Loads a workspace's active read-only signal connection. The connection is re-read before the
 * credential is decrypted, so a disconnect or replacement never yields the old credential, and the stored
 * settings are re-validated through the same parser used at connect time (DNS and host rules included).
 */
export async function loadSignalConnection(organizationId: string, provider: SignalProvider): Promise<{ settings: SignalSettings; secret: Record<string, string>; connectionId: string; connectionUpdatedAt: Date }> {
  const where = { organizationId_provider: { organizationId, provider } };
  const row = await prisma.tenantIntegrationConnection.findUnique({ where });
  if (!row || row.organizationId !== organizationId || row.provider !== provider || row.status !== "active" || row.revokedAt) throw new Error(`${provider}_not_connected`);
  const stored = row.scopesJson && typeof row.scopesJson === "object" && !Array.isArray(row.scopesJson) ? (row.scopesJson as Record<string, unknown>) : null;
  if (!stored) throw new Error(`${provider}_connection_invalid`);
  const current = await prisma.tenantIntegrationConnection.findUnique({ where });
  if (!current || current.id !== row.id || current.status !== "active" || current.revokedAt || current.updatedAt.getTime() !== row.updatedAt.getTime() || current.encryptedCredential !== row.encryptedCredential) throw new Error(`${provider}_connection_changed`);
  const secret = JSON.parse(decryptScopedCredential(row.encryptedCredential, connectionCredentialContext({ organizationId, provider, connectionId: row.id }))) as Record<string, unknown>;
  const settingsInput = Object.fromEntries(Object.entries(stored).filter(([k, v]) => k !== "inventoryCount" && typeof v === "string"));
  if (settingsInput.region === "de") settingsInput.region = "eu";
  const parsed = await SIGNAL_DESCRIPTORS[provider].parse({ ...settingsInput, ...secret });
  return { settings: parsed.settings, secret: parsed.secret, connectionId: row.id, connectionUpdatedAt: new Date(row.updatedAt.getTime()) };
}
