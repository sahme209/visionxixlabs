import "server-only";

import { prisma } from "@/lib/db";
import { decryptScopedCredential } from "@/lib/security/credentialVault";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
import { AirflowClient, validateAirflowBaseUrl, type AirflowCredential } from "./airflowClient";

export async function loadAirflowClient(organizationId: string): Promise<{ client: AirflowClient; connectionId: string; baseUrl: string }> {
  const connection = await prisma.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId, provider: "airflow" } } });
  if (!connection || connection.status !== "active") throw new Error("airflow_not_connected");
  const metadata = connection.scopesJson as { baseUrl?: unknown } | null;
  if (typeof metadata?.baseUrl !== "string") throw new Error("airflow_connection_invalid");
  const baseUrl = await validateAirflowBaseUrl(metadata.baseUrl);
  const raw = decryptScopedCredential(connection.encryptedCredential, connectionCredentialContext({ organizationId, provider: "airflow", connectionId: connection.id }));
  const credential = JSON.parse(raw) as AirflowCredential;
  return { client: new AirflowClient(baseUrl, credential), connectionId: connection.id, baseUrl };
}
