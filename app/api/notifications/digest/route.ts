/**
 * GET /api/notifications/digest
 *
 * Aggregates the tenant-scoped OutboundNotificationRecord rows over
 * the last `windowHours` (default 168, capped at 720) into an
 * operator-readable digest. Read-only.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { buildOutboundDigest, type RawOutboundRow } from "@/lib/notifications/outboundDigestBuilder";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

const HOURS_MIN = 1;
const HOURS_MAX = 720;
const ROW_CAP = 5000;

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const raw = Number.parseInt(req.nextUrl.searchParams.get("windowHours") ?? "168", 10);
    const windowHours = Number.isFinite(raw) ? Math.max(HOURS_MIN, Math.min(raw, HOURS_MAX)) : 168;
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    let rows: RawOutboundRow[] = [];
    try {
      const found = await prisma.outboundNotificationRecord.findMany({
        where: { organizationId: String(ctx.organizationId), createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        select: {
          kind: true, severity: true, outcome: true,
          dedupeKey: true, correlationId: true, createdAt: true,
        },
        take: ROW_CAP,
      });
      rows = found.map((r) => ({
        kind: r.kind,
        severity: r.severity,
        outcome: r.outcome,
        dedupeKey: r.dedupeKey,
        correlationId: r.correlationId ?? null,
        createdAt: r.createdAt.toISOString(),
      }));
    } catch {
      rows = [];
    }

    const report = buildOutboundDigest(rows);
    return apiOk({ windowHours, ...report }, {
      correlationId,
      safetyContract: "audit_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "audit_read_only" });
  }
}
