/**
 * GET /api/dashboard/release-detail/[id]?repositoryId=... — Phase 482.
 *
 * Aggregated overview of a single release: metadata, latest readiness
 * snapshot, cherry-picks, policy violations, linked tickets, evidence
 * pack. One round-trip for the per-release overview page.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { browserReleaseScope } from "@/lib/releaseops/browserReleaseScope";
import { prisma } from "@/lib/db";
import {
  buildReleaseDetailResponse,
  type ReleaseDetailRepo,
} from "@/lib/releaseops/releaseDetailResponder";

export const dynamic = "force-dynamic";

function reply(body: unknown, status: number) {
  return NextResponse.json(body, {status, headers: {"Cache-Control": "private, no-store"}});
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = browserReleaseScope(await currentContext());
  if (!session) {
    return reply({ ok: false, error: "auth_required" }, 401);
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
  if (r.body.ok) {
    const current = browserReleaseScope(await currentContext());
    if (!current || current.userId !== session.userId || current.organizationId !== session.organizationId) {
      return reply({ ok: false, error: "workspace_context_changed" }, 403);
    }
  }
  return reply(r.body, r.status);
}
