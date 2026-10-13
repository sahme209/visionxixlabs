import { NextResponse, type NextRequest } from "next/server";

import { currentContext } from "@/lib/auth/currentContext";
import { canDecideApprovals } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { decideAgentAction } from "@/lib/axiom/agentRuntime/browserApprovalDecision";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  const context = await currentContext();
  if (!context.isAuthenticated || !context.userId || !context.organizationId || !context.email) {
    return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
  }
  if (!canDecideApprovals({ email: context.email, roles: context.roles })) {
    return NextResponse.json({ ok: false, error: "approver_role_required" }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as { decision?: unknown } | null;
  if (body?.decision !== "approve" && body?.decision !== "reject") {
    return NextResponse.json({ ok: false, error: "invalid_decision" }, { status: 400 });
  }
  const { id } = await params;
  const result = await decideAgentAction({
    organizationId: String(context.organizationId),
    proposalId: id,
    actorUserId: String(context.userId),
    actorRole: context.roles[0] ?? "platform_admin",
    decision: body.decision,
    correlationId: request.headers.get("x-correlation-id") ?? undefined,
  });
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : result.error === "self_approval_forbidden" ? 403 : result.error === "approval_expired" ? 410 : 409;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
