/**
 * GET/POST /api/cron/linkedin-publish
 *
 * Vercel cron — runs every 15 minutes. Picks any LinkedInPostDraft rows
 * with status="scheduled" and scheduledFor <= now, then attempts a
 * publish through lib/growth/linkedin/posting. Skips silently when
 * LINKEDIN_POSTING_ENABLED is not true OR no connection row exists.
 *
 * Guarded by Bearer ${CRON_SECRET}. Returns 503 when CRON_SECRET is not
 * set so we can never accidentally run a public publisher.
 */

import { NextResponse, type NextRequest } from "next/server";
import { listDueScheduledDrafts } from "@/lib/growth/draftStore";
import { publishDraft } from "@/lib/growth/linkedin/posting";
import { writeGrowthAudit } from "@/lib/growth/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }

async function handle(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "cron_not_configured" }, { status: 503 });
  }
  if ((req.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, reason: "cron_unauthorized" }, { status: 401 });
  }

  const due = await listDueScheduledDrafts(new Date());
  const outcomes: Array<{ draftId: string; outcome: string }> = [];

  for (const draft of due) {
    const result = await publishDraft({ draftId: draft.id, triggeredBy: "cron:linkedin-publish" });
    outcomes.push({ draftId: draft.id, outcome: result.kind });
    if (result.kind === "skipped_disabled" || result.kind === "skipped_not_connected") {
      // Bail out for the rest — none of them will succeed under the same condition.
      break;
    }
  }

  await writeGrowthAudit({
    actor: "cron:linkedin-publish",
    action: "cron.scheduled_publish_ran",
    detail: {
      due: due.length,
      attempted: outcomes.length,
      succeeded: outcomes.filter((o) => o.outcome === "success").length,
    },
  });

  return NextResponse.json({
    ok: true,
    scanned: due.length,
    outcomes,
    ranAt: new Date().toISOString(),
  });
}
