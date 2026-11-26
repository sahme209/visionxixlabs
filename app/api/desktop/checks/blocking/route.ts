import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { CHECK_STAGES, MAX_CHECKS_PER_WORKSPACE } from "@/lib/releaseops/deploymentChecks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Read-only: blocking checks that must pass for a commit before a deployment can be dispatched. */
export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", route: "GET /api/desktop/checks/blocking", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  try {
    const before = CHECK_STAGES.slice(0, CHECK_STAGES.indexOf("deploy")) as string[];
    const rows = await prisma.deploymentCheck.findMany({ where: { organizationId: String(session.organizationId), enabled: true, mode: "blocking", stage: { in: before } }, take: MAX_CHECKS_PER_WORKSPACE, select: { key: true, name: true, kind: true, stage: true } });
    const checks = rows.sort((a, b) => before.indexOf(a.stage) - before.indexOf(b.stage) || a.key.localeCompare(b.key))
      .map((c) => ({ ...c, enforced: true }));
    return NextResponse.json({ ok: true, data: { checks } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "deployment_checks_unavailable" }, { status: 503 });
  }
}
