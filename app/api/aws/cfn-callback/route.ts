/**
 * POST /api/aws/cfn-callback?token=<starterToken>
 *
 * Webhook the in-stack Lambda (see public/aws/axiom-agent-quick-deploy.yaml)
 * POSTs to once CloudFormation reaches CREATE_COMPLETE. Removes the manual
 * "click FinishUrl" step from the customer's path — by the time their
 * browser tab is unblocked, the platform already knows the role ARN and
 * has validated it.
 *
 * Body: { stackId, roleArn, accountId, externalId, region }
 *
 * Flow:
 *   1. Verify the starter token → leadId.
 *   2. Validate the body shape and AssumeRole into the role with broker creds.
 *   3. Persist Lead.fullPayload.connectors.aws = { status: "linked", … }.
 *   4. Bridge to ConnectorSetupSession when the lead is tied to a user with
 *      an org, so the authenticated /dashboard CTA flips to "Connected".
 *
 * Returns 200 with { ok: true } once the role is verified. The Lambda
 * doesn't act on the response, but the onboarding page polls our DB
 * (not this route) to detect the callback and advance.
 */

import { NextResponse, type NextRequest } from "next/server";
import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { loadAppEnv } from "@/lib/config/env";
import { encryptCredential } from "@/lib/security/credentialVault";
import { logAudit } from "@/lib/security/auditLog";
import { eventConnectorLinked } from "@/lib/observability/events";
import { deriveWorkspaceIdFromEmail } from "@/lib/auth/workspaceId";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 35;

const ROLE_ARN_RE = /^arn:aws:iam::\d{12}:role\/[A-Za-z0-9_+=,.@\-/]{1,64}$/;
const EXTERNAL_ID_RE = /^axiom-[A-Za-z0-9]{8,32}$/;
const ACCOUNT_RE = /^\d{12}$/;

interface CallbackBody {
  stackId?: unknown;
  roleArn?: unknown;
  accountId?: unknown;
  externalId?: unknown;
  region?: unknown;
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ ok: false, error: "token required" }, { status: 400 });
  }
  const tokenResult = verifyStarterToken(token);
  if ("error" in tokenResult) {
    return NextResponse.json(
      { ok: false, error: tokenResult.error === "expired" ? "Token expired" : "Invalid token" },
      { status: 401 }
    );
  }

  let body: CallbackBody = {};
  try { body = (await req.json()) as CallbackBody; } catch { /* empty */ }
  const roleArn = typeof body.roleArn === "string" ? body.roleArn.trim() : "";
  const externalId = typeof body.externalId === "string" ? body.externalId.trim() : "";
  const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
  const region = typeof body.region === "string" && body.region.length > 0
    ? body.region.trim()
    : "us-east-1";
  const stackId = typeof body.stackId === "string" ? body.stackId.trim() : "";

  if (!ROLE_ARN_RE.test(roleArn)) {
    return NextResponse.json({ ok: false, error: "malformed roleArn" }, { status: 400 });
  }
  if (!EXTERNAL_ID_RE.test(externalId)) {
    return NextResponse.json({ ok: false, error: "malformed externalId" }, { status: 400 });
  }
  if (!ACCOUNT_RE.test(accountId)) {
    return NextResponse.json({ ok: false, error: "malformed accountId" }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id: tokenResult.leadId } });
  if (!lead) {
    return NextResponse.json({ ok: false, error: "lead not found" }, { status: 404 });
  }

  const env = loadAppEnv();
  if (!env.awsBrokerAccessKeyId || !env.awsBrokerSecretAccessKey) {
    await logAudit({
      leadId: lead.id,
      action: "aws.cfn_callback_broker_unavailable",
      actor: "system",
      metadata: { stackId, roleArn, externalId, accountId },
    });
    return NextResponse.json({ ok: false, error: "broker_unavailable" }, { status: 503 });
  }

  const broker = new STSClient({
    region,
    credentials: {
      accessKeyId: env.awsBrokerAccessKeyId,
      secretAccessKey: env.awsBrokerSecretAccessKey,
    },
  });

  // Same retry pattern as /api/aws/validate-role — IAM has eventual
  // consistency, and the Lambda fires almost immediately after the role
  // is created. Without retry the first AssumeRole sees AccessDenied.
  const delaysMs = [0, 2000, 4000, 6000, 8000];
  let verifiedArn: string | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < delaysMs.length; attempt++) {
    if (delaysMs[attempt] > 0) {
      await new Promise((r) => setTimeout(r, delaysMs[attempt]));
    }
    try {
      const assumed = await broker.send(new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: `axiom-cfn-callback-${Date.now()}`,
        ExternalId: externalId,
        DurationSeconds: 900,
      }));
      const creds = assumed.Credentials;
      if (!creds?.AccessKeyId || !creds?.SecretAccessKey || !creds?.SessionToken) {
        throw new Error("AssumeRole returned no credentials");
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
      verifiedArn = ident.Arn ?? roleArn;
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (/is not authorized to perform:?\s*sts:AssumeRole/i.test(msg)) {
        break;
      }
    }
  }

  const payload = (lead.fullPayload as Record<string, unknown>) || {};
  const connectors = (payload.connectors as Record<string, unknown>) || {};

  if (lastErr || !verifiedArn) {
    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr ?? "unknown");
    connectors.aws = {
      status: "invalid",
      linkedAt: new Date().toISOString(),
      authMethod: "assume-role",
      stackId,
      lastError: msg.slice(0, 200),
    };
    await prisma.lead.update({
      where: { id: lead.id },
      data: { fullPayload: { ...payload, connectors } as object },
    });
    await logAudit({
      leadId: lead.id,
      action: "aws.cfn_callback_validation_failed",
      actor: "system",
      metadata: { stackId, roleArn, externalId, accountId, error: msg.slice(0, 200) },
    });
    return NextResponse.json({ ok: false, error: "assume_role_failed", hint: msg.slice(0, 200) }, { status: 400 });
  }

  const encryptedCredRef = encryptCredential(
    JSON.stringify({ roleArn, externalId, region, awsAccountId: accountId })
  );
  connectors.aws = {
    status: "linked",
    linkedAt: new Date().toISOString(),
    authMethod: "assume-role",
    encryptedCredRef,
    verifiedAccountId: accountId,
    verifiedCallerArn: verifiedArn,
    stackId,
    source: "cfn_callback",
  };
  await prisma.lead.update({
    where: { id: lead.id },
    data: { fullPayload: { ...payload, connectors } as object },
  });

  // Bridge to the authenticated dashboard, same pattern as /api/connectors/link.
  // Workspace id derives from email (same hash currentContext() uses) — the
  // User model has no organizationId column, so a join would always return
  // null. Failures are warn-only: the lead-side state above is the source
  // of truth for the operator/onboarding screen.
  try {
    if (lead.userId && lead.email && lead.email !== "cloud-operator@placeholder.local") {
      const organizationId = deriveWorkspaceIdFromEmail(lead.email);
      await prisma.connectorSetupSession.upsert({
        where: {
          organizationId_provider: { organizationId, provider: "aws" },
        },
        update: {
          status: "connected",
          lastEventKind: "cfn_callback",
          lastErrorCode: null,
          firstConnectedAt: new Date(),
          lastTransitionAt: new Date(),
        },
        create: {
          organizationId,
          provider: "aws",
          status: "connected",
          lastEventKind: "cfn_callback",
          firstConnectedAt: new Date(),
          lastTransitionAt: new Date(),
        },
      });
    }
  } catch (err) {
    console.warn("[cfn-callback] dashboard bridge failed:", err instanceof Error ? err.message : err);
  }

  await logAudit({
    leadId: lead.id,
    action: "aws.cfn_callback_linked",
    actor: "system",
    metadata: { stackId, roleArn: verifiedArn, externalId, accountId },
  });
  eventConnectorLinked({ leadId: lead.id, connectorType: "aws" });

  return NextResponse.json({ ok: true, accountId, arn: verifiedArn });
}
