/**
 * POST /api/aws/validate-role
 *
 * Validates the CloudFormation-provisioned IAM role by calling
 * sts:AssumeRole with the platform's broker credentials. Returns the
 * customer's AWS account id + the assumed role's caller ARN on
 * success. Surfaces honest, customer-readable errors on failure —
 * never leaks operator-side env-var names.
 *
 * Body:  { roleArn, externalId, region? }
 * Reply: { ok: true, accountId, arn, externalId }
 *      | { ok: false, error, hint }
 */

import { NextResponse, type NextRequest } from "next/server";
import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { loadAppEnv } from "@/lib/config/env";

export const dynamic = "force-dynamic";

interface Body {
  roleArn?: unknown;
  externalId?: unknown;
  region?: unknown;
}

const ROLE_ARN_RE = /^arn:aws:iam::\d{12}:role\/[A-Za-z0-9_+=,.@\-/]{1,64}$/;
const EXTERNAL_ID_RE = /^axiom-[A-Za-z0-9]{8,32}$/;

export async function POST(req: NextRequest) {
  let body: Body = {};
  try { body = (await req.json()) as Body; } catch { /* empty body */ }
  const roleArn = typeof body.roleArn === "string" ? body.roleArn.trim() : "";
  const externalId = typeof body.externalId === "string" ? body.externalId.trim() : "";
  const region = typeof body.region === "string" && body.region.length > 0
    ? body.region.trim()
    : "us-east-1";

  if (!roleArn || !ROLE_ARN_RE.test(roleArn)) {
    return NextResponse.json({
      ok: false,
      error: "malformed_role_arn",
      hint: "Role ARN should look like arn:aws:iam::123456789012:role/AxiomAgentReadOnly. Did the CloudFormation stack finish creating?",
    }, { status: 400 });
  }
  if (!externalId || !EXTERNAL_ID_RE.test(externalId)) {
    return NextResponse.json({
      ok: false,
      error: "malformed_external_id",
      hint: "External ID is missing from the URL. Re-deploy the CloudFormation stack from /operator/onboarding so a fresh session id is generated.",
    }, { status: 400 });
  }

  const env = loadAppEnv();
  if (!env.awsBrokerAccessKeyId || !env.awsBrokerSecretAccessKey) {
    // Customer-honest message — no Vercel / env-var jargon.
    return NextResponse.json({
      ok: false,
      error: "service_unavailable",
      hint: "The platform isn't ready to validate AWS connections yet. Try again in a few minutes — or contact support if this persists.",
    }, { status: 503 });
  }

  const broker = new STSClient({
    region,
    credentials: {
      accessKeyId:     env.awsBrokerAccessKeyId,
      secretAccessKey: env.awsBrokerSecretAccessKey,
    },
  });

  try {
    const assumed = await broker.send(new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: `axiom-validate-${Date.now()}`,
      ExternalId: externalId,
      DurationSeconds: 900,
    }));
    const creds = assumed.Credentials;
    if (!creds?.AccessKeyId || !creds?.SecretAccessKey || !creds?.SessionToken) {
      return NextResponse.json({
        ok: false,
        error: "assume_role_empty",
        hint: "AWS returned an empty credentials object. Try re-deploying the CloudFormation stack.",
      }, { status: 502 });
    }
    const tenant = new STSClient({
      region,
      credentials: {
        accessKeyId: creds.AccessKeyId,
        secretAccessKey: creds.SecretAccessKey,
        sessionToken: creds.SessionToken,
      },
    });
    const ident = await tenant.send(new GetCallerIdentityCommand({}));
    return NextResponse.json({
      ok: true,
      accountId: ident.Account ?? null,
      arn:       ident.Arn ?? roleArn,
      externalId,
    });
  } catch (err) {
    const name = err && typeof err === "object" && "name" in err ? String((err as { name?: string }).name) : "Unknown";
    if (name === "AccessDenied" || name === "AuthFailure") {
      return NextResponse.json({
        ok: false,
        error: "access_denied",
        hint: "AWS rejected the AssumeRole call. The CloudFormation stack might still be creating — wait 30 seconds and click the Finish setup link again.",
      }, { status: 403 });
    }
    return NextResponse.json({
      ok: false,
      error: "validation_failed",
      hint: err instanceof Error ? err.message.slice(0, 200) : "Unknown error",
    }, { status: 400 });
  }
}
