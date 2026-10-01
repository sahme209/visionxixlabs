import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveCorrelationId } from "@/lib/api/correlation";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { closeDeploymentRequest, type DeploymentRequestRepo } from "@/lib/tauri/deploymentRequestRepo";

export const dynamic = "force-dynamic";

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
                status: result.reason === "not_found" ? 404 : result.reason === "version_conflict" ? 409 : 422,
            });
        }
        return NextResponse.json({
            ok: true,
            data: {
                id: result.request.id,
                status: result.request.status,
                closedAt: result.request.closedAt?.toISOString() ?? null,
            },
        }, { headers: { "x-correlation-id": correlationId } });
    } catch {
        return NextResponse.json({ ok: false, error: "deployment_request_close_failed" }, { status: 500 });
    }
}
