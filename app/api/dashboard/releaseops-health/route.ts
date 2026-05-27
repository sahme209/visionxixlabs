/**
 * GET /api/dashboard/releaseops-health — Phase 490.
 * Cross-subsystem health summary for the operator landing tile.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildHealthSummaryResponse,
  type HealthSummaryRepo,
} from "@/lib/releaseops/healthSummaryResponder";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const r = await buildHealthSummaryResponse(
    prisma as unknown as HealthSummaryRepo,
    ctx.organizationId,
  );
  return NextResponse.json(r.body, { status: r.status });
}
