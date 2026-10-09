import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { executeAirflowAutomation } from "@/lib/integrations/airflow/automationExecutor";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:trigger", requiredCapability: "agent:approve", route: "POST /api/desktop/airflow/executions/[id]/approve", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const { id } = await context.params;
  const execution = await prisma.airflowAutomationExecution.findFirst({ where: { id, organizationId: String(session.organizationId), status: "pending_approval" } });
  if (!execution) return NextResponse.json({ ok: false, error: "execution_not_awaiting_approval" }, { status: 409 });
  const result = await executeAirflowAutomation(id, String(session.userId));
  return NextResponse.json(result.ok ? { ok: true, data: result.result } : { ok: false, error: result.error }, { status: result.ok ? 200 : 502 });
}
