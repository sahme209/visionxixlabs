/**
 * Credential retrieval — per-tenant only.
 * NEVER uses process.env for user workloads. Looks up encrypted creds from lead connectors.
 * credentialsKey is interpreted as leadId for lookup.
 * Supports assume-role format (roleArn, externalId) — uses broker to assume, returns temp creds.
 */

import { prisma } from "@/lib/db";
import { decryptCredential } from "@/lib/security/credentialVault";
import { assumeRoleForCredentials } from "@/lib/connectors/aws";
import { ClientSecretCredential } from "@azure/identity";
import type { TokenCredential } from "@azure/identity";

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region?: string;
}

export interface AzureCredentials {
  credential: TokenCredential;
  subscriptionId: string;
  tenantId: string;
}

export interface GCPCredentials {
  credentials: { client_email: string; private_key: string };
  projectId: string;
}

export interface CredentialProvider {
  getAWSCredentials(userId: string, credentialsKey?: string): Promise<AWSCredentials | null>;
  getAzureCredentials(userId: string, credentialsKey?: string): Promise<AzureCredentials | null>;
  getGCPCredentials(userId: string, credentialsKey?: string): Promise<GCPCredentials | null>;
}

async function getConnectorPayload(
  credentialsKey: string | undefined,
  connectorType: string
): Promise<Record<string, unknown> | null> {
  if (!credentialsKey?.trim()) return null;

  const lead = await prisma.lead.findUnique({
    where: { id: credentialsKey.trim() },
    select: { fullPayload: true },
  });
  if (!lead) return null;

  const payload = (lead.fullPayload as Record<string, unknown>) || {};
  const connectors = (payload.connectors as Record<string, Record<string, unknown>>) || {};
  const connector = connectors[connectorType];
  if (!connector || typeof connector.encryptedCredRef !== "string") return null;

  try {
    const plain = decryptCredential(connector.encryptedCredRef);
    return JSON.parse(plain) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function getAWSCredentialsFromVault(
  userId: string,
  credentialsKey?: string
): Promise<AWSCredentials | null> {
  const parsed = await getConnectorPayload(credentialsKey, "aws");
  if (!parsed) return null;

  if (parsed.roleArn && parsed.awsAccountId) {
    const temp = await assumeRoleForCredentials(
      {
        roleArn: String(parsed.roleArn),
        externalId: parsed.externalId ? String(parsed.externalId) : null,
        region: parsed.region ? String(parsed.region) : null,
        awsAccountId: String(parsed.awsAccountId),
      },
      { userId, leadId: credentialsKey }
    );
    if (!temp) return null;
    return {
      accessKeyId: temp.accessKeyId,
      secretAccessKey: temp.secretAccessKey,
      sessionToken: temp.sessionToken,
      region: temp.region,
    };
  }

  if (!parsed.accessKeyId || !parsed.secretAccessKey) return null;
  return {
    accessKeyId: String(parsed.accessKeyId),
    secretAccessKey: String(parsed.secretAccessKey),
    region: parsed.region ? String(parsed.region) : "us-east-1",
  };
}

async function getAzureCredentialsFromVault(
  _userId: string,
  credentialsKey?: string
): Promise<AzureCredentials | null> {
  const parsed = await getConnectorPayload(credentialsKey, "azure");
  if (!parsed) return null;

  const tenantId = parsed.tenantId ? String(parsed.tenantId) : null;
  const clientId = parsed.clientId ? String(parsed.clientId) : null;
  const clientSecret = parsed.clientSecret ? String(parsed.clientSecret) : null;
  const subscriptionId = parsed.subscriptionId ? String(parsed.subscriptionId) : null;

  if (!tenantId || !clientId || !clientSecret || !subscriptionId) return null;

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  return { credential, subscriptionId, tenantId };
}

async function getGCPCredentialsFromVault(
  _userId: string,
  credentialsKey?: string
): Promise<GCPCredentials | null> {
  const parsed = await getConnectorPayload(credentialsKey, "gcp");
  if (!parsed) return null;

  let saJson: Record<string, unknown>;
  if (typeof parsed.serviceAccountJson === "string") {
    try {
      saJson = JSON.parse(parsed.serviceAccountJson);
    } catch {
      return null;
    }
  } else {
    return null;
  }

  const clientEmail = saJson.client_email ? String(saJson.client_email) : null;
  const privateKey = saJson.private_key ? String(saJson.private_key) : null;
  const projectId = parsed.projectId
    ? String(parsed.projectId)
    : saJson.project_id
      ? String(saJson.project_id)
      : null;

  if (!clientEmail || !privateKey || !projectId) return null;

  return {
    credentials: { client_email: clientEmail, private_key: privateKey },
    projectId,
  };
}

const vaultProvider: CredentialProvider = {
  getAWSCredentials: getAWSCredentialsFromVault,
  getAzureCredentials: getAzureCredentialsFromVault,
  getGCPCredentials: getGCPCredentialsFromVault,
};

let provider: CredentialProvider = vaultProvider;

export function setCredentialProvider(p: CredentialProvider): void {
  provider = p;
}

export function getCredentialProvider(): CredentialProvider {
  return provider;
}

/**
 * Get GitHub token from lead's connector. credentialsKey = leadId.
 */
export async function getGitHubToken(credentialsKey?: string): Promise<string | null> {
  if (!credentialsKey?.trim()) return null;
  const lead = await prisma.lead.findUnique({
    where: { id: credentialsKey.trim() },
    select: { fullPayload: true },
  });
  if (!lead) return null;
  const payload = (lead.fullPayload as Record<string, unknown>) || {};
  const connectors = (payload.connectors as Record<string, Record<string, unknown>>) || {};
  const github = connectors.github;
  if (!github || typeof github.encryptedCredRef !== "string") return null;
  try {
    return decryptCredential(github.encryptedCredRef);
  } catch {
    return null;
  }
}
