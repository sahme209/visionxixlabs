/**
 * POST /api/admin/webhook-endpoints — Phase 395.
 *
 * Registers a new outbound webhook endpoint for a workspace. The
 * generated `secret` is returned ONCE in the response so the operator
 * can configure their integrator's signature verifier; afterwards
 * only the first/last few chars are surfaced for identification.
 *
 * Body:
 *   { organizationId, name, url, subscribedEvents[], allowHttp?, allowPrivate? }
 *
 * GET /api/admin/webhook-endpoints?organizationId=X — list endpoints.
 *
 * Gated by ADMIN_EMAILS.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { randomBytes } from "node:crypto";
import {
  normalizeEventKinds,
} from "@/lib/webhooks/webhookEventKinds";
import { validateWebhookUrl } from "@/lib/webhooks/selectDeliveriesForEvent";

export const dynamic = "force-dynamic";

interface RegisterBody {
  organizationId?: unknown;
  name?: unknown;
  url?: unknown;
  subscribedEvents?: unknown;
  allowHttp?: unknown;
  allowPrivate?: unknown;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false, reason: "admin_required" }, { status: 403 });
  }

  let body: RegisterBody = {};
  try { body = (await req.json()) as RegisterBody; } catch { /* empty */ }

  if (typeof body.organizationId !== "string" || body.organizationId.length === 0) {
    return NextResponse.json({ ok: false, reason: "organizationId_required" }, { status: 400 });
  }
  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ ok: false, reason: "name_required" }, { status: 400 });
  }
  if (typeof body.url !== "string" || body.url.trim().length === 0) {
    return NextResponse.json({ ok: false, reason: "url_required" }, { status: 400 });
  }

  // Either explicit "*" (caller wants every event), or a normalized
  // list of known event kinds. Reject empty subscriptions so a
  // never-firing endpoint can't accidentally get registered.
  const rawEvents = Array.isArray(body.subscribedEvents) ? body.subscribedEvents : [];
  const subscribedEvents: string[] = rawEvents.includes("*")
    ? ["*"]
    : normalizeEventKinds(rawEvents);
  if (subscribedEvents.length === 0) {
    return NextResponse.json({ ok: false, reason: "no_valid_subscribed_events" }, { status: 400 });
  }

  const allowHttp = body.allowHttp === true;
  const allowPrivate = body.allowPrivate === true;

  const urlCheck = validateWebhookUrl(body.url.trim(), { allowHttp, allowPrivate });
  if (!urlCheck.ok) {
    return NextResponse.json({ ok: false, reason: `url_${urlCheck.reason}` }, { status: 400 });
  }

  // HMAC secret: 32 random bytes hex-encoded. Operator stores this
  // verbatim in their integrator's signature verifier.
  const secret = randomBytes(32).toString("hex");

  const row = await prisma.webhookEndpoint.create({
    data: {
      organizationId: body.organizationId,
      name: body.name.trim(),
      url: body.url.trim(),
      secret,
      subscribedEvents: subscribedEvents as unknown as object,
      createdBy: session.user.email,
    },
    select: { id: true, name: true, url: true, subscribedEvents: true, createdAt: true },
  });

  try {
    await recordAudit({
      organizationId: idFactory.organization(body.organizationId),
      actorKind: "system",
      action: "workforce.webhook_endpoint_created",
      outcome: "success",
      entityRef: `webhook_endpoint:${row.id}`,
      correlationId: idFactory.correlation(`webhook_register_${row.id}`),
      source: "live",
      detail: {
        url: body.url,
        subscribedEvents,
        createdBy: session.user.email,
      },
    });
  } catch { /* best-effort */ }

  return NextResponse.json({
    ok: true,
    endpoint: {
      id: row.id,
      name: row.name,
      url: row.url,
      subscribedEvents,
      createdAt: row.createdAt,
      /** Shown ONCE — capture for the integrator's signature verifier. */
      secret,
    },
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false, reason: "admin_required" }, { status: 403 });
  }

  const organizationId = req.nextUrl.searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.json({ ok: false, reason: "organizationId_required" }, { status: 400 });
  }

  const rows = await prisma.webhookEndpoint.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      url: true,
      subscribedEvents: true,
      consecutiveFailures: true,
      autoDisableThreshold: true,
      createdBy: true,
      revokedAt: true,
      revokedReason: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, endpoints: rows });
}
