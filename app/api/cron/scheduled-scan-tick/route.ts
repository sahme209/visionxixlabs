/**
 * GET /api/cron/scheduled-scan-tick — Vercel cron
 *
 * Polls AxiomScheduledRun for any rows where nextRunAt has elapsed,
 * runs the scan against the linked CloudAccount, persists findings,
 * and advances nextRunAt by frequency. Failures bump
 * consecutiveFailures; three in a row disables the schedule until
 * the operator re-enables it.
 *
 * Auth: Vercel sets CRON_SECRET as an env var; this route requires
 * it via the Authorization: Bearer header. Returns a compact
 * { swept, ran, succeeded, failed } so cron logs stay readable.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { decryptCredential } from "@/lib/security/credentialVault";
import { runMultiRegionAwsInventory } from "@/lib/cloud/aws/awsMultiRegionInventory";
import { persistScanRun } from "@/lib/scan/persistScanRun";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";
import { deriveWorkspaceIdFromEmail } from "@/lib/auth/workspaceId";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes — multi-account sweeps add up

const MAX_FAILURES_BEFORE_DISABLE = 3;

function nextRunFromCron(frequency: string): Date {
  const now = Date.now();
  // Simplified frequency → interval map. Full cron parsing isn't needed
  // for the four canonical frequencies the model supports today.
  const day = 24 * 60 * 60 * 1000;
  switch (frequency) {
    case "hourly":  return new Date(now + 60 * 60 * 1000);
    case "weekly":  return new Date(now + 7 * day);
    case "monthly": return new Date(now + 30 * day);
    case "daily":
    default:        return new Date(now + day);
  }
}

interface AwsCredsBlob {
  roleArn: string;
  externalId: string;
  region: string;
  awsAccountId: string;
}

async function resolveAwsCredsForOrg(organizationId: string): Promise<AwsCredsBlob | null> {
  // Resolve credentials the same way /api/scan/trigger does: scan all
  // cloud-operator Leads, look up the linked user's email separately
  // (Lead has no `user` relation defined), derive the workspace id,
  // and match. organizationId is a deterministic SHA-256 prefix of
  // the email, so we can't reverse it directly; a single sweep is
  // fine because total cloud-operator Leads is small (bounded by
  // signed-up users with AWS connected).
  const candidates = await prisma.lead.findMany({
    where: { source: "cloud-operator", userId: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 200, // bound the worst case
    select: { id: true, userId: true, fullPayload: true },
  });
  const userIds = candidates
    .map((l) => l.userId)
    .filter((u): u is string => typeof u === "string");
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true },
      })
    : [];
  const emailByUserId = new Map(users.map((u) => [u.id, u.email]));

  for (const lead of candidates) {
    const userEmail = lead.userId ? emailByUserId.get(lead.userId) : null;
    if (!userEmail) continue;
    const derived = deriveWorkspaceIdFromEmail(userEmail.toLowerCase());
    if (derived !== organizationId) continue;

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const connectors = (payload.connectors as Record<string, unknown>) || {};
    const aws = connectors.aws as Record<string, unknown> | undefined;
    if (!aws || aws.status !== "linked" || typeof aws.encryptedCredRef !== "string") continue;

    try {
      const obj = JSON.parse(decryptCredential(aws.encryptedCredRef)) as Record<string, unknown>;
      const roleArn = typeof obj.roleArn === "string" ? obj.roleArn : null;
      const externalId = typeof obj.externalId === "string" ? obj.externalId : null;
      const region = typeof obj.region === "string" ? obj.region : "us-east-1";
      const awsAccountId = typeof obj.awsAccountId === "string" ? obj.awsAccountId : null;
      if (!roleArn || !externalId || !awsAccountId) continue;
      return { roleArn, externalId, region, awsAccountId };
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  // Vercel cron auth: expects Bearer CRON_SECRET when set.
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  let due: Array<{
    id: string;
    organizationId: string;
    cloudAccountId: string;
    frequency: string;
    consecutiveFailures: number;
  }> = [];
  try {
    due = await prisma.axiomScheduledRun.findMany({
      where: { enabled: true, nextRunAt: { lte: now } },
      take: 20, // bound the per-tick blast radius
      select: {
        id: true,
        organizationId: true,
        cloudAccountId: true,
        frequency: true,
        consecutiveFailures: true,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      return NextResponse.json({ ok: true, swept: 0, migrationPending: true });
    }
    throw err;
  }

  let succeeded = 0;
  let failed = 0;
  for (const sched of due) {
    const correlationId = `sched_${sched.id.slice(0, 8)}_${Date.now().toString(36)}` as CorrelationId;
    const creds = await resolveAwsCredsForOrg(sched.organizationId);
    if (!creds) {
      // No credentials available — disable so we stop hitting the same row.
      await prisma.axiomScheduledRun.update({
        where: { id: sched.id },
        data: { enabled: false, lastDiffSummary: "Disabled: no credentials available." },
      });
      failed++;
      continue;
    }

    try {
      const live = await runMultiRegionAwsInventory({
        organizationId: ids.organization(sched.organizationId),
        roleArn: creds.roleArn,
        externalId: creds.externalId,
        discoveryRegion: creds.region,
        perCallTimeoutMs: 8_000,
      });
      const persisted = await persistScanRun({
        organizationId: ids.organization(sched.organizationId),
        userId: ids.user(`scheduler:${sched.id}`),
        provider: "aws",
        externalAccountId: live.accountId ?? creds.awsAccountId,
        region: creds.region,
        trigger: "scheduled",
        snapshot: live.snapshot,
        findings: live.findings,
        recommendations: live.recommendations,
        source: live.source,
        summary: `Scheduled scan · ${live.snapshot.resources.length} resources · ${live.findings.length} findings`,
      });
      await prisma.axiomScheduledRun.update({
        where: { id: sched.id },
        data: {
          nextRunAt: nextRunFromCron(sched.frequency),
          lastRunId: persisted?.runId ?? null,
          lastDiffSummary: `${live.findings.length} findings, ${live.snapshot.resources.length} resources`,
          consecutiveFailures: 0,
        },
      });
      await auditRecord({
        organizationId: ids.organization(sched.organizationId),
        actorUserId: ids.user(`scheduler:${sched.id}`),
        action: "scan.success",
        outcome: "success",
        entityRef: `aws:${live.accountId ?? creds.awsAccountId}`,
        correlationId,
        detail: { trigger: "scheduled", findingCount: live.findings.length },
      });
      succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const nextFailures = sched.consecutiveFailures + 1;
      await prisma.axiomScheduledRun.update({
        where: { id: sched.id },
        data: {
          consecutiveFailures: nextFailures,
          enabled: nextFailures < MAX_FAILURES_BEFORE_DISABLE,
          lastDiffSummary: `Failed: ${msg.slice(0, 200)}`,
          nextRunAt: nextRunFromCron(sched.frequency),
        },
      });
      await auditRecord({
        organizationId: ids.organization(sched.organizationId),
        actorUserId: ids.user(`scheduler:${sched.id}`),
        action: "scan.failure",
        outcome: "failure",
        entityRef: `aws:${creds.awsAccountId}`,
        correlationId,
        detail: { trigger: "scheduled", error: msg.slice(0, 200), consecutiveFailures: nextFailures },
        errorCode: "scan.scheduled_exception",
      });
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    swept: due.length,
    succeeded,
    failed,
    timestamp: now.toISOString(),
  });
}
