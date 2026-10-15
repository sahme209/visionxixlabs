/** Read-only, tenant-scoped webhook delivery history for paired desktop. */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { buildWebhookDeliveryListResponse, type DeliveryListRepo } from "@/lib/releaseops/githubWebhookResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/webhook-deliveries",
    allowApiKey: false,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const result = await buildWebhookDeliveryListResponse(
    prisma as unknown as DeliveryListRepo,
    String(session.organizationId),
  );
  return NextResponse.json(result.body, { status: result.status });
}
