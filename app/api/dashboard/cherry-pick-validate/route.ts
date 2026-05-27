/**
 * POST /api/dashboard/cherry-pick-validate — Phase 492.
 *
 * Body: { exceptionId: string, validated: boolean }
 *
 * Toggles CherryPickException.hasFinalCommitValidation. Only legal on
 * approved exceptions.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildCherryPickValidateResponse,
  type CherryPickValidateRepo,
} from "@/lib/releaseops/cherryPickValidateResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: { exceptionId?: unknown; validated?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const exceptionId = typeof body.exceptionId === "string" ? body.exceptionId : null;
  const validated = typeof body.validated === "boolean" ? body.validated : null;

  if (!exceptionId || validated === null) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { exceptionId, validated: boolean }." },
      { status: 400 },
    );
  }

  const r = await buildCherryPickValidateResponse(
    prisma as unknown as CherryPickValidateRepo,
    { organizationId: ctx.organizationId, actorUserId: ctx.userId, exceptionId, validated },
  );
  return NextResponse.json(r.body, { status: r.status });
}
