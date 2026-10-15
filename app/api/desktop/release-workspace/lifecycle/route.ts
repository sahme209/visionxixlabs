import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { ALL_LIFECYCLE_ACTIONS, buildReleaseLifecycleResponse, type LifecycleAction, type ReleaseLifecycleRepo } from "@/lib/releaseops/releaseLifecycleResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Lifecycle transitions mutate a shared release record, so only workspace admins may invoke them. */
export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/release-workspace/lifecycle",
    allowApiKey: false,
    requireWorkspaceAdmin: true,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const body = await request.json().catch(() => null) as { releaseId?: unknown; action?: unknown } | null;
  const releaseId = typeof body?.releaseId === "string" ? body.releaseId : null;
  const action = typeof body?.action === "string" ? body.action : null;
  if (!releaseId || !action || !(ALL_LIFECYCLE_ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const r = await buildReleaseLifecycleResponse(prisma as unknown as ReleaseLifecycleRepo, {
    organizationId: String(session.organizationId), actorUserId: String(session.userId), releaseId, action: action as LifecycleAction,
  });
  return NextResponse.json(r.body, { status: r.status });
}
