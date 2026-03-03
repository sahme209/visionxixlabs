/**
 * Credential retrieval — per-tenant only.
 * NEVER uses process.env for user workloads. Looks up encrypted creds from lead connectors.
 * credentialsKey is interpreted as leadId for lookup.
 * Supports assume-role format (roleArn, externalId) — uses broker to assume, returns temp creds.
 */

import { prisma } from "@/lib/db";
import { decryptCredential } from "@/lib/security/credentialVault";
import { assumeRoleForCredentials } from "@/lib/connectors/aws";

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region?: string;
}

export interface CredentialProvider {
  getAWSCredentials(userId: string, credentialsKey?: string): Promise<AWSCredentials | null>;
}

async function getAWSCredentialsFromVault(
  userId: string,
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
    const parsed = JSON.parse(plain) as {
      accessKeyId?: string;
      secretAccessKey?: string;
      region?: string;
      roleArn?: string;
      externalId?: string;
      awsAccountId?: string;
    };

    if (parsed.roleArn && parsed.awsAccountId) {
      const temp = await assumeRoleForCredentials(
        {
          roleArn: parsed.roleArn,
          externalId: parsed.externalId ?? null,
          region: parsed.region ?? null,
          awsAccountId: parsed.awsAccountId,
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
