/**
 * POST /api/axiom/scheduler/run
 *
 * Cron endpoint — processes all due AxiomScheduledRun records.
 * Called by Vercel Cron (daily) or manually with CRON_SECRET.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 *
 * Safety: scheduled runs NEVER auto-apply. All actionable items
 * are left in approval_required state for human review.
 */

import { NextRequest, NextResponse } from "next/server";
import { processScheduledRuns } from "@/lib/axiom/scheduler";

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processScheduledRuns();

    return NextResponse.json({
      ok: true,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      skipped: result.skipped,
      notificationsSent: result.notifications.length,
    });
  } catch (e) {
    console.error("[axiom scheduler/run]", e);
    return NextResponse.json({ error: "Scheduler run failed" }, { status: 500 });
  }
}

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  return false;
}
