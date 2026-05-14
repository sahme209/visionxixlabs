/**
 * POST /api/orchestration/approvals/[id]/decide
 *
 * Decides an approval (approve or reject). Auth-gated. The engine
 * enforces transition rules (rejected approvals cannot be reused;
 * expired approvals cannot be decided).
 *
 * Body: { decision: "approved" | "rejected", reason?: string, approverRole?: ApproverRole }
 */

import { NextRequest, NextResponse } from "next/server";
import { decideApproval } from "@/lib/approvals/approvalEngine";
import type { ApproverRole } from "@/lib/approvals/approvalModel";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

interface Body {
  decision: "approved" | "rejected";
  reason?: string;
  approverRole?: ApproverRole;
}

function isValidBody(v: unknown): v is Body {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (o.decision === "approved" || o.decision === "rejected");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");

    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!isValidBody(body)) throw AxiomErrors.validation("approval.decision_bad_input", "Body must be { decision: 'approved' | 'rejected' }.");

    const outcome = decideApproval({
      approvalId: id,
      decision: body.decision,
      reason: body.reason?.slice(0, 240),
      approverRole: body.approverRole,
      approverUserId: ctx.userId ? String(ctx.userId) : undefined,
    });
    if (!outcome.allowed) {
      throw AxiomErrors.precondition("approval.decision_blocked", outcome.reason);
    }
    return NextResponse.json(apiSuccess(outcome), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    apiFailure(AxiomErrors.validation("method.not_allowed", "Use POST.")),
    { status: 405 },
  );
}
