import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { buildReleaseListResponse, type ReleaseListRepo } from "@/lib/releaseops/releaseListResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Paired-desktop equivalent of the release workspace list. */
export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/release-workspace",
    allowApiKey: false,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const r = await buildReleaseListResponse(
    prisma as unknown as ReleaseListRepo,
    String(session.organizationId),
    { correlationId: `desktop_release_list_${Date.now().toString(36)}` },
  );
  return NextResponse.json(r.body, { status: r.status });
}
