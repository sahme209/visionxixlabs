/**
 * GET /api/dashboard/application-list — Phase 493.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildApplicationListResponse,
  type ApplicationListRepo,
} from "@/lib/releaseops/applicationListResponder";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const r = await buildApplicationListResponse(
    prisma as unknown as ApplicationListRepo,
    ctx.organizationId,
  );
  return NextResponse.json(r.body, { status: r.status });
}
