/**
 * POST /api/scan/trigger
 *
 * One-click scan from the dashboard. Resolves the signed-in user's
 * verified AWS connector (Lead.fullPayload.connectors.aws), decrypts
 * the encryptedCredRef, runs the multi-region inventory against the
 * broker AssumeRole'd session, and persists the run + findings to the
 * canonical tables.
 *
 * Returns { ok, runId, findingCount, durationMs, accountId } so the
 * UI can refresh /dashboard/findings without polling. Failures surface
 * an honest reason string ('no_aws_connector', 'broker_unavailable',
 * etc.) the UI can show as a small inline error.
 *
 * Auth: required (currentContext). Body: optional { multiRegion?, regions? }.
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { decryptCredential } from "@/lib/security/credentialVault";
import { runMultiRegionAwsInventory } from "@/lib/cloud/aws/awsMultiRegionInventory";
import { runCloudScanPipeline } from "@/lib/pipeline/cloudScanPipeline";
import { persistScanRun } from "@/lib/scan/persistScanRun";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Multi-region scans can take 25-30s with all the EC2/S3/RDS reads.
export const maxDuration = 60;

interface AwsCreds {
  roleArn: string;
  externalId: string;
  region: string;
  awsAccountId: string;
}

function tryParseAwsCreds(decrypted: string): AwsCreds | null {
  try {
    const obj = JSON.parse(decrypted) as Record<string, unknown>;
    const roleArn = typeof obj.roleArn === "string" ? obj.roleArn : null;
    const externalId = typeof obj.externalId === "string" ? obj.externalId : null;
    const region = typeof obj.region === "string" ? obj.region : "us-east-1";
    const awsAccountId = typeof obj.awsAccountId === "string" ? obj.awsAccountId : null;
    if (!roleArn || !externalId || !awsAccountId) return null;
    return { roleArn, externalId, region, awsAccountId };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireContext();
  const correlationId = `scan_trigger_${Date.now().toString(36)}` as CorrelationId;

  // Optional body parameters — controls whether we sweep multiple regions.
  let multiRegion = false;
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (body.multiRegion === true) multiRegion = true;
  } catch { /* empty body is fine */ }

  // Resolve the user's most-recent cloud-operator Lead by userId or email
  // (mirrors the diag endpoint's lookup so behaviour is consistent).
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
    select: { id: true, fullPayload: true },
  });

  if (!lead) {
    return NextResponse.json({
      ok: false,
      error: "no_lead",
      hint: "No connect session found. Visit /dashboard/connect-cloud and link AWS first.",
    }, { status: 404 });
  }

  const payload = (lead.fullPayload as Record<string, unknown>) || {};
  const connectors = (payload.connectors as Record<string, unknown>) || {};
  const aws = connectors.aws as Record<string, unknown> | undefined;
  if (!aws || aws.status !== "linked" || typeof aws.encryptedCredRef !== "string") {
    return NextResponse.json({
      ok: false,
      error: "no_aws_connector",
      hint: "AWS isn't connected yet. Visit /dashboard/connect-cloud to link it.",
    }, { status: 400 });
  }

  let creds: AwsCreds | null = null;
  try {
    const decrypted = decryptCredential(aws.encryptedCredRef);
    creds = tryParseAwsCreds(decrypted);
  } catch (err) {
    console.warn("[scan/trigger] decrypt failed:", err instanceof Error ? err.message : err);
  }
  if (!creds) {
    return NextResponse.json({
      ok: false,
      error: "credentials_unreadable",
      hint: "The stored AWS credential blob couldn't be decrypted. Re-link AWS at /dashboard/connect-cloud.",
    }, { status: 500 });
  }

  await auditRecord({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "scan.start",
    outcome: "success",
    entityRef: `aws:${creds.awsAccountId}`,
    correlationId,
    detail: { provider: "aws", multiRegion, region: creds.region, trigger: "dashboard_button" },
  });

  try {
    if (multiRegion) {
      const live = await runMultiRegionAwsInventory({
        organizationId: ctx.organizationId,
        roleArn: creds.roleArn,
        externalId: creds.externalId,
        discoveryRegion: creds.region,
        perCallTimeoutMs: 8_000,
      });
      const persisted = await persistScanRun({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        provider: "aws",
        externalAccountId: live.accountId ?? creds.awsAccountId,
        region: creds.region,
        trigger: "manual",
        snapshot: live.snapshot,
        findings: live.findings,
        source: live.source,
        summary: `Dashboard trigger · ${live.snapshot.resources.length} resources · ${live.findings.length} findings`,
      });
      return NextResponse.json({
        ok: true,
        runId: persisted?.runId ?? null,
        findingCount: live.findings.length,
        resourceCount: live.snapshot.resources.length,
        accountId: live.accountId ?? creds.awsAccountId,
        durationMs: live.durationMs,
        source: live.source,
        persisted: persisted != null,
      });
    }

    // Single-region path — same persistence wrap.
    const outcome = await runCloudScanPipeline({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      connection: { roleArn: creds.roleArn, externalId: creds.externalId, region: creds.region },
      requestLive: true,
    });
    if (!outcome.ok || !outcome.preview) {
      return NextResponse.json({
        ok: false,
        error: "scan_failed",
        hint: outcome.validation.message,
        source: outcome.source,
      }, { status: 422 });
    }
    const persisted = await persistScanRun({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      provider: "aws",
      externalAccountId: outcome.validation.accountId ?? creds.awsAccountId,
      region: creds.region,
      trigger: "manual",
      snapshot: outcome.preview.snapshot,
      findings: outcome.preview.findings,
      source: outcome.source,
      summary: `Dashboard trigger · ${outcome.preview.snapshot.resources.length} resources · ${outcome.preview.findings.length} findings`,
    });
    return NextResponse.json({
      ok: true,
      runId: persisted?.runId ?? null,
      findingCount: outcome.preview.findings.length,
      resourceCount: outcome.preview.snapshot.resources.length,
      accountId: outcome.validation.accountId ?? creds.awsAccountId,
      durationMs: outcome.preview.durationMs,
      source: outcome.source,
      persisted: persisted != null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await auditRecord({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "scan.failure",
      outcome: "failure",
      entityRef: `aws:${creds.awsAccountId}`,
      correlationId,
      detail: { provider: "aws", error: msg.slice(0, 200) },
      errorCode: "scan.exception",
    });
    return NextResponse.json({
      ok: false,
      error: "scan_exception",
      hint: msg.slice(0, 200),
    }, { status: 500 });
  }
}
