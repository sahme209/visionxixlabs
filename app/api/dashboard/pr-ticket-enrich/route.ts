/**
 * POST /api/dashboard/pr-ticket-enrich — Phase 472.
 *
 * Re-scans recent PRs against all ChangeTicket rows in the org and
 * writes back ticket.linkedPrRecordIds[] when the link set differs.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildPrTicketEnrichResponse,
  type PrTicketEnrichRepo,
} from "@/lib/releaseops/prTicketEnrichResponder";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const r = await buildPrTicketEnrichResponse(
    prisma as unknown as PrTicketEnrichRepo,
    { organizationId: ctx.organizationId },
  );
  return NextResponse.json(r.body, { status: r.status });
}
