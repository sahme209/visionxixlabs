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
import { logAudit } from "@/lib/security/auditLog";

export const dynamic = "force-dynamic";
// Phase 535 — bumped from 10s default so the retry loop has room. Each
// retry attempts AssumeRole then waits a step in the backoff array; the
// worst-case path spends ~25s before giving up.
export const maxDuration = 35;

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
    // Phase 535 — Retry AssumeRole with exponential backoff for up to ~20s.
    // IAM has eventual consistency: a role created by CloudFormation may
    // not be assumable for 5-30 seconds after CREATE_COMPLETE. Without
    // retry the first AssumeRole returns AccessDenied even when everything
    // is wired correctly, and the customer hits the rejected screen for
    // a reason that would have resolved itself in 10 seconds. Retries
    // bail early on "is not authorized" since that's a permanent broker-
    // side fix, not a timing issue.
    const delaysMs = [0, 2000, 4000, 6000, 8000];
    let assumed: Awaited<ReturnType<typeof broker.send<AssumeRoleCommand>>> | undefined;
    let lastRetryErr: unknown = null;
    for (let attempt = 0; attempt < delaysMs.length; attempt++) {
      if (delaysMs[attempt] > 0) {
        await new Promise((r) => setTimeout(r, delaysMs[attempt]));
      }
      try {
        assumed = await broker.send(new AssumeRoleCommand({
          RoleArn: roleArn,
          RoleSessionName: `axiom-validate-${Date.now()}`,
          ExternalId: externalId,
          DurationSeconds: 900,
        }));
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
    if (lastRetryErr || !assumed) {
      throw lastRetryErr ?? new Error("AssumeRole returned no credentials.");
    }

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
    await logAudit({
      action: "aws.validation_succeeded",
      actor: "system",
      metadata: { accountId: ident.Account ?? null, arn: ident.Arn ?? roleArn, externalId },
    });
    return NextResponse.json({
      ok: true,
      accountId: ident.Account ?? null,
      arn:       ident.Arn ?? roleArn,
      externalId,
    });
  } catch (err) {
    const name = err && typeof err === "object" && "name" in err ? String((err as { name?: string }).name) : "Unknown";
    const msg  = err instanceof Error ? err.message : String(err);
    await logAudit({
      action: "aws.validation_failed",
      actor: "system",
      metadata: { errorName: name, message: msg.slice(0, 200), roleArn, externalId },
    });

    // Distinguish "broker IAM user lacks sts:AssumeRole" from "trust
    // policy / externalId mismatch / stack still creating". The first
    // is a one-time operator fix; the others are customer-side timing.
    const isBrokerAssumeRoleDenied =
      /is not authorized to perform:?\s*sts:AssumeRole/i.test(msg);
    if (isBrokerAssumeRoleDenied) {
      const arnMatch = msg.match(/arn:aws:iam::\d{12}:(user|role)\/[A-Za-z0-9_+=,.@\-/]+/);
      return NextResponse.json({
        ok: false,
        error: "broker_assume_role_perms_missing",
        hint: msg.slice(0, 300),
        brokerArn: arnMatch?.[0],
      }, { status: 403 });
    }

    if (name === "AccessDenied" || name === "AuthFailure") {
      // Phase 535 — Be honest. We retried 5 times over ~20s. If we're
      // still here it's not eventual-consistency timing — it's a real
      // trust-policy mismatch or a broker-side identity-policy gap. The
      // customer can't fix either, so don't tell them to wait + retry.
      return NextResponse.json({
        ok: false,
        error: "access_denied",
        hint: "AWS rejected the AssumeRole call after 5 retries. The CloudFormation role exists but our platform's broker credentials can't assume into it. This is a one-time platform-side fix (broker IAM identity policy needs sts:AssumeRole on the role ARN, or the broker Vercel env vars need to be set). While that's being sorted, use the 'See the platform in demo mode' button to explore everything end-to-end.",
      }, { status: 403 });
    }
    return NextResponse.json({
      ok: false,
      error: "validation_failed",
      hint: msg.slice(0, 200),
    }, { status: 400 });
  }
}
