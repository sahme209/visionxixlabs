import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { requireCurrentRestartReview } from "@/lib/integrations/airflow/restartReviewIO";
import type { AirflowRestartReviewDto } from "@/lib/integrations/airflow/restartReviewDto";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", requiredCapability: "workspace:read", route: "GET /api/desktop/airflow/executions/[id]/review", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401, headers });
  const { id } = await context.params;
  const execution = await prisma.airflowAutomationExecution.findFirst({ where: { id, organizationId: String(session.organizationId) }, include: { automation: true } });
  if (!execution) return NextResponse.json({ ok: false, error: "execution_not_found" }, { status: 404, headers });
  if (execution.automation.actionType !== "deploy" || !execution.automation.enabled) return NextResponse.json({ ok: false, error: "airflow_restart_review_stale" }, { status: 409, headers });
  try {
    const review = await requireCurrentRestartReview(prisma, execution, execution.automation);
    const data: AirflowRestartReviewDto = { executionId: id, digest: review.digest, requestedOperation: "service_restart", source: review.payload.source,
      repositoryFullName: execution.automation.repositoryFullName, sourceRef: execution.automation.sourceRef,
      dependencyPolicy: "latest_run_freshness", target: review.payload.target };
    return NextResponse.json({ ok: true, data }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const bounded = ["airflow_review_required", "airflow_review_changed", "airflow_restart_review_stale"].includes(message);
    return NextResponse.json({ ok: false, error: bounded ? message : "airflow_review_storage_unavailable" }, { status: bounded ? 409 : 503, headers });
  }
}
