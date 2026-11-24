import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { readReleaseBatchDeclarations, readReleaseBatchReadiness, type ReleaseBatchReadinessRepo } from "@/lib/integrations/airflow/releaseBatchReadiness";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Read-only exact-run evidence; no execution, approval or automatic scheduling. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const authority = { requiredScope: "pipeline:read", requiredCapability: "workspace:read", route: "GET /api/desktop/deployments/:id/batch-readiness", allowApiKey: false } as const;
  const session = await resolveRequestDesktopSession(request, authority);
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const version = request.nextUrl.searchParams.get("expectedVersion") ?? "";
  const timing = request.nextUrl.searchParams.getAll("includeTiming");
  if (timing.length && (timing.length !== 1 || timing[0] !== "1")) {
    return NextResponse.json({ ok: false, error: "invalid_run_timing_selection" }, { status: 400 });
  }
  const declarations = request.nextUrl.searchParams.getAll("includeSavedRuns");
  if (declarations.length && (declarations.length !== 1 || declarations[0] !== "1")) {
    return NextResponse.json({ ok: false, error: "invalid_saved_run_selection" }, { status: 400 });
  }
  const { id } = await context.params;
  if (!/^[1-9]\d{0,8}$/.test(version) || !id.trim() || id.length > 160) return NextResponse.json({ ok: false, error: "invalid_release_version" }, { status: 400 });
  try {
    const repo = prisma as unknown as ReleaseBatchReadinessRepo;
    const selection = { organizationId: String(session.organizationId), requestId: id, expectedVersion: Number(version), signal: request.signal };
    let data = await readReleaseBatchReadiness(repo, { ...selection, includeRuns: true, ...(timing.length === 1 && { includeTiming: true }) });
    if (declarations.length && !data.ready && data.reason === "unavailable" && !data.observations) {
      const saved = await readReleaseBatchDeclarations(repo, selection);
      if (saved) data = { ...data, declarations: saved };
    }
    if (data.observations || data.declarations || (!data.ready && data.reason === "changed")) {
      const current = await resolveRequestDesktopSession(request, authority);
      if (!current || current.userId !== session.userId || current.organizationId !== session.organizationId || request.signal.aborted) {
        return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
      }
    }
    return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ ok: false, error: "release_batch_readiness_unavailable" }, { status: 502 }); }
}
