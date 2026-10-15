/** Paired-desktop, tenant-scoped ReleaseOps audit history. */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { buildAuditEventListResponse, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/release-audit",
    allowApiKey: false,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const rawLimit = params.get("limit");
  const limit = rawLimit ? Math.max(1, Math.min(500, Number.parseInt(rawLimit, 10) || 200)) : undefined;
  const result = await buildAuditEventListResponse(prisma as unknown as AuditEventRepo, {
    organizationId: String(session.organizationId),
    ...(params.get("kind") ? { kind: params.get("kind")! } : {}),
    ...(limit !== undefined ? { limit } : {}),
  });
  return NextResponse.json(result.body, { status: result.status });
}
