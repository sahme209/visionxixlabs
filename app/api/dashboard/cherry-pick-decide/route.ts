/**
 * POST /api/dashboard/cherry-pick-decide — Phase 469.
 *
 * Body: { exceptionId: string, decision: "approve" | "deny", reason?: string }
 *
 * Approver decides a "requested" cherry-pick exception. The 2-person
 * rule (approver != requester) is enforced server-side in the
 * responder.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { canDecideApprovals } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import {
  buildCherryPickDecideResponse,
  type CherryPickDecideRepo,
} from "@/lib/releaseops/cherryPickDecideResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!canDecideApprovals({ email: ctx.email, roles: ctx.roles })) {
    return NextResponse.json({ ok: false, error: "forbidden_role" }, { status: 403 });
  }

  let body: { exceptionId?: unknown; decision?: unknown; reason?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const exceptionId = typeof body.exceptionId === "string" ? body.exceptionId : null;
  const decisionRaw = typeof body.decision === "string" ? body.decision : null;
  const reason = typeof body.reason === "string" ? body.reason : undefined;

  if (!exceptionId || (decisionRaw !== "approve" && decisionRaw !== "deny")) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { exceptionId, decision: 'approve' | 'deny', reason?: string }." },
      { status: 400 },
    );
  }

  const r = await buildCherryPickDecideResponse(
    prisma as unknown as CherryPickDecideRepo,
    {
      organizationId: ctx.organizationId,
      approverUserId: ctx.userId,
      exceptionId,
      decision: decisionRaw,
      ...(reason !== undefined ? { reason } : {}),
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
