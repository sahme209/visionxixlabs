/**
 * POST /api/dashboard/policy-violation-decide — Phase 479.
 *
 * Body: { violationId: string, action: "grant_exception" | "resolve", reason?: string }
 *
 * Approver-driven transition. Grant-exception requires a reason ≥10
 * chars and the rule.exceptionAllowed=true. Resolve is a no-question
 * cleanup.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildPolicyExceptionResponse,
  type PolicyExceptionRepo,
} from "@/lib/releaseops/policyExceptionResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: { violationId?: unknown; action?: unknown; reason?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const violationId = typeof body.violationId === "string" ? body.violationId : null;
  const action = body.action === "grant_exception" || body.action === "resolve" ? body.action : null;
  const reason = typeof body.reason === "string" ? body.reason : undefined;

  if (!violationId || !action) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { violationId, action: 'grant_exception' | 'resolve', reason? }." },
      { status: 400 },
    );
  }

  const r = await buildPolicyExceptionResponse(
    prisma as unknown as PolicyExceptionRepo,
    {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      violationId,
      action,
      ...(reason !== undefined ? { reason } : {}),
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
