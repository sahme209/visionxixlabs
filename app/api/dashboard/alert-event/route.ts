/**
 * POST /api/dashboard/alert-event — Phase 433.
 *
 * Body:  { signalRef, eventKind, snoozeMinutes? }
 * Reply: { ok: true, status, transitionId } on legal apply
 *      | { ok: true, illegal: true, status, hint } on kernel-rejected (audit row still written)
 *      | { ok: false, error: "auth_required" | "invalid_payload" | "validation_failed", reason? }
 *      | { ok: false, error: "migration_pending" }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { recordAlertEscalationEvent } from "@/lib/alerts/alertEscalationEventEmit";
import type { AlertEscalationRepo } from "@/lib/alerts/alertEscalationRepo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: { signalRef?: unknown; eventKind?: unknown; snoozeMinutes?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  const signalRef = typeof body.signalRef === "string" ? body.signalRef : "";
  const eventKind = typeof body.eventKind === "string" ? body.eventKind : "";
  const snoozeMinutes = typeof body.snoozeMinutes === "number" ? body.snoozeMinutes : undefined;
  if (!signalRef || !eventKind) {
    return NextResponse.json({ ok: false, error: "invalid_payload", hint: "signalRef and eventKind are required strings." }, { status: 400 });
  }

  const outcome = await recordAlertEscalationEvent(
    prisma as unknown as AlertEscalationRepo,
    {
      organizationId: ctx.organizationId,
      signalRef,
      eventKind,
      actorUserId: ctx.userId,
      snoozeMinutes,
    },
  );

  switch (outcome.kind) {
    case "applied":
      if (outcome.result.ok) {
        return NextResponse.json({
          ok: true,
          status: outcome.result.nextStatus,
          previousStatus: outcome.result.previousStatus,
          transitionId: outcome.result.transition.id,
        });
      }
      return NextResponse.json({
        ok: true, illegal: true,
        status: outcome.result.from,
        transitionId: outcome.result.transition.id,
        hint: `Cannot ${outcome.result.eventKind} from ${outcome.result.from}.`,
      }, { status: 409 });
    case "migration_pending":
      return NextResponse.json({
        ok: false, error: "migration_pending",
        hint: "AlertEscalation tables aren't migrated yet.",
      }, { status: 503 });
    case "validation_failed":
      return NextResponse.json({
        ok: false, error: "validation_failed", reason: outcome.reason,
      }, { status: 400 });
  }
}
