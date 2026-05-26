/**
 * POST /api/dashboard/cherry-pick-create — Phase 468.
 *
 * Body: {
 *   releaseId: string,
 *   repositoryId: string,
 *   rationale: string (>= 20 chars after trim),
 *   approvedPrIds: string[] (non-empty),
 *   excludedPrIds?: string[]
 * }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildCherryPickSubmitResponse,
  type CherryPickSubmitRepo,
} from "@/lib/releaseops/cherryPickSubmitResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: {
    releaseId?: unknown;
    repositoryId?: unknown;
    rationale?: unknown;
    approvedPrIds?: unknown;
    excludedPrIds?: unknown;
  } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const releaseId = typeof body.releaseId === "string" ? body.releaseId : null;
  const repositoryId = typeof body.repositoryId === "string" ? body.repositoryId : null;
  const rationale = typeof body.rationale === "string" ? body.rationale : null;
  const approvedPrIds = Array.isArray(body.approvedPrIds)
    ? body.approvedPrIds.filter((s): s is string => typeof s === "string")
    : null;
  const excludedPrIds = Array.isArray(body.excludedPrIds)
    ? body.excludedPrIds.filter((s): s is string => typeof s === "string")
    : [];

  if (!releaseId || !repositoryId || rationale === null || !approvedPrIds) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_payload",
        hint: "Body must contain { releaseId, repositoryId, rationale, approvedPrIds[], excludedPrIds[]? }.",
      },
      { status: 400 },
    );
  }

  const r = await buildCherryPickSubmitResponse(
    prisma as unknown as CherryPickSubmitRepo,
    {
      organizationId: ctx.organizationId,
      requestedByUserId: ctx.userId,
      releaseId,
      repositoryId,
      rationale,
      approvedPrIds,
      excludedPrIds,
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
