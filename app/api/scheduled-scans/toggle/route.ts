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
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { isWorkspaceAdminRole } from "@/lib/desktop/desktopAuthorization";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ok: false, error: "forbidden_origin"}, {status: 403});
  const ctx = await requireContext();
  if (!ctx.isAuthenticated || !ctx.sessionUserId || !ctx.organizationId) return NextResponse.json({ok: false, error: "unauthorized"}, {status: 401});

  const form = await req.formData().catch(() => null);
  const scheduleId = form?.get("scheduleId");
  const enabledStr = form?.get("enabled");
  if (typeof scheduleId !== "string" || (enabledStr !== "true" && enabledStr !== "false")) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  const enabled = enabledStr === "true";

  const status = await prisma.$transaction(async tx => {
    const membership = await tx.orgMembership.findUnique({where: {userId_organizationId: {userId: ctx.sessionUserId!, organizationId: ctx.organizationId!}}, select: {role: true, acceptedAt: true}});
    if (!membership?.acceptedAt || !isWorkspaceAdminRole(membership.role)) return 403;
    const sched = await tx.axiomScheduledRun.findFirst({where: {id: scheduleId, organizationId: ctx.organizationId!}, select: {id: true, organizationId: true, cloudAccountId: true, updatedAt: true}});
    if (!sched || sched.organizationId !== ctx.organizationId) return 404;
    if (enabled) {
      const account = await tx.cloudAccount.findFirst({where: {id: sched.cloudAccountId, organizationId: ctx.organizationId!, provider: "aws", enabled: true, credentialRef: null}});
      if (!account || account.organizationId !== ctx.organizationId || account.provider !== "aws" || !account.enabled || account.credentialRef !== null) return 409;
    }
    const changed = await tx.axiomScheduledRun.updateMany({where: {id: sched.id, organizationId: ctx.organizationId!, cloudAccountId: sched.cloudAccountId, updatedAt: sched.updatedAt}, data: enabled
      ? {enabled: true, consecutiveFailures: 0, lastDiffSummary: null}
      : {enabled: false, lastDiffSummary: "Paused by operator."}});
    return changed.count === 1 ? 200 : 409;
  }, {isolationLevel: Prisma.TransactionIsolationLevel.Serializable});
  if (status !== 200) return NextResponse.json({ok: false, error: status === 403 ? "forbidden" : status === 404 ? "not_found" : "schedule_changed_or_unavailable"}, {status});
  return NextResponse.redirect(new URL("/dashboard/scheduled-scans", req.url), 303);
}
