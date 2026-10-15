import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { buildReleaseActivityResponse, type ReleaseActivityRepo } from "@/lib/releaseops/releaseActivityResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/release-workspace/:id/activity",
    allowApiKey: false,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const { id: releaseId } = await context.params;
  const r = await buildReleaseActivityResponse(prisma as unknown as ReleaseActivityRepo, {
    organizationId: String(session.organizationId), releaseId,
  });
  return NextResponse.json(r.body, { status: r.status });
}
