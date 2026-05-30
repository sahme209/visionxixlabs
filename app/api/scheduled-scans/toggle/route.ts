/**
 * POST /api/scheduled-scans/toggle
 *
 * Flips AxiomScheduledRun.enabled for a single schedule belonging
 * to the caller's organization. Resumes also reset
 * consecutiveFailures to 0 so the cron worker doesn't re-disable
 * the row on the next tick.
 *
 * Form-encoded body so the /dashboard/scheduled-scans page can stay
 * a server component:
 *   scheduleId: string
 *   enabled:    "true" | "false"
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ctx = await requireContext();

  const form = await req.formData().catch(() => null);
  const scheduleId = form?.get("scheduleId");
  const enabledStr = form?.get("enabled");
  if (typeof scheduleId !== "string" || (enabledStr !== "true" && enabledStr !== "false")) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  const enabled = enabledStr === "true";

  const sched = await prisma.axiomScheduledRun.findUnique({
    where: { id: scheduleId },
    select: { id: true, organizationId: true },
  });
  if (!sched || sched.organizationId !== ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  await prisma.axiomScheduledRun.update({
    where: { id: scheduleId },
    data: enabled
      ? { enabled: true, consecutiveFailures: 0, lastDiffSummary: null }
      : { enabled: false, lastDiffSummary: "Paused by operator." },
  });

  const referer = req.headers.get("referer") ?? "/dashboard/scheduled-scans";
  return NextResponse.redirect(referer, 303);
}
