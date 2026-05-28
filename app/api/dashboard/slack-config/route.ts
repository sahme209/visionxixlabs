/**
 * GET/POST /api/dashboard/slack-config — Phase 517.
 *
 * GET: read org's Slack config (webhook URL is masked).
 * POST: upsert config.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildSlackConfigReadResponse,
  buildSlackConfigUpsertResponse,
  type SlackRepo,
} from "@/lib/releaseops/slackNotificationResponder";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const r = await buildSlackConfigReadResponse(prisma as unknown as SlackRepo, ctx.organizationId);
  return NextResponse.json(r.body, { status: r.status });
}

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  let body: { webhookUrl?: unknown; enabledSignalKinds?: unknown; defaultChannel?: unknown; enabled?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const webhookUrl = typeof body.webhookUrl === "string" ? body.webhookUrl : "";
  const enabledSignalKinds = Array.isArray(body.enabledSignalKinds)
    ? body.enabledSignalKinds.filter((k): k is string => typeof k === "string")
    : undefined;

  const r = await buildSlackConfigUpsertResponse(prisma as unknown as SlackRepo, {
    organizationId: ctx.organizationId,
    webhookUrl,
    ...(enabledSignalKinds ? { enabledSignalKinds } : {}),
    ...(typeof body.defaultChannel === "string" ? { defaultChannel: body.defaultChannel } : {}),
    ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
  });
  return NextResponse.json(r.body, { status: r.status });
}
