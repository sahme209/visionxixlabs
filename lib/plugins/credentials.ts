/**
 * Credential retrieval — per-tenant only.
 * NEVER uses process.env for user workloads. Looks up encrypted creds from lead connectors.
 * credentialsKey is interpreted as leadId for lookup.
 */

import { prisma } from "@/lib/db";
import { decryptCredential } from "@/lib/security/credentialVault";

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

export interface CredentialProvider {
  getAWSCredentials(userId: string, credentialsKey?: string): Promise<AWSCredentials | null>;
}

async function getAWSCredentialsFromVault(
  _userId: string,
  credentialsKey?: string
): Promise<AWSCredentials | null> {
  if (!credentialsKey?.trim()) return null;

  const lead = await prisma.lead.findUnique({
    where: { id: credentialsKey.trim() },
    select: { fullPayload: true },
  });
  if (!lead) return null;

  const payload = (lead.fullPayload as Record<string, unknown>) || {};
  const connectors = (payload.connectors as Record<string, Record<string, unknown>>) || {};
  const aws = connectors.aws;
  if (!aws || typeof aws.encryptedCredRef !== "string") return null;

  try {
    const plain = decryptCredential(aws.encryptedCredRef);
    const parsed = JSON.parse(plain) as { accessKeyId?: string; secretAccessKey?: string; region?: string };
    if (!parsed.accessKeyId || !parsed.secretAccessKey) return null;
    return {
      accessKeyId: String(parsed.accessKeyId),
      secretAccessKey: String(parsed.secretAccessKey),
      region: parsed.region ? String(parsed.region) : "us-east-1",
    };
  } catch {
    return null;
  }
}

const vaultProvider: CredentialProvider = {
  getAWSCredentials: getAWSCredentialsFromVault,
};

let provider: CredentialProvider = vaultProvider;

export function setCredentialProvider(p: CredentialProvider): void {
  provider = p;
}

export function getCredentialProvider(): CredentialProvider {
  return provider;
}
