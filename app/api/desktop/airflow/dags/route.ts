import { publicAirflowError } from "@/lib/integrations/airflow/publicError";
import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { loadAirflowClient } from "@/lib/integrations/airflow/connection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", requiredCapability: "workspace:read", route: "GET /api/desktop/airflow/dags", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  try { return NextResponse.json({ ok: true, data: { dags: await (await loadAirflowClient(String(session.organizationId))).client.listDags() } }); }
  catch (error) { return NextResponse.json({ ok: false, error: publicAirflowError(error, "airflow_unavailable") }, { status: 502 }); }
}
