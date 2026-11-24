import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readBoundedRequestJson } from "@/lib/api/readBoundedRequestJson";
import { changeDraftSourceSchema, ticketLinkId, type ChangeDraftSource } from "@/lib/tauri/ticketDirectoryContract";
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
    try { raw = await readBoundedRequestJson(request, AbortSignal.any([request.signal, AbortSignal.timeout(5000)]), 80 * 1024); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    const { sourceChangeTicketId, sourceTicket: claimedSource, ...draftFields } = raw as Record<string, unknown>;
    if (claimedSource !== undefined) return NextResponse.json({ok: false, error: "invalid_payload"}, {status: 400});
    let sourceTicket: ChangeDraftSource | undefined;
    if (sourceChangeTicketId !== undefined) {
      const id = ticketLinkId.safeParse(sourceChangeTicketId);
      if (!id.success || session.credentialKind !== "desktop_session") {
        return NextResponse.json({ok: false, error: "invalid_payload"}, {status: 400});
      }
      const row = await prisma.changeTicket.findFirst({
        where: {id: id.data, organizationId: String(session.organizationId)},
        select: {id: true, organizationId: true, provider: true, externalKey: true},
      });
      const source = changeDraftSourceSchema.safeParse(row && {id: row.id, provider: row.provider, reference: row.externalKey});
      if (!source.success || row?.id !== id.data || row.organizationId !== session.organizationId) {
        return NextResponse.json({ok: false, error: "source_ticket_unavailable"}, {status: 404});
      }
      const current = await resolveRequestDesktopSession(request, {
        requiredScope: "pipeline:trigger", route: "POST /api/desktop/deployments/drafts",
        allowApiKey: false, requireWorkspaceMembership: true, recordHeartbeat: false,
      });
      if (current?.credentialKind !== "desktop_session" || current.id !== session.id ||
        current.organizationId !== session.organizationId || current.userId !== session.userId) {
        return NextResponse.json({ok: false, error: "desktop_session_changed"}, {status: 403});
      }
      sourceTicket = source.data;
    }
    const parsed = parseReleaseResolutionDraft({ ...draftFields, sourceTicket, kind: "resolution_draft", schemaVersion: 1, id: `tdr_${crypto.randomUUID().replaceAll("-", "")}`, tenantId: String(session.organizationId) });
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
