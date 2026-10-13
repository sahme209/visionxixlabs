/**
 * POST /api/desktop/agent/actions/[id]/reject
 *
 * Admin/owner-only, same bar as approve — a non-admin shouldn't be able
 * to silently dismiss another user's pending action either, since that
 * decision is itself part of the audit trail.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { decideAgentAction } from "@/lib/axiom/agentRuntime/browserApprovalDecision";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/agent/actions/[id]/reject",
    allowApiKey: false,
    requiredCapability: "agent:approve",
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const { id } = await params;
  const result = await decideAgentAction({ organizationId: String(session.organizationId), proposalId: id, actorUserId: String(session.userId), actorRole: session.role ?? "unknown", decision: "reject", correlationId: request.headers.get("x-correlation-id") ?? undefined });
  if (!result.ok) return NextResponse.json(result, { status: result.error === "not_found" ? 404 : result.error === "self_approval_forbidden" ? 403 : result.error === "approval_expired" ? 410 : 409 });
  return NextResponse.json({ ok: true, data: { id, status: result.status } });
}
