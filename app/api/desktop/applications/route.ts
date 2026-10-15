/** Paired-desktop application management. */
import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { buildApplicationListResponse, type ApplicationListRepo } from "@/lib/releaseops/applicationListResponder";
import { buildApplicationCreateResponse, type ApplicationCreateRepo } from "@/lib/releaseops/applicationCreateResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read", route: "GET /api/desktop/applications", allowApiKey: false,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const r = await buildApplicationListResponse(prisma as unknown as ApplicationListRepo, String(session.organizationId));
  return NextResponse.json(r.body, { status: r.status });
}

/** Registration changes shared release-governance inventory and is admin-only. */
export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read", route: "POST /api/desktop/applications", allowApiKey: false, requireWorkspaceAdmin: true,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const body = await request.json().catch(() => null) as { slug?: unknown; name?: unknown; ownerTeamLabel?: unknown; businessTier?: unknown; description?: unknown } | null;
  const slug = typeof body?.slug === "string" ? body.slug : null;
  const name = typeof body?.name === "string" ? body.name : null;
  if (!slug || !name) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });

  const r = await buildApplicationCreateResponse(prisma as unknown as ApplicationCreateRepo, {
    organizationId: String(session.organizationId), slug, name,
    ...(typeof body?.ownerTeamLabel === "string" ? { ownerTeamLabel: body.ownerTeamLabel } : {}),
    ...(typeof body?.businessTier === "string" ? { businessTier: body.businessTier } : {}),
    ...(typeof body?.description === "string" ? { description: body.description } : {}),
  });
  return NextResponse.json(r.body, { status: r.status });
}
