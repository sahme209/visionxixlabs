import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { loadAirflowClient } from "@/lib/integrations/airflow/connection";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest, context: { params: Promise<{ dagId: string; runId: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", requiredCapability: "workspace:read", route: "GET /api/desktop/airflow/dags/[dagId]/runs/[runId]/tasks", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const { dagId, runId } = await context.params;
  const raw = request.nextUrl.searchParams.get("offset") ?? "0";
  const offset = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(offset) || [dagId, runId].some((id) => !id.trim() || id === "~")) return NextResponse.json({ ok: false, error: "airflow_task_selection_invalid" }, { status: 400 });
  try {
    const { client } = await loadAirflowClient(String(session.organizationId));
    return NextResponse.json({ ok: true, data: await client.listTaskInstances(dagId, runId, offset) });
  } catch {
    // Provider errors can contain sensitive payloads; expose a fixed safe code.
    return NextResponse.json({ ok: false, error: "airflow_tasks_unavailable" }, { status: 502 });
  }
}
