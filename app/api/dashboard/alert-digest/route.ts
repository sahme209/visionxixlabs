/**
 * GET /api/dashboard/alert-digest — Phase 432.
 *
 * Session-auth (cookie) sibling of /api/v1/alerts/digest. Same responder,
 * same envelope, same migration_pending degradation — only the auth differs.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { buildAlertDigestResponse } from "@/lib/alerts/alertDigestResponder";
import type { AlertSnapshotRepo } from "@/lib/alerts/alertEscalationSnapshot";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const correlationId = `dash_alert_digest_${Date.now().toString(36)}`;
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const r = await buildAlertDigestResponse(
    prisma as unknown as AlertSnapshotRepo,
    ctx.organizationId,
    { correlationId },
  );
  return NextResponse.json(r.body, { status: r.status });
}
