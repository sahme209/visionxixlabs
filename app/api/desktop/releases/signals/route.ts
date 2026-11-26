import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { loadSignalConnection } from "@/lib/integrations/signals/signalConnection";
import { readReleaseSignals } from "@/lib/integrations/signals/releaseSignals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { headers: { "Cache-Control": "no-store" } };
const RELEASE = /^[A-Za-z0-9._+@:-]{1,200}$/;
const SHA = /^[0-9a-f]{40}$/i;

/**
 * GET /api/desktop/releases/signals?release=<name>[&commit=<40-hex>]
 * Release health from the workspace's connected read-only signals (incidents, new errors, monitors,
 * stale flags) plus Verify-stage check results for the commit. Workspace readers only. Reads nothing
 * from a provider that is not connected, and changes nothing anywhere.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", requiredCapability: "workspace:read", route: "GET /api/desktop/releases/signals", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const release = request.nextUrl.searchParams.get("release")?.trim() ?? "";
  const commit = request.nextUrl.searchParams.get("commit")?.trim() ?? "";
  if (!RELEASE.test(release) || (commit && !SHA.test(commit))) return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 });
  const organizationId = String(session.organizationId);
  const verifyChecks = commit
    ? await (async () => {
        const rows = await prisma.deploymentCheckResult.findMany({ where: { organizationId, releaseRef: commit.toLowerCase(), stage: "verify" }, orderBy: { reportedAt: "desc" }, take: 200, select: { checkKey: true, status: true } });
        const latest = new Map<string, string>();
        for (const r of rows) if (!latest.has(r.checkKey)) latest.set(r.checkKey, r.status);
        return [...latest.entries()].map(([key, status]) => ({ key, status }));
      })().catch(() => null)
    : null;
  const signals = await readReleaseSignals((provider) => loadSignalConnection(organizationId, provider), { release, verifyChecks, now: new Date() });
  return NextResponse.json({ ok: true, data: signals }, noStore);
}
