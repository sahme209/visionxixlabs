/**
 * Owner-bound legacy credential retrieval; not organization execution authority.
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

/** The encrypted payload and its stored owner must be checked in one read.
 * This is a credential ownership check, not a role or Governance grant. */
async function getOwnedConnector(userId:string,credentialsKey:string|undefined,connectorType:string):Promise<Record<string,unknown>|null>{
  if(typeof userId!=='string'||!userId||userId.length>256||userId.trim()!==userId||typeof credentialsKey!=='string'||!credentialsKey.trim()||credentialsKey.trim().length>256)return null;
  const lead=await prisma.lead.findUnique({where:{id:credentialsKey.trim()},select:{userId:true,fullPayload:true}});
  if(!lead||lead.userId!==userId)return null;
  const payload=lead.fullPayload;
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return null;
  const connectors=(payload as Record<string,unknown>).connectors;
  if(!connectors||typeof connectors!=='object'||Array.isArray(connectors))return null;
  const connector=(connectors as Record<string,unknown>)[connectorType];
  if(!connector||typeof connector!=='object'||Array.isArray(connector)||typeof (connector as Record<string,unknown>).encryptedCredRef!=='string')return null;
  return connector as Record<string,unknown>;
}
async function getConnectorPayload(userId:string,credentialsKey:string|undefined,connectorType:string):Promise<Record<string,unknown>|null>{
  const connector=await getOwnedConnector(userId,credentialsKey,connectorType);if(!connector)return null;
  try{return JSON.parse(decryptCredential(connector.encryptedCredRef as string)) as Record<string,unknown>}catch{return null}
}

async function getAWSCredentialsFromVault(
  userId: string,
  credentialsKey?: string
): Promise<AWSCredentials | null> {
  const parsed = await getConnectorPayload(userId, credentialsKey, "aws");
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
  userId: string,
  credentialsKey?: string
): Promise<AzureCredentials | null> {
  const parsed = await getConnectorPayload(userId, credentialsKey, "azure");
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
  userId: string,
  credentialsKey?: string
): Promise<GCPCredentials | null> {
  const parsed = await getConnectorPayload(userId, credentialsKey, "gcp");
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
export async function getGitHubToken(userId:string,credentialsKey?:string):Promise<string|null>{
  const connector=await getOwnedConnector(userId,credentialsKey,'github');if(!connector)return null;
  try{return decryptCredential(connector.encryptedCredRef as string)}catch{return null}
}
