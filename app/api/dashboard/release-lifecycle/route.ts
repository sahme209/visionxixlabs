/**
 * POST /api/dashboard/release-lifecycle — Phase 491.
 *
 * Body: {
 *   releaseId: string,
 *   action: "finalize_scope" | "start_deploy" | "complete_deploy" | "mark_rolled_back" | "mark_failed"
 * }
 *
 * Transitions a release through the Phase 442 lifecycle. Records the
 * actor + timestamp on the relevant column (scopeFinalizedAt /
 * actualDeployStart / actualDeployEnd).
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildReleaseLifecycleResponse,
  ALL_LIFECYCLE_ACTIONS,
  type ReleaseLifecycleRepo,
  type LifecycleAction,
} from "@/lib/releaseops/releaseLifecycleResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: { releaseId?: unknown; action?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const releaseId = typeof body.releaseId === "string" ? body.releaseId : null;
  const actionRaw = typeof body.action === "string" ? body.action : null;
  if (!releaseId || !actionRaw || !(ALL_LIFECYCLE_ACTIONS as readonly string[]).includes(actionRaw)) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_payload",
        hint: `Body must contain { releaseId, action: ${ALL_LIFECYCLE_ACTIONS.join("|")} }.`,
      },
      { status: 400 },
    );
  }

  const r = await buildReleaseLifecycleResponse(
    prisma as unknown as ReleaseLifecycleRepo,
    {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      releaseId,
      action: actionRaw as LifecycleAction,
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
