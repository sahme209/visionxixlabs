import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveCorrelationId } from "@/lib/api/correlation";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { closeDeploymentRequest, type DeploymentRequestRepo } from "@/lib/tauri/deploymentRequestRepo";

import { releaseClosureEvidenceSchema } from "@/lib/tauri/releaseClosureEvidence";

export const dynamic = "force-dynamic";

/** Reads only the closure receipt for the requested closed release version. */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const headers = { "Cache-Control": "private, no-store" };
    try {
        const session = await resolveRequestDesktopSession(request, {
            requiredScope: "pipeline:trigger",
            route: "GET /api/desktop/deployments/:id/close",
            allowApiKey: false,
            recordHeartbeat: false,
        });
        if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401, headers });

        const { id } = await params;
        const versions = request.nextUrl.searchParams.getAll("expectedVersion");
        if (!id.trim() || versions.length !== 1 || !/^[1-9]\d{0,8}$/.test(versions[0])) {
            return NextResponse.json({ ok: false, error: "invalid_release_locator" }, { status: 400, headers });
        }
        const version = Number(versions[0]);
        const organizationId = String(session.organizationId);
        const receipts = await prisma.tauriAuditEvent.findMany({
            where: {
                organizationId,
                deploymentRequestId: id,
                action: "deployment_request.closed",
                source: "desktop",
                actorRole: "requester",
                deploymentRequest: { organizationId, id, version, status: "closed", closedAt: { not: null } },
            },
            select: { evidenceLink: true, newValueJson: true },
            take: 2,
        });
        if (receipts.length === 1) {
            const receipt = receipts[0];
            const snapshot = receipt.newValueJson as { version?: unknown; status?: unknown; closureSummary?: unknown } | null;
            if (snapshot?.version === version && snapshot.status === "closed") {
                const result = releaseClosureEvidenceSchema.safeParse({
                    id, version, reference: receipt.evidenceLink, summary: snapshot.closureSummary,
                });
                if (result.success) return NextResponse.json({ ok: true, data: result.data }, { headers });
            }
        }
        return NextResponse.json({ ok: false, error: "closure_evidence_unavailable" }, { status: 404, headers });
    } catch {
        return NextResponse.json({ ok: false, error: "closure_evidence_load_failed" }, { status: 500, headers });
    }
}

/**
 * Records a human-confirmed release outcome against an existing request.
 * It is an evidence-only closure boundary: this endpoint never calls a
 * source-control, cloud, or delivery provider.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const session = await resolveRequestDesktopSession(request, {
            requiredScope: "pipeline:trigger",
            route: "POST /api/desktop/deployments/:id/close",
        });
        if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        const expectedVersion = body?.expectedVersion;
        const closureEvidenceId = typeof body?.closureEvidenceId === "string" ? body.closureEvidenceId : "";
        const closureSummary = typeof body?.closureSummary === "string" ? body.closureSummary : "";
        if (!Number.isInteger(expectedVersion)) {
            return NextResponse.json({ ok: false, error: "expected_version_required" }, { status: 400 });
        }
        const { id } = await params;
        const correlationId = resolveCorrelationId(request.headers);
        const result = await closeDeploymentRequest(
            prisma as unknown as DeploymentRequestRepo,
            {
                organizationId: String(session.organizationId),
                requesterUserId: String(session.userId),
                actorRole: "requester",
                correlationId,
                requestId: id,
                expectedVersion: expectedVersion as number,
                closureEvidenceId,
                closureSummary,
                closedAtUtc: new Date().toISOString(),
            },
        );
        if (!result.ok) {
            return NextResponse.json({ ok: false, error: result.reason }, {
                status: result.reason === "not_found" ? 404
                    : result.reason === "version_conflict" || result.reason === "request_not_submitted" ? 409
                    : 422,
            });
        }
        return NextResponse.json({
            ok: true,
            data: {
                id: result.request.id,
                version: result.request.version,
                status: result.request.status,
                closedAt: result.request.closedAt?.toISOString() ?? null,
            },
        }, { headers: { "x-correlation-id": correlationId } });
    } catch {
        return NextResponse.json({ ok: false, error: "deployment_request_close_failed" }, { status: 500 });
    }
}
