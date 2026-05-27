/**
 * GET /api/dashboard/manual-fix-list — Phase 495.
 *
 * Optional ?releaseId=<id> narrows to a single release's manual fixes.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildManualFixListResponse,
  type ManualFixRepo,
} from "@/lib/releaseops/manualFixResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const url = new URL(req.url);
  const releaseIdParam = url.searchParams.get("releaseId");
  const input: { organizationId: string; releaseId?: string | null } = {
    organizationId: ctx.organizationId,
  };
  if (releaseIdParam) input.releaseId = releaseIdParam;

  const r = await buildManualFixListResponse(
    prisma as unknown as ManualFixRepo,
    input,
  );
  return NextResponse.json(r.body, { status: r.status });
}
