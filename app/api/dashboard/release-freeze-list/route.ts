/**
 * GET /api/dashboard/release-freeze-list — Phase 462.
 * Session-auth route over the per-release freeze classification.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { buildReleaseFreezeListResponse } from "@/lib/releaseops/releaseFreezeListResponder";
import type { ReleaseFreezeListRepo } from "@/lib/releaseops/releaseFreezeListResponder";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const r = await buildReleaseFreezeListResponse(
    prisma as unknown as ReleaseFreezeListRepo,
    ctx.organizationId,
  );
  return NextResponse.json(r.body, { status: r.status });
}
