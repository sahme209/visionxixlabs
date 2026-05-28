/**
 * AWS connector — real STS AssumeRole + GetCallerIdentity validation.
 * Multi-tenant safe: no env fallback for customer creds; uses broker to assume customer role.
 */

import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import type { ConnectorStatus } from "./types";
import { ENABLE_CLOUD_CONNECTORS_AWS } from "@/lib/featureFlags";

export type AWSAssumeRoleInput = {
  roleArn: string;
  externalId?: string | null;
  region?: string | null;
  awsAccountId: string;
};

export type ValidateAWSConnectionResult = {
  valid: boolean;
  status: ConnectorStatus;
  account?: string;
  arn?: string;
  errorCode?: string;
};

const ROLE_ARN_REGEX = /^arn:aws(?:-cn|-us-gov)?:iam::\d{12}:role\/[\w+=,.@-]+$/;
const ACCOUNT_ID_REGEX = /^\d{12}$/;

function getBrokerCredentials(): { accessKeyId: string; secretAccessKey: string; region: string } | null {
  const accessKeyId = process.env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_CONNECTOR_BROKER_REGION ?? process.env.AWS_REGION ?? "us-east-1";
  if (!accessKeyId?.trim() || !secretAccessKey?.trim()) return null;
  return { accessKeyId: accessKeyId.trim(), secretAccessKey: secretAccessKey.trim(), region };
}

/** Broker credentials for tenant assume-role only. Never falls back to AWS_ACCESS_KEY_ID/SECRET. */
function getBrokerCredentialsForTenant(): { accessKeyId: string; secretAccessKey: string; region: string } | null {
  const accessKeyId = (process.env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID ?? "").trim();
  const secretAccessKey = (process.env.AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY ?? "").trim();
  const region = (process.env.AWS_CONNECTOR_BROKER_REGION ?? process.env.AWS_REGION ?? "us-east-1").trim() || "us-east-1";
  if (!accessKeyId || !secretAccessKey) return null;
  return { accessKeyId, secretAccessKey, region };
}

/** Detect broker env vars at runtime (no secrets). */
function getBrokerEnvDetected(): {
  accessKeyId: boolean;
  secretAccessKey: boolean;
  region: string;
  source: "broker" | "fallback";
} {
  const brokerKey = !!(process.env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID ?? "").trim();
  const brokerSecret = !!(process.env.AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY ?? "").trim();
  const brokerRegion = (process.env.AWS_CONNECTOR_BROKER_REGION ?? "").trim();
  const fallbackKey = !!(process.env.AWS_ACCESS_KEY_ID ?? "").trim();
  const fallbackSecret = !!(process.env.AWS_SECRET_ACCESS_KEY ?? "").trim();
  const hasBroker = brokerKey && brokerSecret;
  const hasFallback = fallbackKey && fallbackSecret && !hasBroker;
  const region =
    brokerRegion || (process.env.AWS_REGION ?? "").trim() || "us-east-1";
  return {
    accessKeyId: brokerKey || fallbackKey,
    secretAccessKey: brokerSecret || fallbackSecret,
    region,
    source: hasBroker ? "broker" : "fallback",
  };
}

export type TestBrokerResult = {
  brokerValid: boolean;
  brokerAccountId: string;
  brokerArn: string;
  failureReason?: string;
};

/**
 * Test broker credentials with STS GetCallerIdentity only (no assume-role).
 * Do not proceed to assume-role until this succeeds.
 */
export async function testBrokerIdentity(): Promise<TestBrokerResult> {
  const env = getBrokerEnvDetected();
  if (!env.accessKeyId || !env.secretAccessKey) {
    const reason = !env.accessKeyId && !env.secretAccessKey
      ? "BROKER_NOT_CONFIGURED: AWS_CONNECTOR_BROKER_ACCESS_KEY_ID and AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY (or AWS_* fallbacks) are missing or empty"
      : !env.accessKeyId
        ? "BROKER_NOT_CONFIGURED: AWS_CONNECTOR_BROKER_ACCESS_KEY_ID (or AWS_ACCESS_KEY_ID) is missing or empty"
        : "BROKER_NOT_CONFIGURED: AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY (or AWS_SECRET_ACCESS_KEY) is missing or empty";
    return {
      brokerValid: false,
      brokerAccountId: "",
      brokerArn: "",
      failureReason: reason,
    };
  }

  const broker = getBrokerCredentials();
  if (!broker) {
    return {
      brokerValid: false,
      brokerAccountId: "",
      brokerArn: "",
      failureReason: "BROKER_NOT_CONFIGURED: Credentials unavailable after env check",
    };
  }

  try {
    const client = new STSClient({
      region: broker.region,
      credentials: {
        accessKeyId: broker.accessKeyId,
        secretAccessKey: broker.secretAccessKey,
      },
    });
    const result = await client.send(new GetCallerIdentityCommand({}));
    const account = result.Account ?? "";
    const arn = result.Arn ?? "";
    if (!account || !arn) {
      return {
        brokerValid: false,
        brokerAccountId: "",
        brokerArn: "",
        failureReason: "IDENTITY_INCOMPLETE: GetCallerIdentity returned empty Account or Arn",
      };
    }
    return {
      brokerValid: true,
      brokerAccountId: account,
      brokerArn: arn,
    };
  } catch (e) {
    const err = e as { name?: string; code?: string; message?: string };
    const code = err?.name ?? err?.code ?? "UNKNOWN";
    const msg = (err?.message ?? "").replace(/\b(AKIA[A-Z0-9]{16}|[A-Za-z0-9/+=]{40})\b/g, "[REDACTED]");
    const reason = `${code}: ${msg || "Unknown error"}`;
    return {
      brokerValid: false,
      brokerAccountId: "",
      brokerArn: "",
      failureReason: reason,
    };
  }
}

function validateInput(input: AWSAssumeRoleInput): string | null {
  const { roleArn, awsAccountId } = input;
  if (!roleArn?.trim()) return "Role ARN is required";
  if (!ROLE_ARN_REGEX.test(roleArn.trim())) return "Invalid Role ARN format (expected arn:aws:iam::ACCOUNT:role/NAME)";
  if (!awsAccountId?.trim()) return "AWS account ID is required";
  if (!ACCOUNT_ID_REGEX.test(String(awsAccountId).trim())) return "Invalid account ID (must be 12 digits)";
  const arnAccount = roleArn.match(/::(\d{12}):/)?.[1];
  if (arnAccount && arnAccount !== String(awsAccountId).trim()) return "Role ARN account does not match awsAccountId";
  return null;
}

/**
 * Validate AWS connection via STS AssumeRole + GetCallerIdentity.
 * Uses broker credentials to assume into the customer's role.
 */
export async function validateAWSConnection(
  input: AWSAssumeRoleInput,
  context?: { userId?: string; leadId?: string }
): Promise<ValidateAWSConnectionResult> {
  if (!ENABLE_CLOUD_CONNECTORS_AWS) {
    return { valid: false, status: "unavailable", errorCode: "FEATURE_DISABLED" };
  }

  const validationErr = validateInput(input);
  if (validationErr) {
    return { valid: false, status: "invalid", errorCode: "VALIDATION_FAILED" };
  }

  const broker = getBrokerCredentialsForTenant();
  if (!broker) {
    return { valid: false, status: "unavailable", errorCode: "BROKER_NOT_CONFIGURED" };
  }

  const roleArn = input.roleArn.trim();
  const externalId = input.externalId?.trim() || undefined;
  const region = input.region?.trim() || broker.region;
  const sessionName = `axiom-${context?.userId ?? "anon"}-${context?.leadId ?? "lead"}-${Date.now()}`.slice(0, 64);

  try {
    const brokerClient = new STSClient({
      region,
      credentials: {
        accessKeyId: broker.accessKeyId,
        secretAccessKey: broker.secretAccessKey,
      },
    });

    const assumeCmd = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: sessionName,
      ExternalId: externalId || undefined,
      DurationSeconds: 900,
    });

    // Phase 535 — retry to handle IAM eventual consistency. Same pattern
    // as /api/aws/validate-role. Without this the connector-link path
    // fails fast on freshly-created roles even after the broker-side
    // identity policy is correct.
    const delaysMs = [0, 2000, 4000, 6000, 8000];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let assumeResult: any;
    let lastRetryErr: unknown = null;
    for (let attempt = 0; attempt < delaysMs.length; attempt++) {
      if (delaysMs[attempt] > 0) {
        await new Promise((r) => setTimeout(r, delaysMs[attempt]));
      }
      try {
        assumeResult = await brokerClient.send(assumeCmd);
        lastRetryErr = null;
        break;
      } catch (err) {
        lastRetryErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (/is not authorized to perform:?\s*sts:AssumeRole/i.test(msg)) {
          break;
        }
      }
    }
    if (lastRetryErr || !assumeResult) {
      throw lastRetryErr ?? new Error("AssumeRole returned no result.");
    }
    const creds = assumeResult.Credentials;
    if (!creds?.AccessKeyId || !creds?.SecretAccessKey || !creds?.SessionToken) {
      return { valid: false, status: "invalid", errorCode: "ASSUME_FAILED" };
    }

    const tempClient = new STSClient({
      region,
      credentials: {
        accessKeyId: creds.AccessKeyId,
        secretAccessKey: creds.SecretAccessKey,
        sessionToken: creds.SessionToken,
      },
    });

    const identityResult = await tempClient.send(new GetCallerIdentityCommand({}));
    const account = identityResult.Account ?? undefined;
    const arn = identityResult.Arn ?? undefined;

    if (!account || !arn) {
      return { valid: false, status: "invalid", errorCode: "IDENTITY_FAILED" };
    }

    return {
      valid: true,
      status: "linked",
      account,
      arn,
    };
  } catch (e) {
    const err = e as { name?: string; code?: string };
    const code = err?.name ?? err?.code ?? "UNKNOWN";
    return {
      valid: false,
      status: "invalid",
      errorCode: code,
    };
  }
}

/**
 * Assume into customer role and return temporary credentials for plugin execution.
 * Used by lib/plugins/credentials.ts — never uses customer access keys.
 */
export async function assumeRoleForCredentials(
  input: AWSAssumeRoleInput,
  context?: { userId?: string; leadId?: string }
): Promise<{ accessKeyId: string; secretAccessKey: string; sessionToken: string; region: string } | null> {
  const broker = getBrokerCredentialsForTenant();
  if (!broker) return null;

  const validationErr = validateInput(input);
  if (validationErr) return null;

  const roleArn = input.roleArn.trim();
  const externalId = input.externalId?.trim() || undefined;
  const region = input.region?.trim() || broker.region;
  const sessionName = `axiom-${context?.userId ?? "anon"}-${context?.leadId ?? "lead"}-${Date.now()}`.slice(0, 64);

  try {
    const brokerClient = new STSClient({
      region,
      credentials: { accessKeyId: broker.accessKeyId, secretAccessKey: broker.secretAccessKey },
    });
    const assumeResult = await brokerClient.send(
      new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: sessionName,
        ExternalId: externalId,
        DurationSeconds: 900,
      })
    );
    const creds = assumeResult.Credentials;
    if (!creds?.AccessKeyId || !creds?.SecretAccessKey || !creds?.SessionToken) return null;
    return {
      accessKeyId: creds.AccessKeyId,
      secretAccessKey: creds.SecretAccessKey,
      sessionToken: creds.SessionToken,
      region,
    };
  } catch {
    return null;
  }
}

/**
 * @deprecated Use validateAWSConnection. Kept for compatibility during migration.
 */
export function validateAwsConnection(
  _creds: { accessKeyId?: string; secretAccessKey?: string; region?: string }
): { valid: boolean; status: ConnectorStatus; error?: string } {
  if (!ENABLE_CLOUD_CONNECTORS_AWS) {
    return { valid: false, status: "unavailable", error: "AWS connector not yet available. Coming soon." };
  }
  return {
    valid: false,
    status: "invalid",
    error: "Use assume-role flow: provide roleArn, awsAccountId, and optional externalId.",
  };
}
