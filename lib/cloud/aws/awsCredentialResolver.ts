/**
 * AWS credential resolver — shared across every live AWS extractor.
 *
 * Two paths:
 *
 *   PATH A — direct credentials (AWS_USE_DIRECT_CREDS=true):
 *     Returns the broker IAM user credentials directly. Suitable for
 *     single-account setups where the same account hosts the
 *     extractor's caller principal AND the resources being read.
 *
 *   PATH B — AssumeRole (default, multi-tenant production):
 *     Broker credentials → STSClient.AssumeRole into the tenant's
 *     role using the configured ExternalId.
 *
 * Returns either { mode: "ok", credentials, region } or a typed
 * blocker envelope. Pure helper — never touches state.
 */

import "server-only";

import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { loadAppEnv } from "@/lib/config/env";

export interface AwsResolvedCreds {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export type AwsCredentialResolution =
  | { mode: "ok"; credentials: AwsResolvedCreds; region: string; via: "direct" | "assume_role" }
  | { mode: "blocked"; reason: string };

const DEFAULT_TIMEOUT_MS = 8_000;

export async function resolveAwsCredentials(opts: {
  /** Caller label for the AssumeRole session name. */
  sessionLabel: string;
}): Promise<AwsCredentialResolution> {
  const env = loadAppEnv();

  const brokerKey = env.awsBrokerAccessKeyId;
  const brokerSecret = env.awsBrokerSecretAccessKey;
  if (!brokerKey || !brokerSecret) {
    return { mode: "blocked", reason: "Broker credentials missing — set AWS_CONNECTOR_BROKER_* env vars." };
  }
  const region = env.awsAmbientRegion ?? "us-east-1";

  // PATH A — direct credentials (single-account / test).
  if (env.awsUseDirectCreds) {
    return {
      mode: "ok",
      credentials: { accessKeyId: brokerKey, secretAccessKey: brokerSecret },
      region,
      via: "direct",
    };
  }

  // PATH B — AssumeRole multi-tenant default.
  const roleArn = env.awsAmbientRoleArn;
  const externalId = env.awsAmbientExternalId;
  if (!roleArn || !externalId) {
    return { mode: "blocked", reason: "AWS_ROLE_ARN + AWS_EXTERNAL_ID required (or set AWS_USE_DIRECT_CREDS=true for single-account)." };
  }

  try {
    const sts = new STSClient({
      region,
      credentials: { accessKeyId: brokerKey, secretAccessKey: brokerSecret },
    });
    const assumed = await withTimeout(
      sts.send(new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: `axiom-${opts.sessionLabel}-${Date.now()}`,
        ExternalId: externalId,
        DurationSeconds: 900,
      })),
      DEFAULT_TIMEOUT_MS,
      "sts.assume_role",
    );
    const c = assumed.Credentials;
    if (!c?.AccessKeyId || !c?.SecretAccessKey || !c?.SessionToken) {
      return { mode: "blocked", reason: "AssumeRole returned no credentials." };
    }
    return {
      mode: "ok",
      credentials: {
        accessKeyId: c.AccessKeyId,
        secretAccessKey: c.SecretAccessKey,
        sessionToken: c.SessionToken,
      },
      region,
      via: "assume_role",
    };
  } catch (err) {
    return { mode: "blocked", reason: `AssumeRole failed: ${redact(errMessage(err))}` };
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function errMessage(e: unknown): string { return e instanceof Error ? e.message : String(e); }

function redact(msg: string): string {
  return msg
    .replace(/AKIA[0-9A-Z]{16}/g, "[redacted]")
    .replace(/ASIA[0-9A-Z]{16}/g, "[redacted]")
    .replace(/[A-Za-z0-9/+=]{40,}/g, "[redacted]");
}
