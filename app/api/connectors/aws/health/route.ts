/**
 * GET /api/connectors/aws/health
 *
 * Tenant-scoped AWS broker health probe. Looks up the user's stored
 * encryptedCredRef, decrypts it, and runs sts:AssumeRole +
 * GetCallerIdentity to confirm the broker can still federate into
 * the customer's account. Returns honest verdicts:
 *
 *   { ok: true, healthy: true,  accountId, latencyMs }
 *   { ok: true, healthy: false, reason: "not_connected" | "trust_policy_drift" | … }
 *
 * Used by the dashboard's health pill. Never throws — frontends can
 * trust the response shape.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { decryptCredential } from "@/lib/security/credentialVault";
import { loadAppEnv } from "@/lib/config/env";
import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

type HealthResponse =
  | { ok: true; healthy: true; accountId: string; arn: string | null; latencyMs: number }
  | { ok: true; healthy: false; reason: string; hint?: string };

export async function GET() {
  const ctx = await requireContext();

  // Resolve the user's most-recent AWS-linked Lead.
  const user = await prisma.user.findUnique({
    where: { email: ctx.email!.toLowerCase() },
    select: { id: true },
  });
  const lead = await prisma.lead.findFirst({
    where: {
      source: "cloud-operator",
      OR: [
        ...(user?.id ? [{ userId: user.id }] : []),
        { email: ctx.email!.toLowerCase() },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { fullPayload: true },
  });
  if (!lead) {
    return NextResponse.json<HealthResponse>({
      ok: true, healthy: false, reason: "not_connected",
      hint: "Connect AWS at /dashboard/connect-cloud first.",
    });
  }

  const payload = (lead.fullPayload as Record<string, unknown>) || {};
  const connectors = (payload.connectors as Record<string, unknown>) || {};
  const aws = connectors.aws as Record<string, unknown> | undefined;
  if (!aws || aws.status !== "linked" || typeof aws.encryptedCredRef !== "string") {
    return NextResponse.json<HealthResponse>({
      ok: true, healthy: false, reason: "not_connected",
      hint: "AWS isn't linked. Connect at /dashboard/connect-cloud.",
    });
  }

  let creds: { roleArn: string; externalId: string; region: string; awsAccountId: string } | null = null;
  try {
    const obj = JSON.parse(decryptCredential(aws.encryptedCredRef)) as Record<string, unknown>;
    const roleArn = typeof obj.roleArn === "string" ? obj.roleArn : null;
    const externalId = typeof obj.externalId === "string" ? obj.externalId : null;
    const region = typeof obj.region === "string" ? obj.region : "us-east-1";
    const awsAccountId = typeof obj.awsAccountId === "string" ? obj.awsAccountId : null;
    if (roleArn && externalId && awsAccountId) {
      creds = { roleArn, externalId, region, awsAccountId };
    }
  } catch { /* fallthrough below */ }
  if (!creds) {
    return NextResponse.json<HealthResponse>({
      ok: true, healthy: false, reason: "credentials_unreadable",
      hint: "Stored credentials can't be decrypted — re-link AWS.",
    });
  }

  const env = loadAppEnv();
  if (!env.awsBrokerAccessKeyId || !env.awsBrokerSecretAccessKey) {
    return NextResponse.json<HealthResponse>({
      ok: true, healthy: false, reason: "broker_unavailable",
      hint: "Platform broker credentials aren't configured server-side.",
    });
  }

  const broker = new STSClient({
    region: creds.region,
    credentials: {
      accessKeyId: env.awsBrokerAccessKeyId,
      secretAccessKey: env.awsBrokerSecretAccessKey,
    },
  });

  const start = Date.now();
  try {
    const assumed = await broker.send(new AssumeRoleCommand({
      RoleArn: creds.roleArn,
      RoleSessionName: `axiom-health-${Date.now()}`,
      ExternalId: creds.externalId,
      DurationSeconds: 900,
    }));
    const sessionCreds = assumed.Credentials;
    if (!sessionCreds?.AccessKeyId || !sessionCreds?.SecretAccessKey || !sessionCreds?.SessionToken) {
      return NextResponse.json<HealthResponse>({
        ok: true, healthy: false, reason: "assume_role_empty",
      });
    }
    const tenant = new STSClient({
      region: creds.region,
      credentials: {
        accessKeyId: sessionCreds.AccessKeyId,
        secretAccessKey: sessionCreds.SecretAccessKey,
        sessionToken: sessionCreds.SessionToken,
      },
    });
    const ident = await tenant.send(new GetCallerIdentityCommand({}));
    return NextResponse.json<HealthResponse>({
      ok: true, healthy: true,
      accountId: ident.Account ?? creds.awsAccountId,
      arn: ident.Arn ?? null,
      latencyMs: Date.now() - start,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAccessDenied = /is not authorized to perform:?\s*sts:AssumeRole|AccessDenied/i.test(msg);
    return NextResponse.json<HealthResponse>({
      ok: true, healthy: false,
      reason: isAccessDenied ? "trust_policy_drift" : "assume_role_failed",
      hint: msg.slice(0, 200),
    });
  }
}
