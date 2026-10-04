/**
 * POST /api/orchestration/approvals/[id]/decide
 *
 * Decides an approval (approve or reject). Auth-gated, tenant-scoped,
 * and role-gated. The engine enforces transition rules (rejected
 * approvals cannot be reused; expired approvals cannot be decided).
 *
 * Body: { decision: "approved" | "rejected", reason?: string }
 *
 * `approverRole` is intentionally NOT accepted from the client — the
 * audit record must reflect the policy-assigned role
 * (ApprovalRequest.approverRole), never a self-reported one. A prior
 * version trusted a client-supplied approverRole here, which would
 * have let any caller stamp a higher-authority role onto their own
 * decision's audit trail.
 *
 * Tenant check: getApproval() reads a single process-wide in-memory
 * store by id with no built-in tenant filter (unlike listApprovals(),
 * which the sibling GET /api/orchestration/approvals route scopes by
 * tenantId). Without the check below, any authenticated user from any
 * tenant could decide another tenant's approval by id — collapses to
 * 404 on mismatch, matching the no-enumeration pattern used by
 * /api/v1/pipelines/runs/[id]/decide.
 */

import { NextRequest, NextResponse } from "next/server";
import { decideApproval, getApproval } from "@/lib/approvals/approvalEngine";
import { currentContext } from "@/lib/auth/currentContext";
import { canDecideApprovals } from "@/lib/auth/platformAdmin";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

interface Body {
  decision: "approved" | "rejected";
  reason?: string;
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
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    if (!canDecideApprovals({ email: ctx.email, roles: ctx.roles })) {
      throw AxiomErrors.policy("authz.role_required", "Your role cannot decide approvals.");
    }

    const { id } = await params;
    const existing = getApproval(id);
    if (!existing || existing.tenantId !== String(ctx.organizationId)) {
      throw AxiomErrors.notFound("approval.not_found", "Approval not found.");
    }

    const body = await req.json().catch(() => null);
    if (!isValidBody(body)) throw AxiomErrors.validation("approval.decision_bad_input", "Body must be { decision: 'approved' | 'rejected' }.");

    const outcome = decideApproval({
      approvalId: id,
      decision: body.decision,
      reason: body.reason?.slice(0, 240),
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
