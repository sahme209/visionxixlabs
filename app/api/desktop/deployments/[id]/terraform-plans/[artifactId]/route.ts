import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { readSavedPlans } from "@/lib/terraform/savedPlanRead";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; artifactId: string }> }): Promise<NextResponse> {
  const headers = { "cache-control": "no-store" };
  try {
    const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", requiredCapability: "workspace:read", allowApiKey: false, route: "GET /api/desktop/deployments/:id/terraform-plans/:artifactId" });
    if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401, headers });
    const { id, artifactId } = await params;
    const result = await readSavedPlans(prisma, { organizationId: String(session.organizationId), requestId: id }, artifactId);
    return NextResponse.json(result.body, { status: result.status, headers });
  } catch { return NextResponse.json({ ok: false, error: "saved_plan_read_unavailable" }, { status: 503, headers }); }
}
