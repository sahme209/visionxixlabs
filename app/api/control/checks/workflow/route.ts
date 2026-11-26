import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { MAX_CHECKS_PER_WORKSPACE } from "@/lib/releaseops/deploymentChecks";
import { CHECK_WORKFLOW_PATH, generateCheckWorkflow, type GeneratableCheck } from "@/lib/releaseops/deploymentCheckWorkflow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };

/**
 * GET: the GitHub Actions workflow generated from this workspace's checks, as JSON (default)
 * or as a YAML download (?format=yaml). Read-only: it never writes to a repository.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.roles.length) return NextResponse.json({ ok: false, error: "workspace_membership_required" }, { status: 403, headers: noStore });
  try {
    const rows = await prisma.deploymentCheck.findMany({ where: { organizationId: String(c.organizationId) }, take: MAX_CHECKS_PER_WORKSPACE, select: { key: true, name: true, kind: true, stage: true, mode: true, enabled: true, version: true, spec: true } });
    const out = generateCheckWorkflow(rows as unknown as GeneratableCheck[]);
    if (request.nextUrl.searchParams.get("format") === "yaml") {
      return new NextResponse(out.yaml, { headers: { ...noStore, "Content-Type": "text/yaml; charset=utf-8", "Content-Disposition": `attachment; filename="${CHECK_WORKFLOW_PATH.split("/").pop()}"` } });
    }
    return NextResponse.json({ ok: true, data: out }, { headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, error: "checks_unavailable" }, { status: 503, headers: noStore });
  }
}
