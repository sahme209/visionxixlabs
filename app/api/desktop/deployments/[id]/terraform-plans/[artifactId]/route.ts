import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { readTerraformPlans } from "@/lib/terraform/customerPlanRead";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; artifactId: string }> }): Promise<NextResponse> {
  const headers = { "cache-control": "no-store" };
  try {
    const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", requiredCapability: "workspace:read", allowApiKey: false, route: "GET /api/desktop/deployments/:id/terraform-plans/:artifactId" });
    if (!session || session.credentialKind !== "desktop_session") return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401, headers });
    const { id, artifactId } = await params;
    const result = await readTerraformPlans(prisma, { organizationId: String(session.organizationId), userId: String(session.userId), sessionId:session.id }, id, artifactId,()=>new Date(),request.signal);
    return NextResponse.json(result.body, { status: result.status, headers });
  } catch { return NextResponse.json({ ok: false, error: "saved_plan_read_unavailable" }, { status: 503, headers }); }
}
