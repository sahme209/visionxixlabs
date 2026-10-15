/** Paired-desktop, tenant-scoped AI observability. */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { buildAiCallLogResponse, type AiCallLogRepo } from "@/lib/releaseops/aiCallLogResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/ai-call-log",
    allowApiKey: false,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const engineName = request.nextUrl.searchParams.get("engineName") ?? undefined;
  const takeRaw = request.nextUrl.searchParams.get("take");
  const take = takeRaw ? Number.parseInt(takeRaw, 10) : undefined;
  const result = await buildAiCallLogResponse(prisma as unknown as AiCallLogRepo, {
    organizationId: String(session.organizationId),
    ...(engineName ? { engineName } : {}),
    ...(typeof take === "number" && Number.isFinite(take) ? { take } : {}),
  });
  return NextResponse.json(result.body, { status: result.status });
}
