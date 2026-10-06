/**
 * POST /api/dashboard/drift-decide — Phase 487.
 *
 * Body: { findingId: string, action: "acknowledge" | "suppress" | "resolve", reason?: string }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { canDecideApprovals } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import {
  buildDriftDecideResponse,
  type DriftDecideRepo,
} from "@/lib/releaseops/driftDecideResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!canDecideApprovals({ email: ctx.email, roles: ctx.roles })) {
    return NextResponse.json({ ok: false, error: "forbidden_role" }, { status: 403 });
  }

  let body: { findingId?: unknown; action?: unknown; reason?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const findingId = typeof body.findingId === "string" ? body.findingId : null;
  const action =
    body.action === "acknowledge" || body.action === "suppress" || body.action === "resolve"
      ? body.action
      : null;
  const reason = typeof body.reason === "string" ? body.reason : undefined;

  if (!findingId || !action) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { findingId, action: 'acknowledge'|'suppress'|'resolve', reason? }." },
      { status: 400 },
    );
  }

  const r = await buildDriftDecideResponse(
    prisma as unknown as DriftDecideRepo,
    {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      findingId,
      action,
      ...(reason !== undefined ? { reason } : {}),
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
