import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { checkRateLimit } from "@/lib/rateLimit";
import { resolveGovernedAiCall } from "@/lib/axiom/agentRuntime/governedAiCall";
import { GovernedAiCallRefusal } from "@/lib/axiom/agentRuntime/governedAiCallRefusal";
import { acceptCheckDraft, buildCheckDraftPrompt, CHECK_DRAFT_SCHEMA } from "@/lib/releaseops/checkDraftKernel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };

/**
 * POST: draft one deployment check from a description through the governed AI path (workspace
 * opt-in, provider policy and credit admission, all fail closed). Returns a validated draft only;
 * nothing is saved. Owners and admins, explicit per click.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false, error: "cross_origin_refused" }, { status: 403, headers: noStore });
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.sessionUserId || !c.roles.length) return NextResponse.json({ ok: false, error: "workspace_membership_required" }, { status: 403, headers: noStore });
  if (!isAdminOrOwner({ email: c.email, roles: c.roles })) return NextResponse.json({ ok: false, error: "workspace_admin_required" }, { status: 403, headers: noStore });
  const userId = String(c.sessionUserId), organizationId = String(c.organizationId);
  if (!checkRateLimit(`check-draft:${userId}`)) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: noStore });
  const body = await request.json().catch(() => null) as { description?: unknown } | null;
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  if (!description || description.length > 1500) return NextResponse.json({ ok: false, error: "description_required" }, { status: 400, headers: noStore });
  const governed = await resolveGovernedAiCall(organizationId, undefined, userId);
  if (!governed.ok) return NextResponse.json({ ok: false, error: governed.error }, { status: 200, headers: noStore });
  try {
    const { data } = await governed.extract<unknown>(buildCheckDraftPrompt(description), CHECK_DRAFT_SCHEMA, `check_draft_${Date.now().toString(36)}`);
    const verdict = acceptCheckDraft(data);
    if (!verdict.ok) return NextResponse.json({ ok: false, error: "draft_invalid", issues: verdict.errors.slice(0, 5) }, { status: 200, headers: noStore });
    return NextResponse.json({ ok: true, draft: verdict.check }, { headers: noStore });
  } catch (error) {
    if (error instanceof GovernedAiCallRefusal) return NextResponse.json({ ok: false, error: error.message }, { status: 200, headers: noStore });
    return NextResponse.json({ ok: false, error: "draft_unavailable" }, { status: 200, headers: noStore });
  }
}
