import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { MAX_RUNBOOKS, exportRunbooks, validateRunbook, type RunbookSpec } from "@/lib/releaseops/runbookLibrary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET: the workspace's runbooks as one file to keep in Git. Members can read. */
export async function GET(): Promise<NextResponse> {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.roles.length) return NextResponse.json({ ok: false, error: "workspace_membership_required" }, { status: 403 });
  try {
    const rows = await prisma.workspaceRunbook.findMany({ where: { organizationId: String(c.organizationId) }, orderBy: { key: "asc" }, take: MAX_RUNBOOKS, select: { key: true, title: true, trigger: true, steps: true, enabled: true } });
    // Only rows that still pass validation are exported, so the file always imports cleanly.
    const runbooks = rows.map((r) => validateRunbook(r)).filter((v): v is { ok: true; runbook: RunbookSpec } => v.ok).map((v) => v.runbook);
    return new NextResponse(exportRunbooks(runbooks), { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="v19-runbooks.json"', "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "runbooks_unavailable" }, { status: 503 });
  }
}
