/**
 * POST /api/dashboard/manual-fix-log — Phase 495.
 * Body: { summary, fixedAtIso, environmentTier, releaseId? }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildManualFixLogResponse,
  type ManualFixRepo,
} from "@/lib/releaseops/manualFixResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  let body: {
    summary?: unknown;
    fixedAtIso?: unknown;
    environmentTier?: unknown;
    releaseId?: unknown;
  } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const summary = typeof body.summary === "string" ? body.summary : null;
  const fixedAtIso = typeof body.fixedAtIso === "string" ? body.fixedAtIso : null;
  const environmentTier = typeof body.environmentTier === "string" ? body.environmentTier : null;

  if (!summary || !fixedAtIso || !environmentTier) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { summary, fixedAtIso, environmentTier, releaseId? }." },
      { status: 400 },
    );
  }

  const r = await buildManualFixLogResponse(
    prisma as unknown as ManualFixRepo,
    {
      organizationId: ctx.organizationId,
      loggedByUserId: ctx.userId,
      summary, fixedAtIso, environmentTier,
      ...(typeof body.releaseId === "string" ? { releaseId: body.releaseId } : {}),
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
