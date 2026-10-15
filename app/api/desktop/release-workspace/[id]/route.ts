import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { buildReleaseDetailResponse, type ReleaseDetailRepo } from "@/lib/releaseops/releaseDetailResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/release-workspace/:id",
    allowApiKey: false,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const { id: releaseId } = await context.params;
  const repositoryId = request.nextUrl.searchParams.get("repositoryId") ?? undefined;
  const r = await buildReleaseDetailResponse(prisma as unknown as ReleaseDetailRepo, {
    organizationId: String(session.organizationId),
    releaseId,
    ...(repositoryId ? { repositoryId } : {}),
  });
  return NextResponse.json(r.body, { status: r.status });
}
