/**
 * POST /api/desktop/agent/actions/[id]/reject
 *
 * Paired workspace readers may request stopping their own pending proposal.
 * The locked decision service requires current approver authority for any
 * other user's proposal; this entry never grants review permissions.
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
    requiredCapability: "workspace:read",
    requireWorkspaceMembership: true,
    recordHeartbeat: false,
    requireActiveAccess: false,
  });
  if (!session || session.credentialKind !== "desktop_session" || !session.userId || !session.organizationId) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const { id } = await params;
  const result = await decideAgentAction({ organizationId: String(session.organizationId), proposalId: id, actorUserId: String(session.userId), actorRole: session.role ?? "unknown", decision: "reject", correlationId: request.headers.get("x-correlation-id") ?? undefined });
  if (!result.ok) return NextResponse.json(result, { status: result.error === "not_found" ? 404 : (result.error === "self_approval_forbidden" || result.error === "approval_authority_required") ? 403 : result.error === "approval_expired" ? 410 : result.error === "approval_authority_unavailable" ? 503 : 409 });
  return NextResponse.json({ ok: true, data: { id, status: result.status } });
}
