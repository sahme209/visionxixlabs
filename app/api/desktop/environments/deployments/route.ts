import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { serializeDeploymentExecution, type DeploymentExecutionRepo } from "@/lib/releaseops/deploymentExecutionResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/environments/deployments",
    allowApiKey: false,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const environmentId = request.nextUrl.searchParams.get("environmentId")?.trim() || undefined;
  const repo = prisma as unknown as DeploymentExecutionRepo;
  const executions = await repo.deploymentExecution.findMany({
    where: { organizationId: String(session.organizationId), ...(environmentId ? { environmentId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ ok: true, data: { executions: executions.map(serializeDeploymentExecution) } });
}
