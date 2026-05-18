/**
 * GET /api/intelligence/approval-packets
 *
 * Returns the canonical Approval Packet Report — one operator-ready
 * packet per approval-eligible decision. Pure read-only composition
 * over PriorityReport + AxiomOSState. Tenant-scoped.
 *
 * The view never executes a change. Approving still happens through
 * the existing /api/orchestration/approvals decide endpoint (audited).
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildApprovalPackets } from "@/lib/intelligence/approvalPacketBuilder";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await buildApprovalPackets({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return NextResponse.json(apiSuccess(report), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return GET(); }
