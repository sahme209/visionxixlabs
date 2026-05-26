/**
 * GET /api/dashboard/release-list — Phase 447.
 *
 * Session-auth (cookie) route that returns recent releases + readiness
 * + evidence summaries for the operator's org. Mirrors the responder
 * pattern from Phase 422/432.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { buildReleaseListResponse } from "@/lib/releaseops/releaseListResponder";
import type { ReleaseListRepo } from "@/lib/releaseops/releaseListResponder";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const correlationId = `dash_release_list_${Date.now().toString(36)}`;
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const r = await buildReleaseListResponse(
    prisma as unknown as ReleaseListRepo,
    ctx.organizationId,
    { correlationId },
  );
  return NextResponse.json(r.body, { status: r.status });
}
