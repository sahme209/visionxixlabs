/**
 * GET /api/dashboard/release-detail/[id]?repositoryId=... — Phase 482.
 *
 * Aggregated overview of a single release: metadata, latest readiness
 * snapshot, cherry-picks, policy violations, linked tickets, evidence
 * pack. One round-trip for the per-release overview page.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildReleaseDetailResponse,
  type ReleaseDetailRepo,
} from "@/lib/releaseops/releaseDetailResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await currentContext();
  if (!session.isAuthenticated || !session.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const { id: releaseId } = await ctx.params;
  const repositoryId = req.nextUrl.searchParams.get("repositoryId") ?? undefined;

  const r = await buildReleaseDetailResponse(
    prisma as unknown as ReleaseDetailRepo,
    {
      organizationId: session.organizationId,
      releaseId,
      ...(repositoryId ? { repositoryId } : {}),
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
