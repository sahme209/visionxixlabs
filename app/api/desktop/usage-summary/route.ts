/**
 * GET /api/desktop/usage-summary
 *
 * Live month-to-date AI usage for the desktop Plan & Usage section —
 * invocation count, token totals, and cost. Any paired session may
 * read its own workspace's usage; no admin gate needed since this is
 * read-only self-reporting, same posture as /api/desktop/billing.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { buildUsageSummaryResponse, type UsageSummaryRepo } from "@/lib/billing/usageSummaryResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/usage-summary",
    allowApiKey: false,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }
  const r = await buildUsageSummaryResponse(prisma as unknown as UsageSummaryRepo, String(session.organizationId));
  return NextResponse.json(r.body, { status: r.status });
}
