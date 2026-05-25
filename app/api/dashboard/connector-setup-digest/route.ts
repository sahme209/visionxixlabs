/**
 * GET /api/dashboard/connector-setup-digest — Phase 423.
 *
 * Session-auth (cookie) sibling of /api/v1/connectors/setup-digest.
 * The dashboard panel can't carry an API key bearer token, so this
 * route resolves the org via NextAuth (`currentContext`) instead.
 *
 * Reuses the Phase 422 responder verbatim — so the response shape,
 * the migration_pending degradation, and the 500 envelope are
 * identical between the public v1 endpoint and the dashboard.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { buildSetupDigestResponse } from "@/lib/connectors/setupDigestResponder";
import type { SnapshotRepo } from "@/lib/connectors/connectorSetupSnapshot";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const correlationId = `dash_connector_setup_${Date.now().toString(36)}`;

  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const r = await buildSetupDigestResponse(
    prisma as unknown as SnapshotRepo,
    ctx.organizationId,
    { correlationId },
  );
  return NextResponse.json(r.body, { status: r.status });
}
