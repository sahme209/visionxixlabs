/**
 * GET /api/cron/scheduled-scan-watchdog — hourly cron.
 *
 * Surfaces silently-failing scheduled scans so operators don't have
 * to open /dashboard/scheduled-scans to notice. Walks every enabled
 * AxiomScheduledRun, picks the ones with consecutiveFailures >= 3,
 * and fires one outbound notification per offending schedule.
 *
 * Dedupe: keyed on (scheduleId, dayBucket) so the every-hour tick
 * sends at most once per UTC day per failing schedule. The lane's
 * own 10-minute window adds a second layer of protection.
 *
 * Auth: CRON_SECRET bearer when set (matches expire-approvals).
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendOutboundNotification } from "@/lib/notifications/outboundNotificationLane";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const FAILURE_THRESHOLD = 3;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let failing: Array<{
    id: string;
    organizationId: string;
    cloudAccountId: string;
    consecutiveFailures: number;
    cloudAccount: { provider: string; externalAccountId: string; alias: string | null };
  }> = [];
  try {
    failing = await prisma.axiomScheduledRun.findMany({
      where: {
        enabled: true,
        consecutiveFailures: { gte: FAILURE_THRESHOLD },
      },
      take: 200,
      select: {
        id: true,
        organizationId: true,
        cloudAccountId: true,
        consecutiveFailures: true,
        cloudAccount: { select: { provider: true, externalAccountId: true, alias: true } },
      },
    }) as typeof failing;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      return NextResponse.json({ ok: true, alerted: 0, migrationPending: true });
    }
    throw err;
  }

  if (failing.length === 0) {
    return NextResponse.json({ ok: true, alerted: 0, sweptAt: new Date().toISOString() });
  }

  const day = new Date().toISOString().slice(0, 10);
  let alerted = 0;
  for (const s of failing) {
    const accountLabel = s.cloudAccount.alias ?? s.cloudAccount.externalAccountId;
    try {
      await sendOutboundNotification({
        dedupeKey: `scheduled_scan_failing:${s.id}:${day}`,
        kind: "release_blocker",
        severity: "high",
        headline: `Scheduled scan failing · ${s.cloudAccount.provider.toUpperCase()} · ${accountLabel}`,
        body: [
          `Schedule ${s.id} has failed ${s.consecutiveFailures} consecutive times.`,
          `Account: ${s.cloudAccount.externalAccountId}`,
          ``,
          `Open the schedules page to inspect the last error and pause / resume the run.`,
        ].join("\n"),
        tenantId: s.organizationId,
        safeNextAction: { label: "Review schedules", href: "/dashboard/scheduled-scans" },
        evidenceRefs: [`schedule:${s.id}`, `cloudAccount:${s.cloudAccountId}`],
      });
      alerted++;
    } catch (err) {
      console.warn("[scheduled-scan-watchdog] send failed:", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({
    ok: true,
    failing: failing.length,
    alerted,
    threshold: FAILURE_THRESHOLD,
    sweptAt: new Date().toISOString(),
  });
}
