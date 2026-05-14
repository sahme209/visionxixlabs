/**
 * GET  /api/orchestration/approvals
 * POST /api/orchestration/approvals  (request approval)
 *
 * GET returns the list of typed approval requests held by the in-memory
 * engine (scoped by tenant). POST creates a new approval via the policy
 * engine.
 */

import { NextResponse } from "next/server";
import { listApprovals, requestApproval, type RequestApprovalInput } from "@/lib/approvals/approvalEngine";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

function isValidBody(v: unknown): v is RequestApprovalInput {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.sourceType === "string"
    && typeof o.sourceId === "string"
    && typeof o.provider === "string"
    && typeof o.risk === "string"
    && typeof o.changeSummary === "string"
    && typeof o.policyInput === "object" && o.policyInput !== null;
}

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    const tenantId = ctx.organizationId ? String(ctx.organizationId) : undefined;
    const approvals = listApprovals({ tenantId });
    return NextResponse.json(apiSuccess({ approvals }), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");

    const body = await req.json().catch(() => null);
    if (!isValidBody(body)) throw AxiomErrors.validation("approval.bad_input", "Missing required approval fields.");

    const tenantId = ctx.organizationId ? String(ctx.organizationId) : undefined;
    const outcome = requestApproval({ ...body, tenantId, requesterUserId: ctx.userId ? String(ctx.userId) : undefined });
    return NextResponse.json(apiSuccess(outcome), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}
