import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveCorrelationId } from "@/lib/api/correlation";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { createReleaseResolutionDraft, parseReleaseResolutionDraft } from "@/lib/tauri/releaseResolutionDraft";
import type { DeploymentRequestRepo } from "@/lib/tauri/deploymentRequestRepo";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Saves unresolved intake only. It cannot create a playbook, approval or provider action. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:trigger", route: "POST /api/desktop/deployments/drafts", allowApiKey: false });
    if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
    let raw: unknown;
    try { raw = await request.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    const parsed = parseReleaseResolutionDraft({ ...raw, kind: "resolution_draft", schemaVersion: 1, id: `tdr_${crypto.randomUUID().replaceAll("-", "")}`, tenantId: String(session.organizationId) });
    if (!parsed.ok) return NextResponse.json({ ok: false, error: "invalid_payload", issues: parsed.issues }, { status: 400 });
    const correlationId = resolveCorrelationId(request.headers);
    const result = await createReleaseResolutionDraft(prisma as unknown as DeploymentRequestRepo, {
      organizationId: String(session.organizationId), requesterUserId: String(session.userId), actorRole: "requester", correlationId, draft: parsed.draft,
    });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: result.reason === "tenant_mismatch" ? 403 : result.reason === "correlation_conflict" ? 409 : 422 });
    return NextResponse.json({ ok: true, data: {
      id: result.request.id, title: result.request.title, status: result.request.status, version: result.request.version,
      correlationId: result.request.correlationId, submittedAt: null, replayed: result.replayed,
    } }, { status: result.replayed ? 200 : 201, headers: { "Cache-Control": "no-store", "x-correlation-id": correlationId } });
  } catch (cause) {
    const conflict = cause && typeof cause === "object" && "code" in cause && cause.code === "P2002";
    return NextResponse.json({ ok: false, error: conflict ? "request_idempotency_conflict_retry" : "release_draft_create_failed" }, { status: conflict ? 409 : 500 });
  }
}
