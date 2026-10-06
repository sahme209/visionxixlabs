/**
 * GET /api/dashboard/environment-list
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { buildEnvironmentListResponse } from "@/lib/releaseops/environmentListResponder";
import type { EnvironmentListRepo } from "@/lib/releaseops/environmentListResponder";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const r = await buildEnvironmentListResponse(
    prisma as unknown as EnvironmentListRepo,
    ctx.organizationId,
  );
  return NextResponse.json(r.body, { status: r.status });
}
