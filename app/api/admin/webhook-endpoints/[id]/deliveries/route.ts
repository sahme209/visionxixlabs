/**
 * GET /api/admin/webhook-endpoints/[id]/deliveries — Phase 398.
 *
 * Returns the full per-attempt delivery timeline for a webhook
 * endpoint so the operator can debug "why didn't this event arrive?"
 * straight from the admin UI.
 *
 * Query params:
 *   ?limit=50          — page size (default 50, max 200)
 *   ?cursor=<id>       — cursor pagination (deliveryId from previous page)
 *   ?status=<status>   — filter to one status: queued|delivering|
 *                         delivered|retry|deadletter
 *   ?eventKind=<kind>  — filter to one WebhookEventKind
 *
 * Response:
 *   {
 *     ok: true,
 *     endpoint: { id, name, url, consecutiveFailures, revokedAt },
 *     deliveries: [...],
 *     nextCursor: <id> | null,
 *     summary: { byStatus, byOutcome, lastDeliveredAt, lastDeadletteredAt }
 *   }
 *
 * Gated by ADMIN_EMAILS.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const VALID_STATUS = new Set(["queued", "delivering", "delivered", "retry", "deadletter"]);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false, reason: "admin_required" }, { status: 403 });
  }

  const { id: endpointId } = await context.params;

  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { id: endpointId },
    select: {
      id: true, name: true, url: true,
      consecutiveFailures: true, autoDisableThreshold: true,
      revokedAt: true, revokedReason: true,
      organizationId: true, subscribedEvents: true,
      createdAt: true,
    },
  });
  if (!endpoint) {
    return NextResponse.json({ ok: false, reason: "endpoint_not_found" }, { status: 404 });
  }

  // Query params
  const limitRaw = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(limitRaw)))
    : DEFAULT_LIMIT;
  const cursor = req.nextUrl.searchParams.get("cursor");
  const statusFilter = req.nextUrl.searchParams.get("status");
  const eventKindFilter = req.nextUrl.searchParams.get("eventKind");

  const where: {
    endpointId: string;
    status?: string;
    eventKind?: string;
  } = { endpointId };
  if (statusFilter && VALID_STATUS.has(statusFilter)) {
    where.status = statusFilter;
  }
  if (eventKindFilter) {
    where.eventKind = eventKindFilter;
  }

  // Fetch (limit + 1) so we know if there's a next page.
  const rows = await prisma.webhookDelivery.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      eventId: true,
      eventKind: true,
      attemptNumber: true,
      status: true,
      outcomeKind: true,
      httpStatus: true,
      responseBodySnippet: true,
      errorMessage: true,
      attemptedAt: true,
      respondedAt: true,
      nextAttemptAt: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  // Summary: status / outcome counts across the endpoint's full history.
  // Pulled separately because the paginated rows above are a windowed view.
  const [byStatus, byOutcome, lastDelivered, lastDeadlettered] = await Promise.all([
    prisma.webhookDelivery.groupBy({
      by: ["status"],
      where: { endpointId },
      _count: { _all: true },
    }).catch(() => [] as Array<{ status: string; _count: { _all: number } }>),
    prisma.webhookDelivery.groupBy({
      by: ["outcomeKind"],
      where: { endpointId, outcomeKind: { not: null } },
      _count: { _all: true },
    }).catch(() => [] as Array<{ outcomeKind: string | null; _count: { _all: number } }>),
    prisma.webhookDelivery.findFirst({
      where: { endpointId, status: "delivered" },
      orderBy: { respondedAt: "desc" },
      select: { respondedAt: true },
    }).catch(() => null),
    prisma.webhookDelivery.findFirst({
      where: { endpointId, status: "deadletter" },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }).catch(() => null),
  ]);

  return NextResponse.json({
    ok: true,
    endpoint: {
      id: endpoint.id,
      name: endpoint.name,
      url: endpoint.url,
      organizationId: endpoint.organizationId,
      subscribedEvents: endpoint.subscribedEvents,
      consecutiveFailures: endpoint.consecutiveFailures,
      autoDisableThreshold: endpoint.autoDisableThreshold,
      revokedAt: endpoint.revokedAt,
      revokedReason: endpoint.revokedReason,
      createdAt: endpoint.createdAt,
    },
    deliveries: page,
    nextCursor,
    summary: {
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      byOutcome: Object.fromEntries(byOutcome.map((r) => [r.outcomeKind, r._count._all])),
      lastDeliveredAt: lastDelivered?.respondedAt ?? null,
      lastDeadletteredAt: lastDeadlettered?.updatedAt ?? null,
    },
  });
}
