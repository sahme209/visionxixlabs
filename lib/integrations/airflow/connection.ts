import "server-only";

import { prisma } from "@/lib/db";
import { decryptScopedCredential } from "@/lib/security/credentialVault";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
import { AirflowClient, validateAirflowBaseUrl, type AirflowCredential } from "./airflowClient";

export async function loadAirflowClient(organizationId: string): Promise<{ client: AirflowClient; connectionId: string; baseUrl: string; connectionUpdatedAt: Date }> {
  const connection = await prisma.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId, provider: "airflow" } } });
  if (!connection || connection.organizationId !== organizationId || connection.provider !== "airflow" || connection.status !== "active" || connection.revokedAt) throw new Error("airflow_not_connected");
  const metadata = connection.scopesJson as { baseUrl?: unknown } | null;
  if (typeof metadata?.baseUrl !== "string") throw new Error("airflow_connection_invalid");
  const observed = { id: connection.id, updatedAt: connection.updatedAt.getTime(), encryptedCredential: connection.encryptedCredential };
  const baseUrl = await validateAirflowBaseUrl(metadata.baseUrl);
  // DNS/host validation can await. Never decrypt credentials from a connection
  // disconnected or replaced while that validation was outstanding.
  const current = await prisma.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId, provider: "airflow" } } });
  if (!current || current.id !== observed.id || current.organizationId !== organizationId || current.provider !== "airflow" ||
    current.status !== "active" || current.revokedAt || current.updatedAt.getTime() !== observed.updatedAt ||
    current.encryptedCredential !== observed.encryptedCredential) throw new Error("airflow_connection_changed");
  const raw = decryptScopedCredential(connection.encryptedCredential, connectionCredentialContext({ organizationId, provider: "airflow", connectionId: connection.id }));
  const credential = JSON.parse(raw) as AirflowCredential;
  return { client: new AirflowClient(baseUrl, credential), connectionId: connection.id, baseUrl, connectionUpdatedAt: connection.updatedAt };
}
