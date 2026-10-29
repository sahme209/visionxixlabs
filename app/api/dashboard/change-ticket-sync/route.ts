/**
 * POST /api/dashboard/change-ticket-sync — Phase 470.
 *
 * Body: { provider: "linear" | "jira" | "servicenow" }
 *
 * Legacy host credentials cannot authorize a tenant sync. Dedicated
 * tenant-owned integrations must be used until this route has a scoped adapter.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import {
  ALL_CHANGE_TICKET_PROVIDERS,
} from "@/lib/releaseops/providers/changeTicketProjectors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: unknown = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const providerRaw = body && typeof body === "object" && "provider" in body && typeof body.provider === "string" ? body.provider : null;
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
  if (providerRaw === "other") {
    return NextResponse.json({ok:false,error:"unsupported_provider",hint:"'other' provider has no sync implementation."},{status:400,headers:{"Cache-Control":"private, no-store"}});
  }
  // Host-wide environment credentials are not evidence of this tenant's consent.
  // Keep internal fetchers intact, but never dispatch or persist through them here.
  return NextResponse.json({ok:false,error:"tenant_connection_required"},{status:409,headers:{"Cache-Control":"private, no-store"}});
}
