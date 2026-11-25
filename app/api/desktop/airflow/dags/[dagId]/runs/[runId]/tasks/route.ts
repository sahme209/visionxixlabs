import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { loadAirflowClient } from "@/lib/integrations/airflow/connection";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest, context: { params: Promise<{ dagId: string; runId: string }> }): Promise<Response> {
  const authority = {
    requiredScope: "pipeline:read",
    requiredCapability: "workspace:read",
    requireWorkspaceMembership: true,
    route: "GET /api/desktop/airflow/dags/[dagId]/runs/[runId]/tasks",
    allowApiKey: false,
  } as const;
  const session = await resolveRequestDesktopSession(request, authority);
  if (session?.credentialKind !== "desktop_session") {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }
  const { dagId, runId } = await context.params;
  const raw = request.nextUrl.searchParams.get("offset") ?? "0";
  const offset = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(offset) || [dagId, runId].some((id) => !id.trim() || id === "~")) return NextResponse.json({ ok: false, error: "airflow_task_selection_invalid" }, { status: 400 });
  try {
    request.signal.throwIfAborted();
    const connection = await loadAirflowClient(String(session.organizationId));
    const data = await connection.client.listTaskInstances(dagId, runId, offset, request.signal);
    await connection.assertCurrentConnection(request.signal);
    const current = await resolveRequestDesktopSession(request, { ...authority, recordHeartbeat: false });
    if (current?.credentialKind !== "desktop_session" || current.id !== session.id ||
        current.userId !== session.userId || current.organizationId !== session.organizationId || request.signal.aborted) {
      return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
    }
    return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Provider errors can contain sensitive payloads; expose a fixed safe code.
    return NextResponse.json({ ok: false, error: "airflow_tasks_unavailable" }, { status: 502 });
  }
}
