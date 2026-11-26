import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { OUTCOME_ROW_LIMIT, OUTCOME_WINDOW_DAYS, summarizeDeploymentOutcomes, type ExecutionOutcomeRow } from "@/lib/releaseops/deploymentOutcomeSummary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface OutcomeRepo { deploymentExecution: { count(args: { where: { organizationId: string; createdAt: { gte: Date; lt: Date } } }): Promise<number>; findMany(args: { where: { organizationId: string; createdAt: { gte: Date } }; orderBy: { createdAt: "desc" }; take: number; select: { status: true; conclusion: true; createdAt: true; completedAt: true } }): Promise<ExecutionOutcomeRow[]> } }

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", route: "GET /api/desktop/environments/deployments/outcome-summary", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  if ([...request.nextUrl.searchParams.keys()].length) return NextResponse.json({ ok: false, error: "outcome_summary_input_invalid" }, { status: 400 });
  try {
    const since = new Date(Date.now() - OUTCOME_WINDOW_DAYS * 86_400_000);
    const rows = await (prisma as unknown as OutcomeRepo).deploymentExecution.findMany({
      where: { organizationId: String(session.organizationId), createdAt: { gte: since } },
      orderBy: { createdAt: "desc" }, take: OUTCOME_ROW_LIMIT + 1,
      select: { status: true, conclusion: true, createdAt: true, completedAt: true },
    });
    const truncated = rows.length > OUTCOME_ROW_LIMIT;
    const previous = await (prisma as unknown as OutcomeRepo).deploymentExecution.count({
      where: { organizationId: String(session.organizationId), createdAt: { gte: new Date(since.getTime() - OUTCOME_WINDOW_DAYS * 86_400_000), lt: since } },
    });
    return NextResponse.json({ ok: true, data: summarizeDeploymentOutcomes(rows.slice(0, OUTCOME_ROW_LIMIT), truncated, new Date(), previous) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "outcome_summary_unavailable" }, { status: 503 });
  }
}
