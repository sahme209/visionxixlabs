/**
 * POST /api/dashboard/change-ticket-sync — Phase 470.
 *
 * Body: { provider: "linear" | "jira" | "servicenow" }
 *
 * Linear is wired in Phase 470. Jira and ServiceNow fetchers slot in
 * via the same responder in follow-on phases — they 501 today.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildChangeTicketSyncResponse,
  type ChangeTicketSyncRepo,
  type ChangeTicketFetcherSet,
} from "@/lib/releaseops/changeTicketSyncResponder";
import { createLinearFetcher } from "@/lib/releaseops/linearFetcher";
import {
  ALL_CHANGE_TICKET_PROVIDERS,
  type ChangeTicketProvider,
} from "@/lib/releaseops/providers/changeTicketProjectors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: { provider?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const providerRaw = typeof body.provider === "string" ? body.provider : null;
  if (!providerRaw || !(ALL_CHANGE_TICKET_PROVIDERS as readonly string[]).includes(providerRaw)) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_payload",
        hint: `Body must contain { provider: ${ALL_CHANGE_TICKET_PROVIDERS.join("|")} }.`,
      },
      { status: 400 },
    );
  }
  const provider = providerRaw as ChangeTicketProvider;

  const fetchers: ChangeTicketFetcherSet = {};
  if (provider === "linear" && process.env.LINEAR_API_KEY) {
    fetchers.linear = createLinearFetcher();
  }
  // jira / servicenow fetchers land in follow-on phases.

  const r = await buildChangeTicketSyncResponse(
    prisma as unknown as ChangeTicketSyncRepo,
    fetchers,
    { organizationId: ctx.organizationId, provider },
  );
  return NextResponse.json(r.body, { status: r.status });
}
