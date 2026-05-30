/**
 * GET /api/dashboard/activity
 *
 * Compact recent-activity feed for the dashboard. Returns the 8
 * most-recent SecureAuditRecord rows scoped to the tenant. Tuned
 * for the dashboard's hero — small payload, fast read, never errors
 * even when the table isn't migrated.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ActivityEntry {
  id: string;
  action: string;
  outcome: string;
  occurredAt: string;
  entityRef: string | null;
}

export async function GET() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: true, entries: [] });
  }

  try {
    const rows = await (prisma as unknown as {
      secureAuditRecord: {
        findMany: (args: unknown) => Promise<Array<{
          id: string;
          action: string;
          outcome: string;
          occurredAt: Date;
          entityRef: string | null;
        }>>;
      };
    }).secureAuditRecord.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { occurredAt: "desc" },
      take: 8,
      select: {
        id: true,
        action: true,
        outcome: true,
        occurredAt: true,
        entityRef: true,
      },
    });
    const entries: ActivityEntry[] = rows.map((r) => ({
      id: r.id,
      action: r.action,
      outcome: r.outcome,
      occurredAt: r.occurredAt.toISOString(),
      entityRef: r.entityRef,
    }));
    return NextResponse.json({ ok: true, entries });
  } catch {
    return NextResponse.json({ ok: true, entries: [] });
  }
}
