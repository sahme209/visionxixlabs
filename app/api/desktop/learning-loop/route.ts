/** Read-only, tenant-scoped learning-loop signals for paired desktop. */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { buildLearningLoopResponse, type LearningLoopRepo } from "@/lib/releaseops/learningLoopResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/learning-loop",
    allowApiKey: false,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const result = await buildLearningLoopResponse(
    prisma as unknown as LearningLoopRepo,
    String(session.organizationId),
  );
  return NextResponse.json(result.body, { status: result.status });
}
