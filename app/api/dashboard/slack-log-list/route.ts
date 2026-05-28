/**
 * GET /api/dashboard/slack-log-list — Phase 517.
 * Optional ?signalKind / ?outcome filters.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildSlackLogListResponse,
  type SlackRepo,
} from "@/lib/releaseops/slackNotificationResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const url = new URL(req.url);
  const signalKind = url.searchParams.get("signalKind");
  const outcome = url.searchParams.get("outcome");
  const input: { organizationId: string; signalKind?: string; outcome?: string } = { organizationId: ctx.organizationId };
  if (signalKind) input.signalKind = signalKind;
  if (outcome) input.outcome = outcome;
  const r = await buildSlackLogListResponse(prisma as unknown as SlackRepo, input);
  return NextResponse.json(r.body, { status: r.status });
}
