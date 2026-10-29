import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { readReleaseBatchReadiness, type ReleaseBatchReadinessRepo } from "@/lib/integrations/airflow/releaseBatchReadiness";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Read-only exact-run evidence; no execution, approval or automatic scheduling. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", requiredCapability: "workspace:read", route: "GET /api/desktop/deployments/:id/batch-readiness", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const version = request.nextUrl.searchParams.get("expectedVersion") ?? "";
  const { id } = await context.params;
  if (!/^[1-9]\d{0,8}$/.test(version) || !id.trim() || id.length > 160) return NextResponse.json({ ok: false, error: "invalid_release_version" }, { status: 400 });
  try {
    const data = await readReleaseBatchReadiness(prisma as unknown as ReleaseBatchReadinessRepo, { organizationId: String(session.organizationId), requestId: id, expectedVersion: Number(version) });
    return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ ok: false, error: "release_batch_readiness_unavailable" }, { status: 502 }); }
}
