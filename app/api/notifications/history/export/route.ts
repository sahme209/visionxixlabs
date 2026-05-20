/**
 * GET /api/notifications/history/export
 *
 * Streams the caller-tenant's outbound notification history as CSV.
 * Mirrors the rationale-CSV pattern: tenant-scoped, RFC 4180 quoted,
 * content-disposition attachment with a dated filename.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { buildOutboundHistoryCsv, type OutboundCsvRow } from "@/lib/notifications/outboundHistoryCsv";
import { resolveCorrelationId } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return new Response("Sign in required.", { status: 401 });
  }
  const raw = req.nextUrl.searchParams.get("limit");
  const limit = raw ? Number.parseInt(raw, 10) : 500;
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 1000)) : 500;

  let rows: Array<{
    id: string;
    dedupeKey: string;
    kind: string;
    severity: string;
    outcome: string;
    headline: string;
    channelsSucceeded: string[];
    channelsSkipped: string[];
    evidenceRefs: string[];
    correlationId: string | null;
    createdAt: Date;
  }> = [];
  try {
    rows = await prisma.outboundNotificationRecord.findMany({
      where: { organizationId: String(ctx.organizationId) },
      orderBy: { createdAt: "desc" },
      take: safeLimit,
    });
  } catch {
    // Empty CSV — caller still gets a header row.
  }

  const csvRows: OutboundCsvRow[] = rows.map((r) => ({
    id: r.id,
    dedupeKey: r.dedupeKey,
    kind: r.kind,
    severity: r.severity,
    outcome: r.outcome,
    headline: r.headline,
    channelsSucceeded: r.channelsSucceeded,
    channelsSkipped: r.channelsSkipped,
    evidenceRefs: r.evidenceRefs,
    correlationId: r.correlationId,
    createdAt: r.createdAt.toISOString(),
  }));
  const csv = buildOutboundHistoryCsv(csvRows);
  const filename = `axiom-outbound-history-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "x-correlation-id": correlationId,
      "x-axiom-safety-contract": "notification_read_only",
    },
  });
}

export async function POST(req: NextRequest) { return GET(req); }
