/**
 * GET /api/dashboard/change-ticket-list — Phase 464.
 * Session-auth route over the ChangeTicket inbox.
 * Optional ?status=,sep,list and ?provider=,sep,list query params.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { buildChangeTicketListResponse } from "@/lib/releaseops/changeTicketListResponder";
import type { ChangeTicketListRepo } from "@/lib/releaseops/changeTicketListResponder";
import {
  ALL_CHANGE_TICKET_STATUSES,
  ALL_CHANGE_TICKET_PROVIDERS,
  type ChangeTicketStatus,
  type ChangeTicketProvider,
} from "@/lib/releaseops/providers/changeTicketProjectors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const statusParam = req.nextUrl.searchParams.get("status");
  const providerParam = req.nextUrl.searchParams.get("provider");
  const statusFilter: ChangeTicketStatus[] = statusParam
    ? statusParam.split(",").filter((s): s is ChangeTicketStatus =>
        (ALL_CHANGE_TICKET_STATUSES as readonly string[]).includes(s),
      )
    : [];
  const providerFilter: ChangeTicketProvider[] = providerParam
    ? providerParam.split(",").filter((p): p is ChangeTicketProvider =>
        (ALL_CHANGE_TICKET_PROVIDERS as readonly string[]).includes(p),
      )
    : [];

  const r = await buildChangeTicketListResponse(
    prisma as unknown as ChangeTicketListRepo,
    ctx.organizationId,
    {
      ...(statusFilter.length > 0 ? { statusFilter } : {}),
      ...(providerFilter.length > 0 ? { providerFilter } : {}),
      take: 200,
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
