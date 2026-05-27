/**
 * GET /api/dashboard/release-activity/[id] — Phase 488.
 * Chronological event timeline for one release, synthesized from
 * existing rows (no new event table).
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildReleaseActivityResponse,
  type ReleaseActivityRepo,
} from "@/lib/releaseops/releaseActivityResponder";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await currentContext();
  if (!session.isAuthenticated || !session.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const { id: releaseId } = await ctx.params;
  const r = await buildReleaseActivityResponse(
    prisma as unknown as ReleaseActivityRepo,
    { organizationId: session.organizationId, releaseId },
  );
  return NextResponse.json(r.body, { status: r.status });
}
