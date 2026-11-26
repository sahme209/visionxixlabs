import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { MAX_CHECKS_PER_WORKSPACE } from "@/lib/releaseops/deploymentChecks";
import { summarizeCommitChecks } from "@/lib/releaseops/commitCheckSummary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Read-only: per commit, how many blocking checks passed, failed or have no result. Up to 50 commits. */
export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", route: "GET /api/desktop/checks/results", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const commits = [...new Set((request.nextUrl.searchParams.get("commits") ?? "").split(",").map((c) => c.trim().toLowerCase()).filter(Boolean))];
  if (commits.length === 0 || commits.length > 50 || commits.some((c) => !/^[0-9a-f]{40}$/.test(c))) return NextResponse.json({ ok: false, error: "invalid_commits" }, { status: 400 });
  try {
    const organizationId = String(session.organizationId);
    const blocking = await prisma.deploymentCheck.findMany({ where: { organizationId, enabled: true, mode: "blocking" }, take: MAX_CHECKS_PER_WORKSPACE, select: { key: true } });
    const keys = blocking.map((b) => b.key);
    const results = keys.length ? await prisma.deploymentCheckResult.findMany({ where: { organizationId, releaseRef: { in: commits }, checkKey: { in: keys } }, orderBy: { reportedAt: "desc" }, take: 2000, select: { checkKey: true, releaseRef: true, status: true, reportedAt: true } }) : [];
    return NextResponse.json({ ok: true, data: { commits: summarizeCommitChecks(commits, keys, results) } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "deployment_checks_unavailable" }, { status: 503 });
  }
}
