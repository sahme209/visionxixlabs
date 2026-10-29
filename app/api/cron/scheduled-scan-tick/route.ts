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
  leadId: string;
  leadUpdatedAt: Date;
  userId: string;
  userEmail: string;
  encryptedCredRef: string;
}

async function resolveAwsCredsForOrg(organizationId: string, expectedAccountId: string): Promise<AwsCredsBlob | null> {
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
    select: { id: true, userId: true, fullPayload: true, updatedAt: true },
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
      if (!roleArn || !externalId || !awsAccountId || awsAccountId !== expectedAccountId
        || !new RegExp(`^arn:(aws|aws-us-gov|aws-cn):iam::${expectedAccountId}:role/[A-Za-z0-9_+=,.@/\\-]+$`).test(roleArn)) continue;
      if (!(lead.updatedAt instanceof Date) || !Number.isFinite(lead.updatedAt.getTime())) continue;
      return { roleArn, externalId, region, awsAccountId, leadId: lead.id, leadUpdatedAt: lead.updatedAt, userId: lead.userId!, userEmail, encryptedCredRef: aws.encryptedCredRef };
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  // Vercel cron auth: expects Bearer CRON_SECRET when set.
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: "cron_unavailable" }, { status: 503 });
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
    updatedAt: Date;
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
        updatedAt: true,
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
    if (!(sched.updatedAt instanceof Date) || !Number.isFinite(sched.updatedAt.getTime())) {failed++; continue;}
    let scheduleVersion = sched.updatedAt;
    const correlationId = `sched_${sched.id.slice(0, 8)}_${Date.now().toString(36)}` as CorrelationId;
    const account = await prisma.cloudAccount.findFirst({
      where: { id: sched.cloudAccountId, organizationId: sched.organizationId, provider: "aws", enabled: true, credentialRef: null },
      select: {id: true, organizationId: true, provider: true, externalAccountId: true, enabled: true, credentialRef: true, updatedAt: true},
    });
    const eligible = account && account.updatedAt instanceof Date && Number.isFinite(account.updatedAt.getTime())
      && sched.updatedAt instanceof Date && Number.isFinite(sched.updatedAt.getTime()) && account.id === sched.cloudAccountId && account.organizationId === sched.organizationId
      && account.provider === "aws" && account.enabled && account.credentialRef === null && /^\d{12}$/.test(account.externalAccountId);
    // Modern enrollment never falls back to the legacy Lead credential store.
    const creds = eligible ? await resolveAwsCredsForOrg(sched.organizationId, account.externalAccountId) : null;
    if (!creds) {
      // No credentials available — disable so we stop hitting the same row.
      await prisma.axiomScheduledRun.updateMany({
        where: { id: sched.id, organizationId: sched.organizationId, cloudAccountId: sched.cloudAccountId, enabled: true, updatedAt: scheduleVersion },
        data: { enabled: false, lastDiffSummary: "Disabled: no credentials available." },
      });
      failed++;
      continue;
    }

    try {
      const current = await prisma.cloudAccount.findFirst({where: {id: account!.id, organizationId: sched.organizationId, provider: "aws", enabled: true, credentialRef: null, updatedAt: account!.updatedAt}});
      if (!current || !current.enabled || current.credentialRef !== null || current.externalAccountId !== creds.awsAccountId) throw new Error("scheduled_account_changed");
      const activeSchedule = await prisma.axiomScheduledRun.findFirst({where: {id: sched.id, organizationId: sched.organizationId, cloudAccountId: sched.cloudAccountId, enabled: true, updatedAt: sched.updatedAt}});
      if (!activeSchedule || !activeSchedule.enabled) throw new Error("scheduled_authority_changed");
      const currentLead = await prisma.lead.findFirst({where: {id: creds.leadId, userId: creds.userId, source: "cloud-operator", updatedAt: creds.leadUpdatedAt}, select: {fullPayload: true}});
      const currentUser = await prisma.user.findFirst({where: {id: creds.userId, email: creds.userEmail}, select: {email: true}});
      const connector = (currentLead?.fullPayload as {connectors?: {aws?: {status?: unknown; encryptedCredRef?: unknown}}} | null)?.connectors?.aws;
      if (!currentUser?.email || deriveWorkspaceIdFromEmail(currentUser.email.toLowerCase()) !== sched.organizationId
        || connector?.status !== "linked" || connector.encryptedCredRef !== creds.encryptedCredRef) throw new Error("scheduled_credential_changed");
      // A short lease prevents overlapping ticks from dispatching the same due
      // revision. A crashed attempt can be reconsidered after the lease expires.
      const claimTime = new Date(Math.max(Date.now(), sched.updatedAt.getTime() + 1));
      const claimed = await prisma.axiomScheduledRun.updateMany({
        where: {id: sched.id, organizationId: sched.organizationId, cloudAccountId: sched.cloudAccountId, enabled: true, updatedAt: scheduleVersion, nextRunAt: {lte: now}},
        data: {updatedAt: claimTime, nextRunAt: new Date(claimTime.getTime() + 7 * 60 * 1000)},
      });
      if (claimed.count !== 1) throw new Error("scheduled_scan_already_claimed");
      scheduleVersion = claimTime;
      const live = await runMultiRegionAwsInventory({
        organizationId: ids.organization(sched.organizationId),
        roleArn: creds.roleArn,
        externalId: creds.externalId,
        discoveryRegion: creds.region,
        perCallTimeoutMs: 8_000,
      });
      if (live.accountId !== creds.awsAccountId) throw new Error("scheduled_account_identity_mismatch");
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
      if (!persisted) throw new Error("scheduled_scan_persistence_unavailable");
      const recorded = await prisma.axiomScheduledRun.updateMany({
        where: { id: sched.id, organizationId: sched.organizationId, cloudAccountId: sched.cloudAccountId, enabled: true, updatedAt: scheduleVersion },
        data: {
          nextRunAt: nextRunFromCron(sched.frequency),
          lastRunId: persisted?.runId ?? null,
          lastDiffSummary: `${live.findings.length} findings, ${live.snapshot.resources.length} resources`,
          consecutiveFailures: 0,
        },
      });
      if (recorded.count !== 1) throw new Error("scheduled_result_authority_changed");
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
      await prisma.axiomScheduledRun.updateMany({
        where: { id: sched.id, organizationId: sched.organizationId, cloudAccountId: sched.cloudAccountId, enabled: true, updatedAt: scheduleVersion },
        data: {
          consecutiveFailures: nextFailures,
          ...(nextFailures >= MAX_FAILURES_BEFORE_DISABLE ? {enabled: false} : {}),
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
