/**
 * GET /api/dashboard/cherry-pick-list — Phase 461.
 * Session-auth route over the CherryPickException inbox.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { buildCherryPickListResponse } from "@/lib/releaseops/cherryPickListResponder";
import type { CherryPickListRepo } from "@/lib/releaseops/cherryPickListResponder";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const r = await buildCherryPickListResponse(
    prisma as unknown as CherryPickListRepo,
    ctx.organizationId,
  );
  return NextResponse.json(r.body, { status: r.status });
}
