/**
 * POST /api/desktop/agent/actions/[id]/approve
 *
 * The only route in the entire agent runtime that can turn a proposal
 * into a real GitHub/AWS write action. Admin/owner-only — a proposal
 * the agent raised for one user still requires an admin's explicit
 * approval, the same authority bar as every other write action in this
 * codebase (GitHub branch/PR/commit, AWS deploy trigger).
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { decideAgentAction } from "@/lib/axiom/agentRuntime/browserApprovalDecision";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/agent/actions/[id]/approve",
    allowApiKey: false,
    requiredCapability: "agent:approve",
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const { id } = await params;
  const result = await decideAgentAction({ organizationId: String(session.organizationId), proposalId: id, actorUserId: String(session.userId), actorRole: session.role ?? "unknown", decision: "approve", correlationId: request.headers.get("x-correlation-id") ?? undefined });
  if (!result.ok) return NextResponse.json(result, { status: result.error === "not_found" ? 404 : result.error === "self_approval_forbidden" ? 403 : result.error === "approval_expired" ? 410 : 409 });
  return NextResponse.json({ ok: true, data: { id, status: result.status, errorMessage: result.errorMessage ?? null } });
}
