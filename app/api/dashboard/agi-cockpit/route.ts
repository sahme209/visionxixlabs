/**
 * GET /api/dashboard/agi-cockpit — Phase 508.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildAgiCockpitResponse,
  type AgiCockpitRepo,
} from "@/lib/releaseops/agiCockpitResponder";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const r = await buildAgiCockpitResponse(
    prisma as unknown as AgiCockpitRepo,
    ctx.organizationId,
  );
  return NextResponse.json(r.body, { status: r.status });
}
