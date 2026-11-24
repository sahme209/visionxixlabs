import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { savedReleaseLocatorSchema } from "@/lib/tauri/deploymentRequestSummary";
import { readReleaseBatchTasks, type ReleaseBatchReadinessRepo } from "@/lib/integrations/airflow/releaseBatchReadiness";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authority = { requiredScope: "pipeline:read", requiredCapability: "workspace:read", route: "GET /api/desktop/deployments/:id/batch-tasks", allowApiKey: false } as const;
  const session = await resolveRequestDesktopSession(request, authority);
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const { id } = await context.params;
  const query = request.nextUrl.searchParams;
  const version = query.get("expectedVersion");
  const dagId = query.get("dagId");
  const dagRunId = query.get("dagRunId");
  const offset = query.get("offset");
  if (["expectedVersion", "dagId", "dagRunId", "offset"].some(key => query.getAll(key).length !== 1) ||
    !version || !/^[1-9]\d{0,8}$/.test(version) || !savedReleaseLocatorSchema.shape.id.safeParse(id).success ||
    !dagId || dagId === "~" || dagId.length > 250 || !dagRunId || dagRunId === "~" || dagRunId.length > 1000 ||
    offset === null || !/^\d{1,9}$/.test(offset)) {
    return NextResponse.json({ ok: false, error: "invalid_batch_task_selection" }, { status: 400 });
  }
  const data = await readReleaseBatchTasks(prisma as unknown as ReleaseBatchReadinessRepo, {
    organizationId: String(session.organizationId), requestId: id, expectedVersion: Number(version), dagId, dagRunId, offset: Number(offset), signal: request.signal,
  });
  if (!data) return NextResponse.json({ ok: false, error: "batch_tasks_unavailable" }, { status: 409 });
  const current = await resolveRequestDesktopSession(request, authority);
  if (!current || current.userId !== session.userId || current.organizationId !== session.organizationId || request.signal.aborted) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
}
