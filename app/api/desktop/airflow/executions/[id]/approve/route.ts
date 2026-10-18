import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { executeAirflowAutomation } from "@/lib/integrations/airflow/automationExecutor";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:trigger", requiredCapability: "agent:approve", route: "POST /api/desktop/airflow/executions/[id]/approve", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const { id } = await context.params;
  const execution = await prisma.airflowAutomationExecution.findFirst({ where: { id, organizationId: String(session.organizationId), status: "pending_approval" }, include: { automation: true } });
  if (!execution) return NextResponse.json({ ok: false, error: "execution_not_awaiting_approval" }, { status: 409 });
  let expectedReviewDigest: string | undefined;
  if (execution.automation.actionType === "deploy") {
    const body = await request.json().catch(() => null);
    if (typeof body?.expectedReviewDigest !== "string" || !/^[a-f0-9]{64}$/.test(body.expectedReviewDigest)) return NextResponse.json({ ok: false, error: "airflow_review_required" }, { status: 409 });
    expectedReviewDigest = body.expectedReviewDigest;
  }
  const result = expectedReviewDigest === undefined ? await executeAirflowAutomation(id, String(session.userId)) : await executeAirflowAutomation(id, String(session.userId), expectedReviewDigest);
  const status = result.ok ? 200 : ["airflow_review_storage_unavailable", "airflow_execution_state_unconfirmed"].includes(result.error ?? "") ? 503 : ["airflow_review_required", "airflow_review_changed", "airflow_restart_review_stale"].includes(result.error ?? "") ? 409 : 502;
  return NextResponse.json(result.ok ? { ok: true, data: result.result } : { ok: false, error: result.error }, { status });
}
