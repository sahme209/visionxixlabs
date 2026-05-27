/**
 * GET /api/dashboard/readiness-list — Phase 481.
 * Latest readiness snapshot per release for the caller's org.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildReadinessListResponse,
  type ReadinessListRepo,
} from "@/lib/releaseops/readinessListResponder";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const r = await buildReadinessListResponse(
    prisma as unknown as ReadinessListRepo,
    ctx.organizationId,
  );
  return NextResponse.json(r.body, { status: r.status });
}
